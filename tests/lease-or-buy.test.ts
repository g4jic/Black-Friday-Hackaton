import { describe, expect, it } from "vitest"
import { loadDemoQuestionnaire } from "../src/adapters/fixtures/demo-questionnaire.js"
import {
  AreaM2,
  BUY_ASSUMPTIONS,
  BusinessProfile,
  DomainError,
  Money,
  annuityPayment,
  buyPricePerM2,
  isMissingData,
  leaseOrBuy,
  remainingBalance,
  sourced,
  validateSource,
  type LeaseTerms,
} from "../src/domain/index.js"

const { profile } = loadDemoQuestionnaire()
const withYears = (yearsPlanned?: number) => BusinessProfile.create({ ...profile.input, currency: "EUR", leaseMonths: 36, ...(yearsPlanned !== undefined ? { yearsPlanned } : {}) })
const rent = (amount: number) => sourced(Money.of(amount, "EUR"), { kind: "listing", ref: "listing-bg004", field: "rentMonthly", form: true })
const terms = (rentAmount: number, indexation: number | null = null): LeaseTerms => ({
  currency: "EUR",
  rentMonthly: rent(rentAmount),
  serviceChargeMonthly: null,
  vatOnRentRate: null,
  utilitiesMonthly: null,
  localTaxMonthly: null,
  deposit: null,
  agencyFee: null,
  fitOut: sourced(Money.of(0, "EUR"), { kind: "profile", ref: "questionnaire", field: "fitOutBudget" }),
  equipment: sourced(Money.of(0, "EUR"), { kind: "profile", ref: "questionnaire", field: "equipmentBudget" }),
  termMonths: sourced(36, { kind: "profile", ref: "questionnaire", field: "leaseMonths" }),
  indexationRatePerYear: indexation === null ? null : sourced(indexation, { kind: "lease", ref: "lease-x", clause: "indexation" }),
  noticeMonths: null,
  earlyExitPenalty: null,
})
const area = (m2: number) => sourced(AreaM2.of(m2), { kind: "listing", ref: "listing-bg004", field: "area", form: true })

describe("lease or buy (domain, labelled assumptions)", () => {
  it("prices come from the published table: Belgrade by municipality (district mapped), Novi Sad as a city", () => {
    expect(buyPricePerM2("Beograd", "Voždovac")?.value).toBe(BUY_ASSUMPTIONS.priceEurPerM2.beogradMunicipality["Voždovac"])
    expect(buyPricePerM2("Beograd", "Dorćol")?.value).toBe(BUY_ASSUMPTIONS.priceEurPerM2.beogradMunicipality["Stari grad"])
    expect(buyPricePerM2("Beograd", "Banovo brdo")?.value).toBe(BUY_ASSUMPTIONS.priceEurPerM2.beogradMunicipality["Čukarica"])
    expect(buyPricePerM2("Novi Sad", "Grbavica")?.value).toBe(BUY_ASSUMPTIONS.priceEurPerM2.city["Novi Sad"])
    expect(buyPricePerM2("Beograd", "Atlantida")).toBeNull()
    expect(buyPricePerM2("Niš", "Centar")).toBeNull()
  })

  it("the loan formula: payments repay the loan, nothing is owed at the end", () => {
    const pay = annuityPayment(100_000, 0.06, 120)
    expect(pay).toBeCloseTo(1110.21, 1)
    expect(remainingBalance(100_000, 0.06, 120, 120)).toBe(0)
    expect(remainingBalance(100_000, 0.06, 120, 0)).toBeCloseTo(100_000, 6)
    expect(remainingBalance(100_000, 0.06, 120, 60)).toBeGreaterThan(50_000) // interest first
  })

  it("compares the rent over the years planned with the net cost of buying; every figure has a valid source", () => {
    const r = leaseOrBuy({ terms: terms(750), area: area(51), city: "Beograd", district: "Voždovac", profile: withYears(5) })
    if (isMissingData(r)) throw new Error("should compare")
    expect(r.years.value).toBe(5)
    expect(r.leaseCost.value.amount).toBe(750 * 60)
    expect(r.price.value.amount).toBe(BUY_ASSUMPTIONS.priceEurPerM2.beogradMunicipality["Voždovac"]! * 51)
    expect(r.upFront.value.amount).toBe(Math.round(r.price.value.amount * (BUY_ASSUMPTIONS.downPaymentShare.value + BUY_ASSUMPTIONS.transferTaxRate.value + BUY_ASSUMPTIONS.buyingFeesRate.value)))
    expect(r.difference.value.amount).toBe(Math.abs(r.leaseCost.value.amount - r.buyCost.value.amount))
    expect(r.cheaper).toBe(r.buyCost.value.cents < r.leaseCost.value.cents ? "buy" : "lease")
    for (const x of [r.leaseCost, r.buyCost, r.upFront, r.price, r.monthlyLoanPayment, r.difference]) expect(() => validateSource(x.source)).not.toThrow()
    expect(r.notes.join(" ")).toContain("rent increase")
  })

  it("a short stay favours leasing (the buying costs come first), a cheap rent too", () => {
    const short = leaseOrBuy({ terms: terms(750), area: area(51), city: "Beograd", district: "Voždovac", profile: withYears(1) })
    const cheapRent = leaseOrBuy({ terms: terms(200), area: area(51), city: "Beograd", district: "Voždovac", profile: withYears(5) })
    if (isMissingData(short) || isMissingData(cheapRent)) throw new Error("should compare")
    expect(short.cheaper).toBe("lease")
    expect(cheapRent.cheaper).toBe("lease")
  })

  it("the years planned default to the lease length; a stated yearly increase makes leasing dearer", () => {
    expect(withYears().yearsPlanned()).toMatchObject({ value: 3, source: { kind: "calc" } })
    expect(withYears(7).yearsPlanned()).toMatchObject({ value: 7, source: { kind: "profile", field: "yearsPlanned" } })
    expect(() => withYears(0)).toThrow(DomainError)
    const flat = leaseOrBuy({ terms: terms(750, 0), area: area(51), city: "Beograd", district: "Voždovac", profile: withYears(5) })
    const rising = leaseOrBuy({ terms: terms(750, 0.05), area: area(51), city: "Beograd", district: "Voždovac", profile: withYears(5) })
    if (isMissingData(flat) || isMissingData(rising)) throw new Error("should compare")
    expect(rising.leaseCost.value.amount).toBeGreaterThan(flat.leaseCost.value.amount)
    expect(flat.notes).toHaveLength(0)
  })

  it("never guesses: no area, no price for the place or no euro rent is missing data", () => {
    expect(isMissingData(leaseOrBuy({ terms: terms(750), area: null, city: "Beograd", district: "Voždovac", profile: withYears(5) }))).toBe(true)
    expect(isMissingData(leaseOrBuy({ terms: terms(750), area: area(51), city: "Niš", district: "Centar", profile: withYears(5) }))).toBe(true)
    expect(isMissingData(leaseOrBuy({ terms: { ...terms(750), currency: "RSD" }, area: area(51), city: "Beograd", district: "Voždovac", profile: withYears(5) }))).toBe(true)
  })
})
