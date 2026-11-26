import type { AreaM2 } from "./area.js"
import { DomainError } from "./errors.js"
import { Money, type Currency } from "./money.js"
import { calc, sourced, type Sourced } from "./source.js"

/**
 * Everything we know about the cost side of one lease. null = the source does not state it.
 * Unknowns are never filled with a guess; they are listed so the report can say "check before signing".
 */
export type LeaseTerms = {
  readonly currency: Currency
  readonly rentMonthly: Sourced<Money>
  readonly serviceChargeMonthly: Sourced<Money> | null
  /** VAT on rent as a rate (0.2 = 20%), only if the listing or lease says rent is subject to VAT. */
  readonly vatOnRentRate: Sourced<number> | null
  /** May be an estimate (source kind "estimate") by heating type. */
  readonly utilitiesMonthly: Sourced<Money> | null
  /** Local sign or company tax, only when sourced. */
  readonly localTaxMonthly: Sourced<Money> | null
  readonly deposit: Sourced<Money> | null
  readonly agencyFee: Sourced<Money> | null
  readonly fitOut: Sourced<Money>
  readonly equipment: Sourced<Money>
  readonly termMonths: Sourced<number>
  /** Yearly rent indexation (0.03 = 3%). Applied to rent only. */
  readonly indexationRatePerYear: Sourced<number> | null
  readonly noticeMonths: Sourced<number> | null
  readonly earlyExitPenalty: Sourced<Money> | null
}

export type CostLine = { readonly label: string; readonly amount: Sourced<Money> }
export type CostBreakdown = { readonly total: Sourced<Money>; readonly lines: readonly CostLine[]; readonly unknowns: readonly string[] }

function sum(formula: string, lines: CostLine[], currency: Currency, unknowns: string[]): CostBreakdown {
  if (lines.length === 0) throw new DomainError("invalid_input", `${formula}: nothing to add up`)
  const total = lines.reduce((acc, l) => acc.add(l.amount.value), Money.zero(currency))
  return { total: calc(total, formula, lines.map((l) => l.amount)), lines, unknowns }
}

/** Rent + service charge + VAT on rent + utilities + sourced local taxes, per month. */
export function monthlyCost(t: LeaseTerms): CostBreakdown {
  const lines: CostLine[] = [{ label: "Rent", amount: t.rentMonthly }]
  const unknowns: string[] = []
  if (t.serviceChargeMonthly) lines.push({ label: "Service charge", amount: t.serviceChargeMonthly })
  else unknowns.push("Service charge (building costs) is not stated")
  if (t.vatOnRentRate) {
    lines.push({
      label: "VAT on rent",
      amount: calc(t.rentMonthly.value.multiply(t.vatOnRentRate.value), "rent x VAT rate", [t.rentMonthly, t.vatOnRentRate]),
    })
  } else unknowns.push("Whether VAT is charged on top of the rent")
  if (t.utilitiesMonthly) lines.push({ label: "Utilities", amount: t.utilitiesMonthly })
  else unknowns.push("Utilities cost")
  if (t.localTaxMonthly) lines.push({ label: "Local taxes", amount: t.localTaxMonthly })
  return sum("sum of monthly cost lines", lines, t.currency, unknowns)
}

/** Money needed before opening: deposit, agency fee, fit-out, equipment. */
export function initialCosts(t: LeaseTerms): CostBreakdown {
  const lines: CostLine[] = []
  const unknowns: string[] = []
  if (t.deposit) lines.push({ label: "Deposit (refundable)", amount: t.deposit })
  else unknowns.push("Deposit amount")
  if (t.agencyFee) lines.push({ label: "Agency fee", amount: t.agencyFee })
  else unknowns.push("Agency fee")
  lines.push({ label: "Fit-out", amount: t.fitOut }, { label: "Equipment", amount: t.equipment })
  return sum("sum of initial cost lines", lines, t.currency, unknowns)
}

/**
 * Total cost of occupancy over the whole term: monthly costs with yearly rent indexation, plus the non-refundable
 * initial costs (agency fee, fit-out, equipment). The deposit is excluded because it is refundable.
 */
export function totalCostOverTerm(t: LeaseTerms): CostBreakdown {
  const monthly = monthlyCost(t)
  const months = t.termMonths.value
  if (!Number.isInteger(months) || months < 1) throw new DomainError("invalid_input", "Lease term must be at least one month")
  const idx = t.indexationRatePerYear?.value ?? 0
  const rent = t.rentMonthly.value
  let indexedRent = Money.zero(t.currency)
  for (let m = 0; m < months; m++) indexedRent = indexedRent.add(rent.multiply((1 + idx) ** Math.floor(m / 12)))
  const otherMonthly = monthly.total.value.subtract(rent)
  const lines: CostLine[] = [
    {
      label: "Rent over the term (with indexation)",
      amount: calc(indexedRent, "sum over months of rent x (1 + indexation)^year", [t.rentMonthly, t.termMonths, ...(t.indexationRatePerYear ? [t.indexationRatePerYear] : [])]),
    },
    { label: "Other monthly costs over the term", amount: calc(otherMonthly.multiply(months), "(monthly cost - rent) x months", [monthly.total, t.termMonths]) },
  ]
  if (t.agencyFee) lines.push({ label: "Agency fee", amount: t.agencyFee })
  lines.push({ label: "Fit-out", amount: t.fitOut }, { label: "Equipment", amount: t.equipment })
  const unknowns = [...monthly.unknowns]
  if (!t.indexationRatePerYear) unknowns.push("Rent indexation clause (assumed none)")
  if (!t.agencyFee) unknowns.push("Agency fee")
  return sum("total cost of occupancy over the term", lines, t.currency, unknowns)
}

/**
 * What it costs to walk away after `monthsUsed` months: rent for the notice period, any penalty, and the part of
 * the fit-out not yet used up (straight line over the term). Equipment is assumed to move with the business.
 */
export function exitCostAfter(t: LeaseTerms, monthsUsed = 12): CostBreakdown {
  const months = t.termMonths.value
  const lines: CostLine[] = []
  const unknowns: string[] = ["Whether the deposit is returned on early exit"]
  const monthly = monthlyCost(t).total
  if (t.noticeMonths) {
    lines.push({ label: "Cost during notice period", amount: calc(monthly.value.multiply(t.noticeMonths.value), "monthly cost x notice months", [monthly, t.noticeMonths]) })
  } else unknowns.push("Notice period for early exit")
  if (t.earlyExitPenalty) lines.push({ label: "Early exit penalty", amount: t.earlyExitPenalty })
  else unknowns.push("Early exit penalty")
  const remaining = Math.max(0, months - monthsUsed) / months
  lines.push({
    label: "Unrecovered fit-out",
    amount: calc(t.fitOut.value.multiply(remaining), `fit-out x (term - ${monthsUsed}) / term`, [t.fitOut, t.termMonths]),
  })
  return sum(`exit cost after ${monthsUsed} months`, lines, t.currency, unknowns)
}

/** Monthly occupancy cost as a share of expected revenue (0.15 = 15%). */
export function costShareOfRevenue(monthlyTotal: Sourced<Money>, revenue: Sourced<Money>): Sourced<number> {
  if (revenue.value.cents <= 0) throw new DomainError("invalid_input", "Expected revenue must be positive to compute the rent share")
  return calc(monthlyTotal.value.ratioTo(revenue.value), "monthly cost / expected monthly revenue", [monthlyTotal, revenue])
}

/**
 * A figure we cannot compute because an input is missing. Shown as "missing data" in the report, never estimated.
 */
export type MissingData = { readonly status: "missing_data"; readonly missing: readonly string[] }

export function isMissingData(x: unknown): x is MissingData {
  return typeof x === "object" && x !== null && (x as MissingData).status === "missing_data"
}

const MISSING_MARGIN: MissingData = Object.freeze({ status: "missing_data", missing: Object.freeze(["Gross margin (optional in the questionnaire)"]) })

/**
 * Monthly revenue needed just to cover the space: monthly cost / gross margin.
 * The gross margin is optional; without it this returns MissingData instead of a number.
 */
export function breakEvenRevenue(monthlyTotal: Sourced<Money>, grossMargin: Sourced<number> | null): Sourced<Money> | MissingData {
  if (grossMargin === null) return MISSING_MARGIN
  if (!(grossMargin.value > 0)) throw new DomainError("invalid_input", "Gross margin must be positive")
  return calc(monthlyTotal.value.multiply(1 / grossMargin.value), "monthly cost / gross margin", [monthlyTotal, grossMargin])
}

/**
 * Months until the initial (non-refundable) costs are earned back: initial / (revenue x margin - monthly cost).
 * A null value means it never pays back at the expected revenue. Without a gross margin: MissingData.
 */
export function paybackMonths(
  initialNonRefundable: Sourced<Money>,
  revenue: Sourced<Money>,
  grossMargin: Sourced<number> | null,
  monthlyTotal: Sourced<Money>,
): Sourced<number | null> | MissingData {
  if (grossMargin === null) return MISSING_MARGIN
  const contribution = revenue.value.multiply(grossMargin.value).subtract(monthlyTotal.value)
  const inputs = [initialNonRefundable, revenue, grossMargin, monthlyTotal]
  if (contribution.cents <= 0) return calc(null, "never: revenue x margin does not cover the monthly cost", inputs)
  return calc(Math.ceil(initialNonRefundable.value.cents / contribution.cents), "initial costs / (revenue x margin - monthly cost)", inputs)
}

export function rentPerM2(rent: Sourced<Money>, area: Sourced<AreaM2>): Sourced<number> {
  return calc(Math.round((rent.value.amount / area.value.value) * 100) / 100, "rent / area", [rent, area])
}

export type FairPriceResult =
  | { readonly status: "not_enough_data"; readonly comparables: number }
  | {
      readonly status: "ok"
      readonly verdict: "below" | "within" | "above"
      readonly range: Sourced<{ low: number; median: number; high: number }>
      readonly comparables: number
    }

export const MIN_COMPARABLES = 3

/**
 * Compares the rent per m2 with comparable listings. The range is the interquartile range (25th to 75th percentile)
 * of the comparables. Fewer than 3 comparables: no estimate.
 */
export function fairPriceCheck(subject: Sourced<number>, comparables: readonly Sourced<number>[]): FairPriceResult {
  if (comparables.length < MIN_COMPARABLES) return { status: "not_enough_data", comparables: comparables.length }
  const values = comparables.map((c) => c.value).sort((a, b) => a - b)
  const low = round2(quantile(values, 0.25))
  const median = round2(quantile(values, 0.5))
  const high = round2(quantile(values, 0.75))
  const verdict = subject.value < low ? "below" : subject.value > high ? "above" : "within"
  const range = sourced(
    { low, median, high },
    { kind: "estimate", ref: `interquartile range of ${comparables.length} comparable listings (rent per m2)`, inputs: comparables.map((c) => c.source) },
  )
  return { status: "ok", verdict, range, comparables: comparables.length }
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const next = sorted[base + 1]
  const cur = sorted[base] as number
  return next === undefined ? cur : cur + (pos - base) * (next - cur)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
