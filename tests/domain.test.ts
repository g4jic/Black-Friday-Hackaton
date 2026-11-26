import { describe, expect, it } from "vitest"
import {
  AreaM2,
  BusinessProfile,
  Candidate,
  DomainError,
  Money,
  areaOutsideRange,
  breakEvenRevenue,
  budgetExceeded,
  costShareAboveThreshold,
  costShareOfRevenue,
  createFinding,
  createRequirement,
  emptyListing,
  exitCostAfter,
  fairPriceCheck,
  hardRequirementNotMet,
  initialCosts,
  isMissingData,
  monthlyCost,
  paybackMonths,
  rentPerM2,
  sourced,
  totalCostOverTerm,
  validateSource,
  type BusinessProfileInput,
  type HardFlag,
  type LeaseTerms,
  type Listing,
  type SourceRef,
} from "../src/domain/index.js"

const URL = "https://example.test/listing/1"
const listingSrc = (field: string): SourceRef => ({ kind: "listing", ref: URL, field })
const profileSrc = (field: string): SourceRef => ({ kind: "profile", ref: "questionnaire", field })
const eur = (n: number) => Money.of(n, "EUR")

function expectDomainError(fn: () => unknown, code: DomainError["code"]): void {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe(code)
    return
  }
  throw new Error(`Expected DomainError(${code}) but nothing was thrown`)
}

const terms: LeaseTerms = {
  currency: "EUR",
  rentMonthly: sourced(eur(1000), listingSrc("rent")),
  serviceChargeMonthly: sourced(eur(100), listingSrc("serviceCharge")),
  vatOnRentRate: sourced(0.2, listingSrc("vat")),
  utilitiesMonthly: sourced(eur(150), { kind: "estimate", ref: "gas heating, 80 m2", inputs: [listingSrc("heating")] }),
  localTaxMonthly: null,
  deposit: sourced(eur(2000), listingSrc("deposit")),
  agencyFee: sourced(eur(500), listingSrc("agencyFee")),
  fitOut: sourced(eur(6000), profileSrc("fitOutBudget")),
  equipment: sourced(eur(4000), profileSrc("equipmentBudget")),
  termMonths: sourced(36, profileSrc("leaseMonths")),
  indexationRatePerYear: sourced(0.03, { kind: "lease", ref: "lease-draft-1", clause: "4.2" }),
  noticeMonths: sourced(3, { kind: "lease", ref: "lease-draft-1", clause: "9.1" }),
  earlyExitPenalty: null,
}

const profileInput: BusinessProfileInput = {
  businessType: "cafe_food",
  description: "Specialty coffee bar",
  headcount: 3,
  areaMinM2: 50,
  areaMaxM2: 100,
  currency: "EUR",
  monthlyBudget: 1300,
  expectedMonthlyRevenue: 10000,
  grossMarginRate: 0.6,
  walkInCustomers: true,
  leaseMonths: 36,
  city: "Novi Sad",
  fitOutBudget: 6000,
  equipmentBudget: 4000,
}

describe("Money", () => {
  it("adds in cents without float drift", () => {
    expect(eur(0.1).add(eur(0.2)).equals(eur(0.3))).toBe(true)
  })
  it("rejects mixing currencies without a sourced rate", () => {
    expectDomainError(() => eur(1).add(Money.of(1, "RSD")), "currency_mismatch")
  })
  it("rejects non-finite amounts", () => {
    expectDomainError(() => eur(Number.NaN), "invalid_money")
  })
})

describe("AreaM2", () => {
  it("rejects zero and negative areas", () => {
    expectDomainError(() => AreaM2.of(0), "invalid_area")
    expectDomainError(() => AreaM2.of(-5), "invalid_area")
  })
})

describe("SourceRef", () => {
  it("rejects a listing source that is not a URL", () => {
    expectDomainError(() => validateSource({ kind: "listing", ref: "some site" }), "invalid_source")
  })
  it("rejects a lease source without a clause", () => {
    expectDomainError(() => validateSource({ kind: "lease", ref: "lease-1" }), "invalid_source")
  })
  it("rejects a calc or estimate without inputs", () => {
    expectDomainError(() => validateSource({ kind: "calc", ref: "a + b" }), "invalid_source")
    expectDomainError(() => validateSource({ kind: "estimate", ref: "median", inputs: [] }), "invalid_source")
  })
  it("validates nested inputs too", () => {
    expectDomainError(() => validateSource({ kind: "calc", ref: "x", inputs: [{ kind: "listing", ref: "not a url" }] }), "invalid_source")
  })
})

describe("Finding", () => {
  const base = { id: "f1", candidateId: "c1", aspect: "finance" as const, severity: "soft" as const, claim: "Rent is 1000 EUR", author: "Finance" }
  it("cannot exist without a source", () => {
    expectDomainError(() => createFinding({ ...base, source: undefined as unknown as SourceRef }), "finding_without_source")
  })
  it("cannot exist with an invalid source", () => {
    expectDomainError(() => createFinding({ ...base, source: { kind: "listing", ref: "" } }), "finding_without_source")
  })
  it("accepts a sourced finding", () => {
    expect(createFinding({ ...base, source: listingSrc("rent") }).claim).toBe("Rent is 1000 EUR")
  })
  it("rejects an empty claim", () => {
    expectDomainError(() => createFinding({ ...base, claim: " ", source: listingSrc("rent") }), "invalid_finding")
  })
})

describe("BusinessProfile", () => {
  it("rejects an inverted area range", () => {
    expectDomainError(() => BusinessProfile.create({ ...profileInput, areaMinM2: 120 }), "invalid_profile")
  })
  it("rejects a non-positive budget and a margin above 100%", () => {
    expectDomainError(() => BusinessProfile.create({ ...profileInput, monthlyBudget: 0 }), "invalid_profile")
    expectDomainError(() => BusinessProfile.create({ ...profileInput, grossMarginRate: 1.5 }), "invalid_profile")
  })
  it("exposes answers as profile-sourced values", () => {
    const p = BusinessProfile.create(profileInput)
    expect(p.money("monthlyBudget").source).toEqual(profileSrc("monthlyBudget"))
  })
})

describe("Requirement", () => {
  it("rejects an unknown aspect", () => {
    expectDomainError(
      () => createRequirement({ id: "r1", text: "x", hard: true, aspect: "vibes" as never, source: profileSrc("specialNeeds") }),
      "invalid_requirement",
    )
  })
})

describe("Candidate", () => {
  const listing: Listing = emptyListing(URL)
  const flag = (raisedBy: string): HardFlag => ({ aspect: "finance", rule: "r", reason: "too expensive", raisedBy, source: listingSrc("rent") })

  it("reject() is idempotent: the first flag wins, later ones are recorded", () => {
    const c = new Candidate("c1", listing)
    c.startEvaluation()
    expect(c.reject(flag("Finance"))).toBe(true)
    expect(c.reject(flag("Location"))).toBe(false)
    expect(c.status).toBe("rejected")
    expect(c.rejection?.raisedBy).toBe("Finance")
    expect(c.laterFlags).toHaveLength(1)
  })
  it("aborts its signal on rejection, so tools in flight can stop", () => {
    const c = new Candidate("c1", listing)
    expect(c.signal.aborted).toBe(false)
    c.reject(flag("Finance"))
    expect(c.signal.aborted).toBe(true)
  })
  it("a rejected candidate cannot be scored", () => {
    const c = new Candidate("c1", listing)
    c.startEvaluation()
    c.reject(flag("Finance"))
    expectDomainError(() => c.markScored(80), "invalid_transition")
  })
  it("a scored candidate cannot be rejected, and pending cannot be scored", () => {
    const c = new Candidate("c1", listing)
    expectDomainError(() => c.markScored(80), "invalid_transition")
    c.startEvaluation()
    c.markScored(80)
    expectDomainError(() => c.reject(flag("Finance")), "invalid_transition")
  })
  it("a flag without a valid source is rejected", () => {
    const c = new Candidate("c1", listing)
    expectDomainError(() => c.reject({ ...flag("Finance"), source: { kind: "listing", ref: "" } }), "invalid_source")
    expect(c.status).toBe("pending")
  })
})

describe("LeaseCostCalculator", () => {
  it("monthly cost = rent 1000 + service 100 + VAT 20% of rent 200 + utilities 150 = 1450", () => {
    const m = monthlyCost(terms)
    expect(m.total.value.amount).toBe(1450)
    expect(m.total.source.kind).toBe("calc")
    expect(m.total.source.inputs).toHaveLength(4)
    expect(m.unknowns).toEqual([])
  })
  it("lists unknown cost items instead of guessing them", () => {
    const m = monthlyCost({ ...terms, serviceChargeMonthly: null, vatOnRentRate: null })
    expect(m.total.value.amount).toBe(1150)
    expect(m.unknowns).toHaveLength(2)
  })
  it("initial costs = deposit 2000 + agency 500 + fit-out 6000 + equipment 4000 = 12500", () => {
    expect(initialCosts(terms).total.value.amount).toBe(12500)
  })
  it("total over 36 months with 3% yearly rent indexation", () => {
    // rent: 12x1000 + 12x1030 + 12x1060.90 = 37090.80; other 450 x 36 = 16200; agency + fit-out + equipment = 10500
    expect(totalCostOverTerm(terms).total.value.amount).toBe(63790.8)
  })
  it("exit after 12 months = 3 notice months x 1450 + unrecovered fit-out 6000 x 24/36", () => {
    const exit = exitCostAfter(terms, 12)
    expect(exit.total.value.amount).toBe(8350)
    expect(exit.unknowns).toContain("Early exit penalty")
  })
  it("cost share, break-even revenue and payback", () => {
    const monthly = monthlyCost(terms).total
    const revenue = sourced(eur(10000), profileSrc("expectedMonthlyRevenue"))
    const margin = sourced(0.6, profileSrc("grossMarginRate"))
    expect(costShareOfRevenue(monthly, revenue).value).toBeCloseTo(0.145)
    const breakEven = breakEvenRevenue(monthly, margin)
    if (isMissingData(breakEven)) throw new Error("expected a value")
    expect(breakEven.value.amount).toBe(2416.67)
    const initialNonRefundable = sourced(eur(10500), profileSrc("x"))
    // 10500 / (10000 x 0.6 - 1450) = 2.31 -> 3 months
    const payback = paybackMonths(initialNonRefundable, revenue, margin, monthly)
    expect(!isMissingData(payback) && payback.value).toBe(3)
    const low = sourced(eur(2000), profileSrc("expectedMonthlyRevenue"))
    const never = paybackMonths(initialNonRefundable, low, margin, monthly)
    expect(!isMissingData(never) && never.value).toBeNull()
  })
  it("without a gross margin, break-even and payback are 'missing data', never computed or guessed", () => {
    const monthly = monthlyCost(terms).total
    const revenue = sourced(eur(10000), profileSrc("expectedMonthlyRevenue"))
    const profile = BusinessProfile.create({ ...profileInput, grossMarginRate: undefined })
    expect(profile.grossMarginRate()).toBeNull()
    const breakEven = breakEvenRevenue(monthly, profile.grossMarginRate())
    const payback = paybackMonths(sourced(eur(10500), profileSrc("x")), revenue, profile.grossMarginRate(), monthly)
    expect(isMissingData(breakEven)).toBe(true)
    expect(isMissingData(payback)).toBe(true)
    expect(isMissingData(payback) && payback.missing[0]).toContain("Gross margin")
  })
  it("rejects a zero revenue for the cost share", () => {
    expectDomainError(() => costShareOfRevenue(monthlyCost(terms).total, sourced(eur(0), profileSrc("expectedMonthlyRevenue"))), "invalid_input")
  })
  it("rent per m2", () => {
    expect(rentPerM2(terms.rentMonthly, sourced(AreaM2.of(80), listingSrc("area"))).value).toBe(12.5)
  })
})

describe("fair price check", () => {
  const comp = (v: number, i: number) => sourced(v, { kind: "listing", ref: `https://example.test/comp/${i}`, field: "rentPerM2" })
  it("needs at least 3 comparables, otherwise no estimate", () => {
    expect(fairPriceCheck(sourced(12, listingSrc("rentPerM2")), [comp(10, 1), comp(11, 2)])).toEqual({ status: "not_enough_data", comparables: 2 })
  })
  it("uses the interquartile range and cites every comparable", () => {
    const comps = [8, 10, 11, 13, 15].map(comp)
    const r = fairPriceCheck(sourced(12, listingSrc("rentPerM2")), comps)
    if (r.status !== "ok") throw new Error("expected ok")
    expect(r.range.value).toEqual({ low: 10, median: 11, high: 13 })
    expect(r.verdict).toBe("within")
    expect(r.range.source.kind).toBe("estimate")
    expect(r.range.source.inputs).toHaveLength(5)
    const above = fairPriceCheck(sourced(20, listingSrc("rentPerM2")), comps)
    expect(above.status === "ok" && above.verdict).toBe("above")
  })
})

describe("hard flags (decided in code)", () => {
  const monthly = monthlyCost(terms).total // 1450
  it("monthly cost more than 10% over budget is a hard flag", () => {
    const flag = budgetExceeded(monthly, sourced(eur(1300), profileSrc("monthlyBudget")), "Finance")
    expect(flag?.rule).toBe("monthly_cost_over_budget")
    expect(flag?.reason).toContain("12% over")
  })
  it("up to 10% over budget is not a hard flag", () => {
    expect(budgetExceeded(monthly, sourced(eur(1320), profileSrc("monthlyBudget")), "Finance")).toBeNull()
  })
  it("area outside the required range is a hard flag", () => {
    const min = sourced(AreaM2.of(50), profileSrc("areaMinM2"))
    const max = sourced(AreaM2.of(100), profileSrc("areaMaxM2"))
    expect(areaOutsideRange(sourced(AreaM2.of(80), listingSrc("area")), min, max, "Premises")).toBeNull()
    expect(areaOutsideRange(sourced(AreaM2.of(120), listingSrc("area")), min, max, "Premises")?.rule).toBe("area_outside_range")
  })
  it("cost share above the threshold is a hard flag", () => {
    const share = sourced(0.145, { kind: "calc", ref: "x", inputs: [listingSrc("rent")] })
    const threshold = sourced(0.12, { kind: "assumption", ref: "config/weights.json", field: "cafe_food.maxCostShare" })
    expect(costShareAboveThreshold(share, threshold, "Finance")?.reason).toContain("14.5%")
    expect(costShareAboveThreshold(share, sourced(0.15, threshold.source), "Finance")).toBeNull()
  })
  it("only a hard requirement that is definitely not met cancels; unknown never does", () => {
    const req = createRequirement({ id: "r1", text: "Kitchen ventilation", hard: true, aspect: "premises", source: profileSrc("businessType") })
    const soft = createRequirement({ ...req, id: "r2", hard: false })
    expect(hardRequirementNotMet(req, "not_met", listingSrc("description"), "Premises")?.rule).toBe("hard_requirement_not_met")
    expect(hardRequirementNotMet(req, "unknown", listingSrc("description"), "Premises")).toBeNull()
    expect(hardRequirementNotMet(soft, "not_met", listingSrc("description"), "Premises")).toBeNull()
  })
})
