import { describe, expect, it } from "vitest"
import { applyEvent, initialResearch, type ResearchState } from "../web/src/research-state.js"
import { allSources, costRows, headline, leaseSection, plainSource, premisesSection, resultsList, scoreReason, strengthsAndRisks, unknowns, yearScenarios } from "../web/src/results/results-model.js"
import { formatMoney } from "../web/src/format.js"
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
  fields: { city: text("Novi Sad"), address: text(address), area: { value: { kind: "area", m2 } }, rentMonthly: { value: { kind: "money", amount: 900, currency: "EUR" } } },
  unverified: [],
  rejection: null,
  laterFlags: [],
  findings: [],
  premises: null,
  ranking: null,
  ...patch,
})

let seq = 0
const snapshot = (c: CandidateDTO): WireEvent => ({ seq: ++seq, at: seq, type: "candidate.snapshot", candidateId: c.id, data: { candidate: c } })
const play = (...cs: CandidateDTO[]): ResearchState =>
  [{ seq: ++seq, at: 0, type: "listings.submitted", data: { listingIds: cs.map((c) => c.id) } } as WireEvent, ...cs.map(snapshot)].reduce(applyEvent, initialResearch("r1"))

describe("results list (one list, in the Ranker order)", () => {
  const top = candidate("listing-01", "Liman 2, Narodnog fronta", 72, { ranking: ranking({ rank: 1, score: 80 }) })
  const second = candidate("listing-06", "Podbara", 50, { ranking: ranking({ rank: 2, score: 61, scoreHigh: 81, confidence: "medium", verdict: { verdict: "check_before_signing", why: "Ranked, but some inputs are unknown" }, components: [{ name: "cost", weight: 45, value: 0.9 }, { name: "area", weight: 20, value: 0.7 }, { name: "lease", weight: 20, value: null }, { name: "checks", weight: 15, value: 1 }] }) })
  const rejected = candidate("listing-02", "Zmaj Jovina", 58, { status: "rejected", rejection: { rule: "budget", reason: "Monthly cost is 113% over the budget", raisedBy: "Finance analyst", aspect: "finance", source: calc } })

  it("keeps the Ranker order, puts rejected candidates apart, and answers in one sentence", () => {
    const s = play(second, rejected, top)
    const { ranked, rejected: out } = resultsList(s)
    expect(ranked.map((e) => e.name)).toEqual(["Liman 2 · 72 m2", "Podbara · 50 m2"])
    expect(out.map((e) => [e.name, e.verdict, e.mainReason])).toEqual([["Zmaj Jovina · 58 m2", "not_recommended", "Monthly cost is 113% over the budget"]])
    expect(headline(s)).toBe("Best option: Liman 2, 72 m2 - Good, score 80.")
  })

  it("a higher score with a weaker verdict never becomes the best option (the list follows the Ranker's rank)", () => {
    const good = candidate("listing-32", "Grbavica", 85, { ranking: ranking({ rank: 1, score: 95 }) })
    const check = candidate("listing-20", "Liman 1", 77, { ranking: ranking({ rank: 2, score: 98, confidence: "medium", verdict: { verdict: "check_before_signing", why: "Ranked, but some inputs are unknown" } }) })
    const s = play(check, good)
    expect(resultsList(s).ranked.map((e) => e.name)).toEqual(["Grbavica · 85 m2", "Liman 1 · 77 m2"])
    expect(headline(s)).toBe("Best option: Grbavica, 85 m2 - Good, score 95.")
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
    expect(rows[0]).toMatchObject({ label: "Monthly cost", value: "900 EUR", source: "our calculation", note: null })
    expect(rows[3]).toMatchObject({ label: "Exit after 12 months", value: null, note: "Needs lease terms. Includes 10,000 EUR unrecovered fit-out." })
    expect(leaseSection(c).questions.length).toBeGreaterThan(0)
    expect(plainSource({ kind: "profile", ref: "questionnaire" })).toBe("your questionnaire")
  })

  it("a bad year and a good year come only from the code figures, with the parts of the exit cost", () => {
    const money = (amount: number) => ({ kind: "money" as const, amount, currency: "EUR" })
    const f = (name: string, claim: string, value: CandidateDTO["findings"][number]["value"]) => ({ id: `listing-04:finance:${name}`, aspect: "finance", severity: "info" as const, claim, author: "Finance analyst", value, source: calc })
    const c = candidate("listing-04", "Liman 1", 70, {
      findings: [
        f("exit_cost_after_12_months", "Exit cost after 12 months", money(5300)),
        f("exit_cost_part_1", "Cost during notice period", money(2600)),
        f("exit_cost_part_2", "Unrecovered fit-out", money(2700)),
        f("payback_months", "Pays back in 9 months", { kind: "number", value: 9 }),
        f("break_even_revenue", "Break-even revenue", money(4333)),
      ],
    })
    const y = yearScenarios(c)!
    expect(y.bad).toMatchObject({ total: "5,300 EUR", complete: true })
    expect(y.bad.parts.map((p) => [p.label, p.value])).toEqual([["Cost during notice period", "2,600 EUR"], ["Unrecovered fit-out", "2,700 EUR"]])
    expect(y.good).toMatchObject({ payback: "9 months", breakEven: "4,333 EUR per month" })
    const noMargin = yearScenarios(candidate("listing-04", "Liman 1", 70, { findings: [f("payback_months", "Payback: missing data", { kind: "missing", missing: ["grossMarginRate"] })] }))!
    expect(noMargin.good.payback).toBeNull()
    expect(noMargin.good.note).toContain("gross margin")
    expect(yearScenarios(candidate("listing-06", "Liman 1", 70))).toBeNull()
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

describe("result wording (honest and readable)", () => {
  const form = (field: string) => ({ kind: "listing", ref: "listing-ns020", field, form: true })
  const reasons = [
    { text: "Monthly cost 920 EUR is 61% of the 1,500 EUR budget", effect: "plus" as const, source: calc },
    { text: "Lease: 6 months' notice", effect: "minus" as const, source: form("earlyTermination.noticeMonths") },
  ]

  it("main reason: the strongest plus and the biggest minus, not just the first finding", () => {
    const c = candidate("listing-ns020", "Liman 1", 77, { ranking: ranking({ reasons }) })
    expect(scoreReason(c)).toBe("Monthly cost 920 EUR is 61% of the 1,500 EUR budget; but 6 months' notice")
    expect(resultsList(play(c)).ranked[0]!.mainReason).toBe(scoreReason(c))
  })

  it("a candidate without a rent cannot be judged and is never the best option; one without an area says so", () => {
    const noRent = candidate("pasted-1", "Podbara", 60, { fields: { city: text("Novi Sad"), address: text("Podbara") }, ranking: ranking({ score: 90 }) })
    const priced = candidate("pasted-2", "Liman 2", 70, { ranking: ranking({ score: 70 }) })
    const s = play(noRent, priced)
    expect(resultsList(s).ranked.find((e) => e.candidate.id === "pasted-1")!.verdict).toBe("cannot_judge")
    expect(headline(s)).toBe("Best option: Liman 2, 70 m2 - Good, score 70.")
    expect(resultsList(s).ranked.find((e) => e.candidate.id === "pasted-1")!.name).toBe("Podbara · area unknown")
  })

  it("every amount is formatted the same way, in whole units", () => {
    expect(formatMoney(2500, "EUR")).toBe("2,500 EUR")
    expect(formatMoney(1415.38, "EUR")).toBe("1,415 EUR")
  })

  it("sources are grouped by origin with plain field names", () => {
    const c = candidate("listing-ns020", "Liman 1", 77, {
      fields: { rentMonthly: { value: { kind: "money", amount: 840, currency: "EUR" }, source: form("rentMonthly") } },
      findings: [{ id: "f1", candidateId: "listing-ns020", aspect: "finance", severity: "info", claim: "x", author: "Finance analyst", source: { kind: "calc", ref: "rent / area", inputs: [form("areaM2"), { kind: "profile", ref: "questionnaire", field: "monthlyBudget" }] } } as never],
    })
    const groups = allSources(c)
    expect(groups.map((g) => g.title)).toEqual(["Listing form", "Your questionnaire", "Calculation"])
    expect(groups[0]!.items).toEqual(["Monthly rent", "Area"])
    expect(groups[1]!.items).toEqual(["Monthly budget"])
  })

  it("without a draft, the lease card shows the form terms (not 'no information')", () => {
    const c = candidate("listing-ns020", "Liman 1", 77, {
      hasLease: false,
      findings: [{ id: "listing-ns020:lease:indexationKind", candidateId: "listing-ns020", aspect: "lease", severity: "info", claim: "Rent increases: follows the consumer price index", author: "Listing form check", source: form("indexation") } as never],
    })
    const lease = leaseSection(c)
    expect(lease.fromForm).toBe(true)
    expect(lease.terms[0]!.text).toBe("Rent increases: follows the consumer price index")
  })

  it("the space card: each stated check with its quote, a concern says what to check, unknown checks widen the range", () => {
    const src = (quote: string) => ({ kind: "listing", ref: "pasted-1", field: "storefront", quote })
    const c = candidate("pasted-1", "Liman", 60, {
      findings: [
        { id: "pasted-1:premises:ground_floor", aspect: "premises", severity: "info", claim: "The space is on the ground floor", author: "Premises inspector", source: { kind: "listing", ref: "pasted-1", field: "floor", quote: "u prizemlju" } },
        { id: "pasted-1:premises:storefront", aspect: "premises", severity: "info", claim: "The space has no storefront", author: "Premises inspector", source: src("Bez izloga") },
        { id: "pasted-1:premises:concern:premises_storefront", aspect: "premises", severity: "soft", claim: "The space has no storefront", checkBeforeSigning: "how customers will find the space without a shop window", author: "Premises inspector", source: src("Bez izloga") },
      ],
      premises: { notStated: ["kitchenVentilation", "waterAndDrain"] },
      ranking: ranking({ score: 76, scoreHigh: 80, components: [{ name: "cost", weight: 35, value: 1 }, { name: "premises", weight: 10, value: 0.33, valueHigh: 0.67 }] }),
    })
    const p = premisesSection(c)
    expect(p.read).toBe(true)
    expect(p.checks).toEqual([
      { text: "The space is on the ground floor", ok: true, checkBeforeSigning: null, source: 'from the listing: "u prizemlju"' },
      { text: "The space has no storefront", ok: false, checkBeforeSigning: "how customers will find the space without a shop window", source: 'from the listing: "Bez izloga"' },
    ])
    expect(p.notStated).toEqual(["Kitchen ventilation", "Water and drain"])
    // The only unknown part carries the whole range (76-80), not its own rounding (3): the card and the range agree.
    expect(unknowns(c).items).toContainEqual({ text: "The space itself: not stated in the listing or the lease (kitchen ventilation, water and drain)", points: 4 })
    expect(premisesSection(candidate("x", "Liman", 60)).read).toBe(false)
  })
})
