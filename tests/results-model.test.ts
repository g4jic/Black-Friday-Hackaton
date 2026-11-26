import { describe, expect, it } from "vitest"
import { applyEvent, initialResearch, type ResearchState } from "../web/src/research-state.js"
import { costRows, headline, leaseSection, plainSource, resultsList, strengthsAndRisks, unknowns } from "../web/src/results/results-model.js"
import type { CandidateDTO, RankingDTO, WireEvent } from "../web/src/types.js"

const text = (value: string) => ({ value: { kind: "text" as const, value } })
const calc = { kind: "calc", ref: "x" }
const ranking = (patch: Partial<RankingDTO>): RankingDTO => ({
  rank: 1,
  score: 80,
  scoreHigh: 80,
  confidence: "high",
  tier: 1,
  reasons: [{ text: "72 m2 is inside the required 50-90 m2", effect: "plus", source: calc }],
  components: [
    { name: "cost", weight: 45, value: 0.6 },
    { name: "area", weight: 20, value: 1 },
    { name: "lease", weight: 20, value: 1 },
    { name: "checks", weight: 15, value: 1 },
  ],
  verdict: { verdict: "good", why: "High confidence" },
  ...patch,
})
const candidate = (id: string, address: string, m2: number, patch: Partial<CandidateDTO> = {}): CandidateDTO => ({
  id,
  synthetic: true,
  listingUrl: null,
  status: "scored",
  hasLease: true,
  fields: { city: text("Novi Sad"), address: text(address), area: { value: { kind: "area", m2 } } },
  unverified: [],
  rejection: null,
  laterFlags: [],
  findings: [],
  ranking: null,
  ...patch,
})

let seq = 0
const snapshot = (c: CandidateDTO): WireEvent => ({ seq: ++seq, at: seq, type: "candidate.snapshot", candidateId: c.id, data: { candidate: c } })
const play = (...cs: CandidateDTO[]): ResearchState =>
  [{ seq: ++seq, at: 0, type: "listings.submitted", data: { listingIds: cs.map((c) => c.id) } } as WireEvent, ...cs.map(snapshot)].reduce(applyEvent, initialResearch("r1"))

describe("results list (one list, highest score first)", () => {
  const top = candidate("listing-01", "Liman 2, Narodnog fronta", 72, { ranking: ranking({ rank: 2, score: 80 }) })
  const second = candidate("listing-06", "Podbara", 50, { ranking: ranking({ rank: 1, score: 61, scoreHigh: 81, confidence: "medium", verdict: { verdict: "check_before_signing", why: "Ranked, but some inputs are unknown" }, components: [{ name: "cost", weight: 45, value: 0.9 }, { name: "area", weight: 20, value: 0.7 }, { name: "lease", weight: 20, value: null }, { name: "checks", weight: 15, value: 1 }] }) })
  const rejected = candidate("listing-02", "Zmaj Jovina", 58, { status: "rejected", rejection: { rule: "budget", reason: "Monthly cost is 113% over the budget", raisedBy: "Finance analyst", aspect: "finance", source: calc } })

  it("sorts by the score, puts rejected candidates apart, and answers in one sentence", () => {
    const s = play(second, rejected, top)
    const { ranked, rejected: out } = resultsList(s)
    expect(ranked.map((e) => e.name)).toEqual(["Liman 2 · 72 m2", "Podbara · 50 m2"])
    expect(out.map((e) => [e.name, e.verdict, e.mainReason])).toEqual([["Zmaj Jovina · 58 m2", "not_recommended", "Monthly cost is 113% over the budget"]])
    expect(headline(s)).toBe("Best option: Liman 2, 72 m2 - Good, score 80.")
  })

  it("says honestly when nothing is recommended", () => {
    expect(headline(play(rejected))).toBe("No space is recommended: every candidate was rejected by a hard flag or could not be scored.")
  })

  it("unknowns say what lowers the confidence and by how much", () => {
    expect(unknowns(second)).toEqual({ items: [{ text: "Lease terms: no verified lease terms", points: 20 }], totalPoints: 20 })
  })
})

describe("candidate page", () => {
  it("costs name their source in plain words and say what is missing", () => {
    const c = candidate("listing-03", "Grbavica", 60, {
      hasLease: false,
      findings: [
        { id: "listing-03:finance:monthly_cost", aspect: "finance", severity: "info", claim: "Monthly cost 900 EUR; unknown: Utilities cost", author: "Finance analyst", value: { kind: "money", amount: 900, currency: "EUR" }, source: calc },
        { id: "listing-03:finance:exit_cost_after_12_months", aspect: "finance", severity: "info", claim: "Exit cost after 12 months: needs lease terms", author: "Finance analyst", value: { kind: "missing", missing: ["notice"] }, source: calc },
        { id: "listing-03:finance:exit_cost_known_part", aspect: "finance", severity: "info", claim: "Known part", author: "Finance analyst", value: { kind: "money", amount: 10000, currency: "EUR" }, source: calc },
      ],
    })
    const rows = costRows(c)
    expect(rows[0]).toEqual({ label: "Monthly cost", value: "900 EUR", source: "our calculation", note: null })
    expect(rows[3]).toMatchObject({ label: "Exit after 12 months", value: null, note: "Needs lease terms. Includes 10,000 EUR unrecovered fit-out." })
    expect(leaseSection(c).questions.length).toBeGreaterThan(0)
    expect(plainSource({ kind: "profile", ref: "questionnaire" })).toBe("your questionnaire")
  })

  it("hard flags come first among the risks", () => {
    const c = candidate("listing-07", "Novo naselje", 80, {
      status: "rejected",
      rejection: { rule: "no_exit", reason: "The tenant cannot end the lease early", raisedBy: "Lease reader", aspect: "lease", source: { kind: "lease", ref: "lease-listing-07" } },
      findings: [{ id: "listing-07:lease:x", aspect: "lease", severity: "soft", claim: "Long notice", checkBeforeSigning: "the 9 months' notice", author: "Lease reader", source: { kind: "lease", ref: "lease-listing-07" } }],
    })
    const { risks } = strengthsAndRisks(c)
    expect(risks[0]).toEqual({ text: "Hard flag: The tenant cannot end the lease early", hard: true, source: "from the lease draft" })
    expect(risks[1]!.text).toBe("Check before signing: the 9 months' notice")
  })
})
