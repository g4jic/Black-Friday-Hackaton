import { describe, expect, it } from "vitest"
import { loadDemoQuestionnaire } from "../src/adapters/fixtures/demo-questionnaire.js"
import { MockRunner, developerText, type MockScript } from "../src/adapters/inference/mock-runner.js"
import { demoRoomScript } from "../src/adapters/inference/scripts/demo-script.js"
import { FAST_PACE } from "../src/adapters/server/research-routes.js"
import { PREMISES_NAME } from "../src/application/agents/premises-inspector.js"
import { ResearchSession } from "../src/application/research/research-session.js"
import type { AppRuntime } from "../src/application/runtime.js"
import { PREMISES_CONCERN_RULES, isMissingData, validateSource } from "../src/domain/index.js"
import { sampleAreaLookup } from "./fixtures/sample-areas.js"
import { sampleLeaseAnswers, sampleLeases, sampleListings, sampleScoutAnswers } from "./fixtures/sample-listings.js"

/** A full keyless research run (scripted answers, synthetic OSM counts, no network), the cafe questionnaire. */
async function run(opts: { premisesStep?: number; script?: (inner: MockScript) => MockScript } = {}) {
  const { profile, requirements } = loadDemoQuestionnaire()
  const inner = demoRoomScript({ scout: sampleScoutAnswers(), lease: sampleLeaseAnswers() }, { ...FAST_PACE, premisesStep: opts.premisesStep ?? 20 })
  const s = new ResearchSession({ id: "premises", mode: "demo", model: "mock", runner: new MockRunner({ script: opts.script ? opts.script(inner) : inner }), listings: sampleListings(), leases: sampleLeases(), profile, requirements, areaLookup: sampleAreaLookup })
  const start = Date.now()
  while (s.status !== "done" && Date.now() - start < 10_000) await new Promise((r) => setTimeout(r, 20))
  return s
}
const ofType = (s: ResearchSession, type: string) => s.events.filter((e) => e.type === type)
/** The session's shared state (private in the app; tests read it directly). */
const stateOf = (s: ResearchSession) => (s as unknown as { rt: AppRuntime }).rt.state

describe("Premises inspector (keyless, scripted model)", () => {
  it("starts on every candidate.found next to Finance, Lease and Location (four loops before any of them answers)", async () => {
    const s = await run()
    const started = ofType(s, "loop.started")
    for (const id of ["listing-01", "listing-04"]) {
      const loops = started.filter((e) => e.candidateId === id)
      expect(new Set(loops.map((e) => e.agent))).toEqual(new Set(["Finance analyst", "Lease reader", "Location analyst", PREMISES_NAME]))
      const lastStart = Math.max(...loops.map((e) => e.seq))
      const firstAnswer = Math.min(...s.events.filter((e) => e.type === "loop.answered" && e.candidateId === id).map((e) => e.seq))
      expect(lastStart).toBeLessThan(firstAnswer)
    }
    expect(ofType(s, "premises.read").length).toBeGreaterThanOrEqual(5)
  })

  it("every stated feature carries a quote that is in the text; code decides the soft flags; nothing is a hard flag", async () => {
    const s = await run()
    const state = stateOf(s)
    // listing-05 says "Bez izloga": code turns "no storefront" into a soft flag for a cafe, with the quote as source.
    const facts = state.premises.get("listing-05")!
    expect(facts.storefront).toMatchObject({ value: false, source: { kind: "listing", ref: "listing-05", quote: "Bez izloga" } })
    const soft = state.findings.filter((f) => f.candidateId === "listing-05" && f.aspect === "premises" && f.severity === "soft")
    expect(soft.map((f) => f.id)).toContain("listing-05:premises:concern:premises_storefront")
    for (const f of state.findings.filter((x) => x.aspect === "premises")) {
      expect(() => validateSource(f.source)).not.toThrow()
      expect(f.severity).not.toBe("hard")
      if (f.severity === "soft") expect(PREMISES_CONCERN_RULES).toContain(f.id.split(":").pop())
      const text = state.candidate(f.candidateId).listing.text + (state.leaseTexts.get(f.candidateId)?.text ?? "")
      if (f.source.quote) expect(text.toLowerCase()).toContain(f.source.quote.toLowerCase())
    }
    // What the texts do not mention stays missing data (never assumed good or bad).
    expect(isMissingData(state.premises.get("listing-01")!.kitchenVentilation)).toBe(true)
    // No premises concern ever rejects a candidate.
    expect([...state.candidates.values()].every((c) => c.rejection?.raisedBy !== PREMISES_NAME)).toBe(true)
  })

  it("premises concerns reach the report as 'check' facts, which the Auditor checks", async () => {
    const s = await run()
    const checks = stateOf(s).reportFacts.filter((f) => f.kind === "check" && f.candidateId === "listing-05")
    expect(checks.some((f) => f.text.includes("The space has no storefront") && f.source.kind === "listing" && f.source.quote === "Bez izloga")).toBe(true)
    const report = stateOf(s).report!
    expect(report.failed).toBeUndefined()
    expect(report.audit.removed).toBe(0)
  })

  it("a quote that is not in the text is rejected (premises.extraction_rejected), then sent back once", async () => {
    const invent: (inner: MockScript) => MockScript = (inner) => async (input) => {
      const reply = await inner(input)
      if (!developerText(input).startsWith("You are the Premises inspector") || !("text" in reply)) return reply
      const answer = JSON.parse(reply.text) as Record<string, unknown>
      return { text: JSON.stringify({ ...answer, parking: { found: true, value: true, quote: "Garaža za 20 automobila" } }) }
    }
    const s = await run({ script: invent })
    const rejected = ofType(s, "premises.extraction_rejected")
    expect(rejected.length).toBeGreaterThan(0)
    expect(String(rejected[0]!.data?.reason)).toContain("Garaža za 20 automobila")
    // The last attempt keeps what code can verify: the invented parking becomes unverified missing data.
    for (const facts of stateOf(s).premises.values()) expect(isMissingData(facts.parking)).toBe(true)
  })

  it("a hard flag from another agent stops the Premises inspector's loop on that candidate; its result never arrives", async () => {
    const s = await run({ premisesStep: 400 }) // slower than the Lease reader, so the flag lands while it works
    expect(stateOf(s).candidate("listing-07").status).toBe("rejected")
    const cut = ofType(s, "loop.cancelled").filter((e) => e.agent === PREMISES_NAME)
    expect(cut.map((e) => e.candidateId)).toContain("listing-07")
    const rejected = ofType(s, "candidate.rejected").find((e) => e.candidateId === "listing-07")!
    expect((rejected.data?.cancelledLoops as { agent: string }[]).map((l) => l.agent)).toContain(PREMISES_NAME)
    expect(ofType(s, "premises.read").map((e) => e.candidateId)).not.toContain("listing-07")
    expect(stateOf(s).premises.has("listing-07")).toBe(false)
    expect(stateOf(s).findings.some((f) => f.candidateId === "listing-07" && f.aspect === "premises")).toBe(false)
  })
})
