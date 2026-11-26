import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createHuman } from "@mozaik-ai/core"
import { loadDemoLeases, loadDemoListings, loadDemoQuestionnaire, loadLeaseAnswers, loadScoutAnswers } from "../src/adapters/fixtures/demo-listings.js"
import { MockRunner, developerText, lastUserText, type MockScript } from "../src/adapters/inference/mock-runner.js"
import { demoRoomScript } from "../src/adapters/inference/scripts/demo-script.js"
import { FINANCE_NAME, createFinanceAnalyst } from "../src/application/agents/finance-analyst.js"
import { LEASE_READER_NAME, createLeaseReader } from "../src/application/agents/lease-reader.js"
import { createScout, submitListings } from "../src/application/agents/scout.js"
import { STOPPED_PREFIX } from "../src/application/cancellation/candidate-cancellation.js"
import { createRecorder } from "../src/application/observers/recorder.js"
import { createAppRuntime } from "../src/application/runtime.js"
import {
  BusinessProfile,
  buildLease,
  buildListing,
  createListingBatch,
  evaluateLease,
  isMissingData,
  leaseTermsFor,
  unsourcedNumbers,
  validateSource,
  type Money,
  type SourceRef,
  type Sourced,
} from "../src/domain/index.js"
import { answerText, waitFor } from "./helpers.js"

const THREE = ["demo-01", "demo-04", "demo-07"]
const LATENCY = { scout: () => 10, leaseReader: 100, financeStep: 30 }
const room = () => demoRoomScript({ scout: loadScoutAnswers(), lease: loadLeaseAnswers() }, LATENCY)

function setup(script: MockScript, profile?: BusinessProfile) {
  const rt = createAppRuntime({ runner: new MockRunner({ script }), maxParallelInference: 8, resilience: { retries: 0 } })
  const recorder = createRecorder()
  const user = createHuman({ name: "User", capabilities: [], handlers: [] })
  const agents = [createScout(rt, { model: "mock" }), createFinanceAnalyst(rt, { model: "mock" }), createLeaseReader(rt, { model: "mock" })]
  for (const p of [recorder.participant, user, ...agents]) rt.join(p)
  const q = loadDemoQuestionnaire()
  rt.state.setQuestionnaire(profile ?? q.profile, q.requirements)
  rt.state.submitLeases(loadDemoLeases())
  return { rt, recorder, user }
}

const payload = <T>(e: { event: { payload: unknown } }) => e.event.payload as T
const forCandidate = (id: string) => (e: { event: { payload: unknown } }) => payload<{ candidateId?: string }>(e).candidateId === id

async function runThree(script: MockScript = room(), profile?: BusinessProfile) {
  const ctx = setup(script, profile)
  submitListings(ctx.rt, loadDemoListings().filter((l) => THREE.includes(l.id!)), ctx.user.getId())
  const settled = () =>
    ["demo-01", "demo-04"].every((id) => ctx.recorder.events.some((e) => e.type === "finance.explained" && forCandidate(id)(e))) &&
    ctx.recorder.events.some((e) => e.type === "model.answer" && ctx.rt.loopForEvent(e.event)?.key === "finance:demo-07:1")
  await waitFor(settled, 5000, "both finished candidates explained and demo-07's finance loop ended")
  return ctx
}

describe("Finance analyst + Lease reader (keyless, MockRunner)", () => {
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => unhandled.push(reason)
  beforeEach(() => {
    unhandled.length = 0
    process.on("unhandledRejection", onUnhandled)
  })
  afterEach(() => process.off("unhandledRejection", onUnhandled))

  it("on every candidate.found both loops start before either answers", async () => {
    const { rt, recorder } = await runThree()
    const at = (type: string, key: string) => recorder.events.findIndex((e) => e.type === type && rt.loopForEvent(e.event)?.key === key)
    for (const id of THREE) {
      const starts = [at("message_received.started", `finance:${id}:1`), at("message_received.started", `lease:${id}:1`)]
      const firstAnswer = Math.min(at("model.answer", `finance:${id}:1`), at("model.answer", `lease:${id}:1`))
      expect(starts.every((s) => s >= 0)).toBe(true)
      expect(Math.max(...starts)).toBeLessThan(firstAnswer)
    }
    expect(unhandled).toEqual([])
  })

  it("a hard flag in the lease cuts the Finance loop while it is still running; its result never arrives", async () => {
    const { rt, recorder } = await runThree()
    const c = rt.state.candidate("demo-07")
    expect(c.status).toBe("rejected")
    expect(c.rejection).toMatchObject({ rule: "locked_in_without_exit", raisedBy: LEASE_READER_NAME, source: { kind: "lease", ref: "lease-demo-07", clause: "tenantMayTerminateEarly" } })
    expect(c.laterFlags.map((f) => f.rule)).toEqual(["unlimited_rent_increase"]) // the second hard flag is recorded, not lost

    // The rejection event names the reason, the source and the loops it cut (for the Rejected row in the UI).
    const rejected = recorder.events.filter((e) => e.type === "candidate.rejected")
    expect(rejected).toHaveLength(1)
    expect(payload<{ cancelledLoops: unknown[] }>(rejected[0]!).cancelledLoops).toEqual([{ loopKey: "finance:demo-07:1", agent: FINANCE_NAME }])

    // Finance was mid tool call (waiting for the lease terms) and was stopped there.
    const cancelled = recorder.events.filter((e) => e.type === "loop.cancelled")
    expect(cancelled.map((e) => payload<{ loopKey: string; where: string }>(e))).toEqual([
      expect.objectContaining({ loopKey: "finance:demo-07:1", where: "mid tool call", rule: "locked_in_without_exit" }),
    ])
    expect(recorder.events.indexOf(rejected[0]!)).toBeLessThan(recorder.events.indexOf(cancelled[0]!))
    const answer = recorder.events.find((e) => e.type === "model.answer" && rt.loopForEvent(e.event)?.key === "finance:demo-07:1")!
    expect(answerText(answer.event).startsWith(STOPPED_PREFIX)).toBe(true)

    // The Finance result never arrives: no explanation, no term-level figures.
    expect(recorder.events.some((e) => e.type === "finance.explained" && forCandidate("demo-07")(e))).toBe(false)
    const financeFindings = rt.state.findings.filter((f) => f.candidateId === "demo-07" && f.author === FINANCE_NAME).map((f) => f.id)
    expect(financeFindings).toEqual(["demo-07:finance:monthly_cost", "demo-07:finance:initial_costs", "demo-07:finance:rent_per_m2"])
    expect(unhandled).toEqual([])
  })

  it("a soft flag stops nothing; a clean lease raises no flag", async () => {
    const { rt, recorder } = await runThree()
    const soft = rt.state.findings.filter((f) => f.candidateId === "demo-04" && f.severity === "soft")
    expect(soft.map((f) => f.id).sort()).toEqual(["demo-04:lease:concern:long_notice", "demo-04:lease:concern:personal_guarantee", "demo-04:lease:concern:tenant_pays_structural_repairs"])
    expect(soft.every((f) => f.checkBeforeSigning && f.source.kind === "lease" && f.source.quote)).toBe(true)
    for (const id of ["demo-01", "demo-04"]) {
      expect(rt.state.candidate(id).status).toBe("evaluating")
      expect(recorder.events.some((e) => e.type === "finance.explained" && forCandidate(id)(e))).toBe(true)
      expect(recorder.events.some((e) => (e.type === "loop.cancelled" || e.type === "candidate.rejected") && forCandidate(id)(e))).toBe(false)
    }
    expect(rt.state.findings.filter((f) => f.candidateId === "demo-01" && f.severity !== "info")).toEqual([])
    // The term-level figures used the lease terms (60 months for demo-04), not the questionnaire's 36.
    expect(rt.state.findings.find((f) => f.id === "demo-04:finance:total_cost_over_term")?.claim).toContain("over 60 months")
  })

  it("break-even is MissingData without a gross margin, and a sourced figure with one", async () => {
    const { rt } = await runThree()
    const be = rt.state.findings.find((f) => f.id === "demo-01:finance:break_even_revenue")!
    expect(isMissingData(be.value)).toBe(true)
    expect(be.source).toEqual({ kind: "profile", ref: "questionnaire", field: "grossMarginRate" })

    const withMargin = BusinessProfile.create({ ...loadDemoQuestionnaire().profile.input, grossMarginRate: 0.65 })
    const second = await runThree(room(), withMargin)
    const be2 = second.rt.state.findings.find((f) => f.id === "demo-01:finance:break_even_revenue")!
    const monthly = second.rt.state.findings.find((f) => f.id === "demo-01:finance:monthly_cost")!.value as Sourced<Money>
    expect((be2.value as Sourced<Money>).value.amount).toBeCloseTo(monthly.value.amount / 0.65, 2)
    expect(be2.source.kind).toBe("calc")
  })

  it("no number without a source: every finding is sourced, and an invented number in the explanation is sent back", async () => {
    const inner = room()
    let invented = false
    const script: MockScript = async (input) => {
      const reply = await inner(input)
      if (developerText(input).startsWith("You are the Finance analyst") && "text" in reply && !invented && !reply.text.startsWith("No scripted")) {
        invented = true
        return { text: JSON.stringify({ explanation: "The space costs 999 EUR per month." }) }
      }
      return reply
    }
    const { rt, recorder } = await runThree(script)
    for (const f of rt.state.findings) expect(() => validateSource(f.source)).not.toThrow()
    const rejected = recorder.events.filter((e) => e.type === "finance.explanation_rejected")
    expect(rejected).toHaveLength(1)
    expect(payload<{ reason: string }>(rejected[0]!).reason).toContain("numbers without a source: 999")
    for (const e of recorder.events.filter((x) => x.type === "finance.explained")) {
      expect(payload<{ explanation: string }>(e).explanation).not.toContain("999")
    }
  })
})

describe("partial acceptance and unverified leases", () => {
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => unhandled.push(reason)
  beforeEach(() => {
    unhandled.length = 0
    process.on("unhandledRejection", onUnhandled)
  })
  afterEach(() => process.off("unhandledRejection", onUnhandled))

  /** Replaces the Lease reader's answer for one lease; everything else stays the demo script. */
  const leaseOverride = (leaseId: string, answer: (retry: boolean) => string): MockScript => {
    const inner = room()
    return async (input) => {
      const message = lastUserText(input)
      if (developerText(input).startsWith("You are the Lease reader") && message.includes(`Lease id: ${leaseId}`)) {
        await new Promise((r) => setTimeout(r, LATENCY.leaseReader))
        return { text: answer(message.includes("previous extraction was rejected")) }
      }
      return inner(input)
    }
  }

  it("the live failure, keyless: a computed deposit and a stitched quote cost one clause, not the deal breakers", async () => {
    const base = loadLeaseAnswers()["lease-demo-07"] as Record<string, unknown>
    const script = leaseOverride("lease-demo-07", (retry) =>
      JSON.stringify({
        ...base,
        deposit: retry
          ? { found: true, amount: 1050, currency: "EUR", quote: ["Zakupac uplaćuje depozit u visini jedne mesečne zakupnine. Mesečna zakupnina iznosi 1.050 EUR"] }
          : { found: true, amount: 1050, currency: "EUR", quote: ["depozit u visini jedne mesečne zakupnine"] },
      }),
    )
    const { rt, recorder } = await runThree(script)
    const lease = rt.state.leaseClauses.get("demo-07")!
    expect(lease.unverified.map((u) => u.field)).toEqual(["deposit"])
    expect(isMissingData(lease.deposit)).toBe(true)
    // The verified clauses still decide: the hard flag is raised and Finance is cut while it waits.
    expect(rt.state.candidate("demo-07").rejection?.rule).toBe("locked_in_without_exit")
    expect(recorder.events.some((e) => e.type === "loop.cancelled" && payload<{ loopKey: string }>(e).loopKey === "finance:demo-07:1")).toBe(true)
    expect(rt.state.findings.find((f) => f.id === "demo-07:lease:concern:unverified_deposit")).toMatchObject({ severity: "soft", checkBeforeSigning: "what the lease says about deposit" })
    expect(recorder.events.filter((e) => e.type === "lease.extraction_rejected")).toHaveLength(1)
    expect(unhandled).toEqual([])
  })

  it("when the lease is not verified, term-level figures say so and carry questionnaire sources, never lease ones", async () => {
    const { rt, recorder } = await runThree(leaseOverride("lease-demo-01", () => "I cannot read this lease."))
    expect(recorder.events.some((e) => e.type === "lease.failed" && forCandidate("demo-01")(e))).toBe(true)
    const total = rt.state.findings.find((f) => f.id === "demo-01:finance:total_cost_over_term")!
    expect(total.claim).toContain("lease not verified: term from the questionnaire")
    expect(total.checkBeforeSigning).toContain("do not use verified lease terms")
    const kinds = (s: SourceRef): string[] => [s.kind, ...(s.inputs ?? []).flatMap(kinds)]
    expect(kinds(total.source)).not.toContain("lease")
    expect(JSON.stringify(total.source)).toContain('"field":"leaseMonths"')
    // A verified lease is used as such (demo-04: 60 months from the lease, no note).
    const verified = rt.state.findings.find((f) => f.id === "demo-04:finance:total_cost_over_term")!
    expect(verified.claim).not.toContain("not verified")
    expect(kinds(verified.source)).toContain("lease")
  })
})

describe("quotes in parts and amounts in months of rent (plain code)", () => {
  const lease = () => loadDemoLeases().find((l) => l.listingId === "demo-07")!
  const answer = (patch: Record<string, unknown>) => ({ ...(loadLeaseAnswers()["lease-demo-07"] as object), ...patch })
  it("a quote may have several parts; each must be in the text", () => {
    const ok = buildLease(lease(), answer({ term: { found: true, value: 10, unit: "years", quote: ["Član 2.", "na period od 10 (deset) godina"] } }))
    expect(ok.term).toMatchObject({ value: 120, source: { quote: "Član 2. ... na period od 10 (deset) godina" } })
    expect(() => buildLease(lease(), answer({ term: { found: true, value: 10, unit: "years", quote: ["Član 2.", "na period od 10 godina"] } }))).toThrow(/does not appear in the text/)
    // The live schema sends one string; the parts are split on " ... ".
    expect(buildLease(lease(), answer({ term: { found: true, value: 10, unit: "years", quote: "Član 2. ... na period od 10 (deset) godina" } })).term).toMatchObject({ value: 120 })
    // The stitched quote from the live run (two sentences merged into one excerpt) is still rejected.
    expect(() => buildLease(lease(), answer({ deposit: { found: true, amount: 1050, currency: "EUR", quote: "Zakupac uplaćuje depozit u visini jedne mesečne zakupnine. Mesečna zakupnina iznosi 1.050 EUR" } }))).toThrow(/does not appear in the text/)
  })
  it("months of rent: the number (digit or word) must be in the quote, and code computes the amount", () => {
    const clauses = buildLease(lease(), loadLeaseAnswers()["lease-demo-07"])
    expect(clauses.deposit).toMatchObject({ value: { monthsOfRent: 1 } })
    const terms = leaseTermsFor(rtListing("demo-07"), loadDemoQuestionnaire().profile, clauses)
    expect(terms).toMatchObject({ deposit: { value: { cents: 105000 }, source: { kind: "calc", ref: "deposit = 1 x monthly rent" } } })
    expect(() => buildLease(lease(), answer({ deposit: { found: true, monthsOfRent: 2, quote: ["depozit u visini jedne mesečne zakupnine"] } }))).toThrow(/monthsOfRent 2 does not appear/)
  })
})

function rtListing(id: string) {
  const text = loadDemoListings().find((l) => l.id === id)!
  return buildListing(createListingBatch([text])[0]!, loadScoutAnswers()[id])
}

describe("lease rules and number check (plain code)", () => {
  it("code decides the flags from the scripted clauses; years become months", () => {
    const leases = loadDemoLeases()
    const answers = loadLeaseAnswers()
    const read = (id: string) => buildLease(leases.find((l) => l.listingId === id)!, answers[`lease-${id}`])
    const hard = read("demo-07")
    expect(hard.term).toMatchObject({ value: 120, source: { quote: "na period od 10 (deset) godina" } })
    expect(evaluateLease(hard, "Lease reader").hardFlags.map((f) => f.rule)).toEqual(["locked_in_without_exit", "unlimited_rent_increase"])
    expect(evaluateLease(read("demo-04"), "Lease reader")).toMatchObject({ hardFlags: [] })
    expect(evaluateLease(read("demo-01"), "Lease reader")).toEqual({ hardFlags: [], concerns: [] })
  })
  it("a lease quote that is not in the lease is rejected", () => {
    const lease = loadDemoLeases().find((l) => l.listingId === "demo-01")!
    const answer = { ...(loadLeaseAnswers()["lease-demo-01"] as object), personalGuarantee: { found: true, value: true, quote: "Direktor lično jemči" } }
    expect(() => buildLease(lease, answer)).toThrow(/does not appear in the text/)
  })
  it("accepts formatting and rounding of given numbers, rejects others", () => {
    expect(unsourcedNumbers("Monthly cost 1,310.00 EUR, or 1.310 EUR, about 14.6% of revenue, over 36 months", [1310, 0.14556, 36])).toEqual([])
    expect(unsourcedNumbers("It costs 1,450 EUR", [1310])).toEqual(["1,450"])
  })
})
