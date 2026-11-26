import { describe, expect, it } from "vitest"
import { loadDemoLeases, loadDemoListings, loadDemoQuestionnaire, loadLeaseAnswers, loadScoutAnswers } from "../src/adapters/fixtures/demo-listings.js"
import { MockRunner, developerText, lastUserText, type MockScript } from "../src/adapters/inference/mock-runner.js"
import { demoRoomScript } from "../src/adapters/inference/scripts/demo-script.js"
import { FAST_PACE } from "../src/adapters/server/research-routes.js"
import { ResearchSession } from "../src/application/research/research-session.js"
import { auditReport, createFact, validateSource, type ReportDraft } from "../src/domain/index.js"

async function run(script?: (inner: MockScript) => MockScript) {
  const { profile, requirements } = loadDemoQuestionnaire()
  const inner = demoRoomScript({ scout: loadScoutAnswers(), lease: loadLeaseAnswers() }, FAST_PACE)
  const s = new ResearchSession({ id: "t", mode: "demo", model: "mock", runner: new MockRunner({ script: script ? script(inner) : inner }), listings: loadDemoListings(), leases: loadDemoLeases(), profile, requirements })
  const start = Date.now()
  while (s.status !== "done" && Date.now() - start < 10_000) await new Promise((r) => setTimeout(r, 20))
  return s
}

/** Replaces the Report writer's first (or every) answer; everything else is the demo script. */
const writerOverride = (patch: (report: Record<string, unknown>, attempt: number) => Record<string, unknown>): ((inner: MockScript) => MockScript) => (inner) => async (input) => {
  const reply = await inner(input)
  if (!developerText(input).startsWith("You are the Report writer") || !("text" in reply)) return reply
  const attempt = lastUserText(input).includes("The Auditor rejected") ? 2 : 1
  return { text: JSON.stringify(patch(JSON.parse(reply.text) as Record<string, unknown>, attempt)) }
}

const types = (s: ResearchSession) => s.events.map((e) => e.type)

describe("Report writer + Auditor (keyless)", () => {
  it("writes an audited report after the ranking; it never recommends a rejected candidate", async () => {
    const s = await run()
    const report = s.report()!
    expect(report.failed).toBeNull()
    expect(report.audit).toMatchObject({ corrected: 0, removed: 0, attempts: 1 })
    expect(report.audit.checked).toBeGreaterThan(5)
    expect(report.recommended).toEqual(["demo-01", "demo-06", "demo-05"])
    for (const id of ["demo-02", "demo-07"]) {
      expect(report.recommended).not.toContain(id)
      expect(report.sections.recommendation!.some((x) => x.text.includes(id))).toBe(false)
    }
    expect(report.sections.rejected!.map((x) => x.text).join(" ")).toContain("demo-07")
    // Every sentence cites facts, and every fact carries a valid source.
    for (const list of Object.values(report.sections)) for (const x of list) {
      expect(x.facts.length).toBeGreaterThan(0)
      for (const f of x.facts) expect(() => validateSource(f.source as never)).not.toThrow()
    }
    // Order on the bus: ranking, draft, audit, ready; then the session ends.
    const t = types(s)
    expect(t.indexOf("ranking.done")).toBeLessThan(t.indexOf("report.drafted"))
    expect(t.indexOf("audit.started")).toBeLessThan(t.indexOf("audit.done"))
    expect(t.indexOf("report.ready")).toBeLessThan(t.indexOf("research.done"))
    expect(s.events.find((e) => e.type === "audit.started")!.agent).toBe("Auditor")
  })

  it("an invented number is caught and sent back; the corrected report passes", async () => {
    const s = await run(
      writerOverride((r, attempt) => {
        if (attempt === 2) return r
        const rec = r.recommendation as { text: string; facts: string[] }[]
        return { ...r, recommendation: [{ ...rec[0]!, text: `${rec[0]!.text} It saves 4,321 EUR a year.` }, ...rec.slice(1)] }
      }),
    )
    const failed = s.events.find((e) => e.type === "report.audit_failed")!
    expect(JSON.stringify(failed.data)).toContain("numbers not in the cited facts: 4,321")
    const report = s.report()!
    expect(report.audit).toMatchObject({ corrected: 1, removed: 0, attempts: 2 })
    expect(JSON.stringify(report.sections)).not.toContain("4,321")
  })

  it("a number that stays invented is removed and marked; the rest of the report stays", async () => {
    const s = await run(
      writerOverride((r) => {
        const rec = r.recommendation as { text: string; facts: string[] }[]
        return { ...r, recommendation: [{ ...rec[0]!, text: `${rec[0]!.text} It saves 4,321 EUR a year.` }, ...rec.slice(1)] }
      }),
    )
    const report = s.report()!
    expect(report.audit).toMatchObject({ corrected: 1, removed: 1, attempts: 2 })
    const removed = report.sections.recommendation!.find((x) => x.status === "removed")!
    expect(removed.note).toContain("Removed by the Auditor: numbers not in the cited facts: 4,321")
    expect(report.sections.recommendation!.filter((x) => x.status === "ok").length).toBe(2)
  })

  it("recommending a rejected candidate is rejected, in the list and in the text", () => {
    const facts = [
      createFact({ id: "F1", kind: "rank", candidateId: "demo-01", text: "demo-01 is ranked #1 of 2 with a score of 80 out of 100, confidence high.", source: { kind: "profile", ref: "questionnaire", field: "monthlyBudget" } }),
      createFact({ id: "F2", kind: "rejected", candidateId: "demo-07", text: "demo-07 was rejected by a hard flag.", source: { kind: "lease", ref: "lease-demo-07", clause: "tenantMayTerminateEarly" } }),
    ]
    const draft: ReportDraft = {
      recommended: ["demo-07"],
      recommendation: [{ text: "Go for demo-07, score 80.", facts: ["F2"] }],
      checkBeforeSigning: [],
      rejected: [],
      unknowns: [{ text: "Rent is 999 EUR.", facts: [] }],
    }
    const { problems } = auditReport(draft, facts, ["demo-01"], ["demo-07"])
    const messages = problems.map((p) => `${p.section}: ${p.message}`)
    expect(messages).toContain("recommended: demo-07 was rejected by a hard flag and can never be recommended")
    expect(messages).toContain("recommendation: recommends demo-07, which was rejected by a hard flag")
    expect(messages).toContain("unknowns: states a number or names a candidate without citing a fact")
  })
})
