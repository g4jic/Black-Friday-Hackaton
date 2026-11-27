import type { AreaM2 } from "./area.js"
import type { LeaseTerms } from "./lease-cost.js"
import { missingData, type MissingData } from "./missing.js"
import { Money } from "./money.js"
import type { BusinessProfile } from "./profile.js"
import { calc, sourced, type SourceRef, type Sourced } from "./source.js"

/**
 * Lease or buy a similar space: plain code, labelled assumptions, every one with its public source. It compares the
 * rent over the years the business plans to stay with the net cost of buying a space of the same size in the same
 * part of town with a bank loan. It is a rough comparison for one question ("would buying be cheaper over my
 * horizon, and what cash would it need now?"), not a valuation and not financial advice.
 */
const RGZ_H1_2026 = {
  ref: "RGZ, average price of commercial premises sold in the first half of 2026 (reported by Biznis.rs)",
  url: "https://biznis.rs/vesti/srbija/kvadrat-poslovnog-prostora-na-vracaru-skoro-4-000-evra-u-subotici-cetiri-puta-jeftiniji/",
}

export const BUY_ASSUMPTIONS = {
  description:
    "Buying a space of the same size in the same part of town with a bank loan, compared with the rent over the years you plan to stay. Building charges and utilities are paid either way, so they are left out of both.",
  /** Average sale price of commercial premises, EUR per m2, by Belgrade municipality and by city (Novi Sad has no municipality split). */
  priceEurPerM2: {
    source: RGZ_H1_2026,
    beogradMunicipality: { "Stari grad": 3823, Vračar: 3955, "Savski venac": 2501, "Novi Beograd": 2570, Palilula: 1759, Zemun: 2010, Zvezdara: 1949, Voždovac: 2095, Čukarica: 1663 } as Record<string, number>,
    /** Our districts mapped to their Belgrade municipality. */
    beogradDistrictToMunicipality: { Dorćol: "Stari grad", "Banovo brdo": "Čukarica", Karaburma: "Palilula", Mirijevo: "Zvezdara" } as Record<string, string>,
    city: { "Novi Sad": 1642 } as Record<string, number>,
  },
  interestRatePerYear: {
    value: 0.055,
    source: "NBS: average weighted rate on new euro and euro-indexed loans to companies, August 2026 (reported by Biznis.rs, 28 Sep 2026)",
    url: "https://biznis.rs/vesti/srbija/krediti-u-evrima-poskupeli-preko-leta-a-jesen-donosi-novo-povecanje/",
  },
  downPaymentShare: { value: 0.3, source: "SuiteSpot assumption: banks set the down payment per client; no published standard for business premises" },
  loanYears: { value: 10, source: "SuiteSpot assumption: 10 years, the longest term of the public programme for buying business premises" },
  transferTaxRate: { value: 0.025, source: "Law on property taxes (Zakon o porezima na imovinu): tax on the transfer of absolute rights 2.5%; a new building sold with VAT is taxed differently" },
  propertyTaxRatePerYear: { value: 0.004, source: "Law on property taxes: at most 0.4% a year of the value for a company (the local rate may be lower)" },
  buyingFeesRate: { value: 0.02, source: "SuiteSpot assumption: 2% of the price for agency, notary and loan fees" },
  cashReturnPerYear: {
    value: 0.03,
    source: "SuiteSpot assumption: 3% a year that the cash put in could earn elsewhere (for comparison, NBS reported 3.3% on new household foreign-currency deposits in March 2026, Biznis.rs, 29 Apr 2026)",
    url: "https://biznis.rs/novac/banke/krediti-za-obrtna-sredstva-jeftiniji-drugi-mesec-zaredom-stambeni-blago-poskupeli/",
  },
  maintenanceRatePerYear: { value: 0.01, source: "SuiteSpot assumption: 1% of the price a year for repairs the owner pays" },
  priceChange: "SuiteSpot assumption: the space is worth the same price at the end (no price change, no inflation)",
  notIncluded: "Not included: VAT on a new building, a change in the price of the space, tax effects of owning or renting.",
} as const

export type LeaseOrBuy = {
  readonly years: Sourced<number>
  /** Rent over the years planned (with the stated yearly increase). */
  readonly leaseCost: Sourced<Money>
  /** Net cost of buying over the years planned: what is paid minus what the space is still worth at the end. */
  readonly buyCost: Sourced<Money>
  /** Cash needed before the keys: down payment + transfer tax + fees. */
  readonly upFront: Sourced<Money>
  readonly price: Sourced<Money>
  readonly monthlyLoanPayment: Sourced<Money>
  readonly cheaper: "lease" | "buy"
  readonly difference: Sourced<Money>
  /** What the comparison had to assume about this lease (for example no stated rent increase). */
  readonly notes: readonly string[]
}

const assumption = (field: string): SourceRef => ({ kind: "assumption", ref: "BUY_ASSUMPTIONS", field })
const round = (n: number) => Math.round(n)

/** The price per m2 for a district of a city, or null when we have no published figure for it. */
export function buyPricePerM2(city: string, district: string): Sourced<number> | null {
  const p = BUY_ASSUMPTIONS.priceEurPerM2
  if (city === "Beograd") {
    const municipality = p.beogradMunicipality[district] !== undefined ? district : p.beogradDistrictToMunicipality[district]
    const value = municipality ? p.beogradMunicipality[municipality] : undefined
    return value === undefined ? null : sourced(value, { ...assumption(`priceEurPerM2.Beograd.${municipality}`), ref: p.source.ref })
  }
  const value = p.city[city]
  return value === undefined ? null : sourced(value, { ...assumption(`priceEurPerM2.${city}`), ref: p.source.ref })
}

/** Monthly annuity payment for a loan (plain formula). */
export function annuityPayment(principal: number, ratePerYear: number, months: number): number {
  const r = ratePerYear / 12
  return r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months)
}

/** What is still owed after `paidMonths` payments. */
export function remainingBalance(principal: number, ratePerYear: number, months: number, paidMonths: number): number {
  if (paidMonths >= months) return 0
  const r = ratePerYear / 12
  const payment = annuityPayment(principal, ratePerYear, months)
  return r === 0 ? principal - payment * paidMonths : principal * (1 + r) ** paidMonths - (payment * ((1 + r) ** paidMonths - 1)) / r
}

/**
 * Compares the rent over the years planned with buying a similar space. MissingData when the area, the price for
 * this part of town or a euro rent is not known: never a guess.
 */
export function leaseOrBuy(input: { terms: LeaseTerms; area: Sourced<AreaM2> | null; city: string; district: string; profile: BusinessProfile }): LeaseOrBuy | MissingData {
  const { terms, area, profile } = input
  if (!area) return missingData("area")
  if (terms.currency !== "EUR") return missingData("price per m2 in this currency")
  const perM2 = buyPricePerM2(input.city, input.district)
  if (!perM2) return missingData(`price per m2 for ${input.district}, ${input.city}`)
  const A = BUY_ASSUMPTIONS
  const years = profile.yearsPlanned()
  const months = years.value * 12
  const notes: string[] = []

  // Lease: the rent month by month, with the yearly increase the lease states (none counted when it states none or nothing).
  const idx = terms.indexationRatePerYear?.value ?? 0
  if (!terms.indexationRatePerYear) notes.push("The lease does not state a yearly rent increase, so none is counted; a real increase makes leasing dearer.")
  let rentTotal = 0
  for (let m = 0; m < months; m++) rentTotal += terms.rentMonthly.value.amount * (1 + idx) ** Math.floor(m / 12)
  const leaseInputs: Sourced<unknown>[] = [terms.rentMonthly, years, ...(terms.indexationRatePerYear ? [terms.indexationRatePerYear] : [])]
  const leaseCost = calc(Money.of(round(rentTotal), "EUR"), "rent x months planned, with the yearly increase", leaseInputs)

  // Buy: price, down payment, loan, taxes and upkeep over the same years; the space keeps its price (assumption).
  const rate = sourced(A.interestRatePerYear.value, { ...assumption("interestRatePerYear"), ref: A.interestRatePerYear.source })
  const down = sourced(A.downPaymentShare.value, assumption("downPaymentShare"))
  const loanYears = sourced(A.loanYears.value, assumption("loanYears"))
  const transfer = sourced(A.transferTaxRate.value, assumption("transferTaxRate"))
  const propertyTax = sourced(A.propertyTaxRatePerYear.value, assumption("propertyTaxRatePerYear"))
  const upkeep = sourced(A.maintenanceRatePerYear.value, assumption("maintenanceRatePerYear"))
  const fees = sourced(A.buyingFeesRate.value, assumption("buyingFeesRate"))
  const cashReturn = sourced(A.cashReturnPerYear.value, { ...assumption("cashReturnPerYear"), ref: A.cashReturnPerYear.source })
  const priceValue = perM2.value * area.value.value
  const price = calc(Money.of(round(priceValue), "EUR"), "price per m2 x area", [perM2, area])
  const loan = priceValue * (1 - down.value)
  const loanMonths = loanYears.value * 12
  const payment = annuityPayment(loan, rate.value, loanMonths)
  const monthlyLoanPayment = calc(Money.of(round(payment), "EUR"), "loan annuity: price x (1 - down payment), interest rate, loan years", [price, down, rate, loanYears])
  const paid = payment * Math.min(months, loanMonths)
  const owed = remainingBalance(loan, rate.value, loanMonths, months)
  const cashIn = priceValue * (down.value + transfer.value + fees.value)
  const netBuy = cashIn + paid + owed + priceValue * (propertyTax.value + upkeep.value) * years.value + cashIn * cashReturn.value * years.value - priceValue
  const buyInputs = [price, down, rate, loanYears, transfer, fees, propertyTax, upkeep, cashReturn, years]
  const buyCost = calc(
    Money.of(round(netBuy), "EUR"),
    "down payment + transfer tax + fees + loan payments + loan still owed + property tax and upkeep per year + what the cash put in could have earned - the price the space is still worth",
    buyInputs,
  )
  const upFront = calc(Money.of(round(cashIn), "EUR"), "price x (down payment + transfer tax + fees)", [price, down, transfer, fees])
  const cheaper = buyCost.value.cents < leaseCost.value.cents ? "buy" : "lease"
  const difference = calc(
    Money.of(Math.abs(round(rentTotal) - round(netBuy)), "EUR"),
    "difference between the rent and the net cost of buying over the years planned",
    [leaseCost, buyCost],
  )
  return Object.freeze({ years, leaseCost, buyCost, upFront, price, monthlyLoanPayment, cheaper, difference, notes: Object.freeze(notes) })
}
