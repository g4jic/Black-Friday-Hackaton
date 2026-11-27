import { describe, expect, it } from "vitest"
import { createHuman } from "@mozaik-ai/core"
import { loadDemoQuestionnaire } from "../src/adapters/fixtures/demo-questionnaire.js"
import { sampleLeaseAnswers, sampleLeases, sampleListings, sampleScoutAnswers } from "./fixtures/sample-listings.js"
import { MockRunner } from "../src/adapters/inference/mock-runner.js"
import { demoRoomScript } from "../src/adapters/inference/scripts/demo-script.js"
import { createFinanceAnalyst } from "../src/application/agents/finance-analyst.js"
import { createLeaseReader } from "../src/application/agents/lease-reader.js"
import { createRanker } from "../src/application/agents/ranker.js"
import { createScout, submitListings } from "../src/application/agents/scout.js"
import { createRecorder } from "../src/application/observers/recorder.js"
import { createAppRuntime } from "../src/application/runtime.js"
import {
  DomainError,
  Money,
  RANKING_ASSUMPTIONS,
  buildLease,
  buildListing,
  createListingBatch,
  missingData,
  rankCandidates,
  scoreCandidate,
  sourced,
  validateSource,
  verdictFor,
  type CandidateScore,
  type RankingInput,
  type Sourced,
} from "../src/domain/index.js"
import { waitFor } from "./helpers.js"
import { sampleArea, sampleAreaLookup } from "./fixtures/sample-areas.js"
import { createLocationAnalyst } from "../src/application/agents/location-analyst.js"

const FAST = { scout: () => 10, leaseReader: 60, financeStep: 20 }

async function runDemo() {
  const rt = createAppRuntime({ runner: new MockRunner({ script: demoRoomScript({ scout: sampleScoutAnswers(), lease: sampleLeaseAnswers() }, FAST) }), maxParallelInference: 8, resilience: { retries: 0 } })
  const recorder = createRecorder()
  const user = createHuman({ name: "User", capabilities: [], handlers: [] })
  for (const p of [recorder.participant, user, createScout(rt, { model: "mock" }), createFinanceAnalyst(rt, { model: "mock" }), createLeaseReader(rt, { model: "mock" }), createLocationAnalyst(rt, { model: "mock", lookup: sampleAreaLookup }), createRanker(rt)]) rt.join(p)
  const q = loadDemoQuestionnaire()
  rt.state.setQuestionnaire(q.profile, q.requirements)
  rt.state.submitLeases(sampleLeases())
  submitListings(rt, sampleListings(), user.getId())
  await waitFor(() => recorder.events.some((e) => e.type === "ranking.done"), 5000, "ranking.done")
  const scored = recorder.events.filter((e) => e.type === "candidate.scored").map((e) => e.event.payload as { candidateId: string; rank: number; score: number; confidence: string; reasons: CandidateScore["reasons"] })
  return { rt, recorder, scored }
}

describe("Ranker (keyless, plain code)", () => {
  it("ranks every candidate that was not rejected; a hard flag is never ranked", async () => {
    const { rt, recorder, scored } = await runDemo()
    const rejected = [...rt.state.candidates.values()].filter((c) => c.isRejected()).map((c) => c.id).sort()
    expect(rejected).toEqual(["listing-02", "listing-07"])
    expect(scored.map((s) => s.candidateId)).not.toContain("listing-02")
    expect(scored.map((s) => s.candidateId)).not.toContain("listing-07")
    expect(scored).toHaveLength(6)
    expect(scored.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6])
    const done = recorder.events.find((e) => e.type === "ranking.done")!.event.payload as { excluded: string[] }
    expect(done.excluded.sort()).toEqual(rejected)
    expect(() => rt.state.recordRanking({ ...(rt.state.rankings.get("listing-01")!), candidateId: "listing-07" })).toThrow(DomainError)
    for (const id of scored.map((s) => s.candidateId)) expect(rt.state.candidate(id).status).toBe("scored")
  })

  it("a candidate without a stated rent cannot rank first, and the reason says why (with a source)", async () => {
    const { scored } = await runDemo()
    const noRent = scored.find((s) => s.candidateId === "listing-08")!
    expect(noRent.rank).toBe(6)
    expect(noRent.confidence).toBe("low")
    expect(noRent.reasons[0]).toEqual({
      text: "Cannot rank first: the listing does not state the rent (missing data)",
      effect: "order",
      source: { kind: "listing", ref: "listing-08", field: "rentMonthly", missing: true },
    })
  })

  it("every reason has a valid source, and 2 or 3 reasons are given", async () => {
    const { scored } = await runDemo()
    for (const s of scored) {
      expect(s.reasons.length).toBeGreaterThanOrEqual(2)
      expect(s.reasons.length).toBeLessThanOrEqual(3)
      for (const r of s.reasons) expect(() => validateSource(r.source)).not.toThrow()
    }
  })

  it("demo: listing-01 (all data) ranks first, ahead of the candidates without a lease draft; ranges are shown as such", async () => {
    const { scored } = await runDemo()
    const view = scored.map((s) => [s.candidateId, s.rank, s.score, (s as { scoreHigh?: number }).scoreHigh])
    // listing-01 has every input (lease draft read, area, OSM): one number, ranked first.
    expect(view[0]![0]).toBe("listing-01")
    expect(view[0]![2]).toBe(view[0]![3])
    // No lease draft: the lease part is unknown, so the score is a range of exactly its weight.
    const l06 = view.find((v) => v[0] === "listing-06")!
    expect((l06[3] as number) - (l06[2] as number)).toBe(RANKING_ASSUMPTIONS.weights.lease)
    const l03 = view.find((v) => v[0] === "listing-03")!
    expect((l03[3] as number) - (l03[2] as number)).toBeGreaterThan(RANKING_ASSUMPTIONS.weights.lease)
  })

  it("the same input gives the same order and scores", async () => {
    const a = await runDemo()
    const b = await runDemo()
    const view = (x: typeof a.scored) => x.map((s) => [s.candidateId, s.rank, s.score, s.confidence])
    expect(view(b.scored)).toEqual(view(a.scored))
  })
})

describe("score rules (domain)", () => {
  const { profile } = loadDemoQuestionnaire()
  const listingText = createListingBatch([sampleListings().find((l) => l.id === "listing-01")!])[0]!
  const listing = buildListing(listingText, sampleScoutAnswers()["listing-01"])
  const lease = buildLease(sampleLeases().find((l) => l.listingId === "listing-01")!, sampleLeaseAnswers()["lease-listing-01"])
  const monthly = sourced(Money.of(1310, "EUR"), { kind: "calc", ref: "sum of monthly cost lines", inputs: [{ kind: "listing", ref: "listing-01", field: "rentMonthly", quote: "Cena: 1.250 € mesečno" }] })
  const base: RankingInput = { candidateId: "listing-01", listing, profile, monthlyCost: monthly, lease, hasLeaseDraft: true, softFindings: [], area: sampleArea("listing-01") }
  /** The range by hand: unknown parts as 0 (low end) and as full (high end). */
  const byHand = (s: CandidateScore) => ({
    low: Math.round(s.components.reduce((a, c) => a + c.weight * (c.value ?? 0), 0)),
    high: Math.round(s.components.reduce((a, c) => a + c.weight * (c.value ?? 1), 0)),
  })

  it("lease terms only from the listing form score, but give at most medium confidence (not a verified lease)", () => {
    const fromForm = (c: Sourced<unknown> | unknown) => (c && typeof c === "object" && "source" in (c as object) ? { ...(c as Sourced<unknown>), source: { kind: "listing" as const, ref: "listing-01", field: "earlyTermination", form: true } } : c)
    const formLease = Object.fromEntries(Object.entries(lease).map(([k, v]) => [k, fromForm(v)])) as typeof lease
    const s = scoreCandidate({ ...base, lease: formLease, hasLeaseDraft: false })
    expect(s.components.find((c) => c.name === "lease")!.value).toBe(scoreCandidate(base).components.find((c) => c.name === "lease")!.value)
    expect(s.confidence).toBe("medium")
    expect(s.reasons.some((r) => r.effect === "confidence" && r.text.includes("from the listing form"))).toBe(true)
  })

  it("with all data the score is one number; a missing part gives an exact range, never a re-weighted 100", () => {
    const full = scoreCandidate(base)
    expect(full.confidence).toBe("high")
    expect(full.scoreHigh).toBe(full.score)

    const noArea = scoreCandidate({ ...base, listing: { ...listing, area: missingData("area") } })
    expect(noArea.components.find((c) => c.name === "area")!.value).toBeNull()
    expect({ low: noArea.score, high: noArea.scoreHigh }).toEqual(byHand(noArea))
    expect(noArea.scoreHigh - noArea.score).toBeGreaterThanOrEqual(RANKING_ASSUMPTIONS.weights.area - 1) // the area's points are the gap
    expect(noArea.confidence).toBe("medium")
    expect(noArea.reasons.some((r) => r.effect === "confidence" && r.text.includes(`area not stated: up to ${RANKING_ASSUMPTIONS.weights.area} points unknown`))).toBe(true)

    const noLease = scoreCandidate({ ...base, lease: null, hasLeaseDraft: false })
    expect({ low: noLease.score, high: noLease.scoreHigh }).toEqual(byHand(noLease))
    expect(noLease.reasons.some((r) => r.effect === "confidence" && r.text.includes(`no lease draft: up to ${RANKING_ASSUMPTIONS.weights.lease} points unknown`))).toBe(true)

    const both = scoreCandidate({ ...base, lease: null, hasLeaseDraft: false, listing: { ...listing, area: missingData("area") } })
    expect(both.confidence).toBe("low")
    expect(both.scoreHigh - both.score).toBeGreaterThanOrEqual(RANKING_ASSUMPTIONS.weights.area + RANKING_ASSUMPTIONS.weights.lease - 1)
  })

  it("a candidate with all data ranks ahead of one whose low end is lower, even if its high end is higher", () => {
    const full = scoreCandidate(base)
    const cheapNoLease = scoreCandidate({ ...base, candidateId: "x-cheap-no-lease", lease: null, hasLeaseDraft: false, monthlyCost: sourced(Money.of(700, "EUR"), monthly.source) })
    expect(cheapNoLease.scoreHigh).toBeGreaterThan(full.score)
    expect(cheapNoLease.score).toBeLessThan(full.score)
    expect(rankCandidates([cheapNoLease, full]).map((r) => r.candidateId)).toEqual(["listing-01", "x-cheap-no-lease"])
  })

  it("a candidate without rent ranks after every candidate with rent, whatever its range", () => {
    const noRent = scoreCandidate({ ...base, candidateId: "x-no-rent", monthlyCost: null })
    const weak = scoreCandidate({ ...base, candidateId: "x-weak", monthlyCost: sourced(Money.of(1640, "EUR"), monthly.source) })
    expect(noRent.tier).toBe(2)
    expect(noRent.scoreHigh).toBeGreaterThan(weak.score)
    expect(rankCandidates([noRent, weak]).map((r) => r.candidateId)).toEqual(["x-weak", "x-no-rent"])
    expect(noRent.reasons.some((r) => r.text.includes(`rent not stated: up to ${RANKING_ASSUMPTIONS.weights.cost} points unknown`))).toBe(true)
  })

  it("ranks by verdict first: the first place never has a weaker verdict than another candidate", () => {
    const full = scoreCandidate(base)
    const good = { ...full, candidateId: "x-good", score: 75, scoreHigh: 75 }
    const checkHigh = { ...full, candidateId: "x-check-98", score: 98, scoreHigh: 98, confidence: "medium" as const }
    const checkLow = { ...full, candidateId: "x-check-90", score: 90, scoreHigh: 95, confidence: "medium" as const }
    const low = { ...full, candidateId: "x-low", score: 40, scoreHigh: 40 }
    expect([good, checkHigh, checkLow, low].map((s) => verdictFor(s, false).verdict)).toEqual(["good", "check_before_signing", "check_before_signing", "not_recommended"])
    // A higher score does not jump a better verdict; inside a verdict the low end decides.
    expect(rankCandidates([low, checkLow, checkHigh, good]).map((r) => [r.candidateId, r.rank])).toEqual([["x-good", 1], ["x-check-98", 2], ["x-check-90", 3], ["x-low", 4]])
  })

  it("the same input gives the same order (pure function, any input order)", () => {
    const inputs = [base, { ...base, candidateId: "b", lease: null, hasLeaseDraft: false }, { ...base, candidateId: "c", monthlyCost: null }]
    const a = rankCandidates(inputs.map(scoreCandidate)).map((r) => [r.candidateId, r.rank, r.score, r.scoreHigh])
    const b = rankCandidates([...inputs].reverse().map(scoreCandidate)).map((r) => [r.candidateId, r.rank, r.score, r.scoreHigh])
    expect(b).toEqual(a)
  })

  it("the weights and rules are the published assumptions", () => {
    expect(Object.values(RANKING_ASSUMPTIONS.weights).reduce((a, b) => a + b, 0)).toBe(100)
    const s = scoreCandidate(base)
    expect(s.components.map((c) => [c.name, c.weight])).toEqual(Object.entries(RANKING_ASSUMPTIONS.weights))
  })
})
