import type { HardFlag } from "./candidate.js"
import { DomainError } from "./errors.js"
import { redactContacts } from "./listing-text.js"
import { isMissingData, type MissingData } from "./missing.js"
import { Money } from "./money.js"
import { extractQuotedFields, isRentMultiple, type QuotedFieldSpec, type RentMultiple, type UnverifiedField } from "./quoted-extraction.js"
import type { SourceRef, Sourced } from "./source.js"

/** A lease draft for one candidate, contacts removed. Id is "lease-<listing id>". */
export type LeaseText = { readonly id: string; readonly listingId: string; readonly text: string; readonly synthetic: boolean }

export function createLeaseText(listingId: string, raw: string, synthetic: boolean): LeaseText {
  if (!raw.trim()) throw new DomainError("invalid_input", `Lease for ${listingId} is empty`)
  return Object.freeze({ id: `lease-${listingId}`, listingId, text: redactContacts(raw).text.trim(), synthetic })
}

export type IndexationKind = "none" | "fixed_rate" | "cpi" | "landlord_unilateral"

const moneyOrRent = { kind: "money", rentMultiple: true } as const
const bool = { kind: "boolean" } as const
const duration = { kind: "duration" } as const

/** The clauses the Lease reader extracts. Severity is never part of the answer: code decides it below. */
export const LEASE_FIELDS = [
  { name: "term", type: duration, what: "length of the lease (value and unit as written)" },
  { name: "tenantMayTerminateEarly", type: bool, what: "may the tenant end the lease before the term ends" },
  { name: "noticePeriod", type: duration, what: "notice the tenant must give to end the lease early" },
  { name: "earlyExitPenalty", type: moneyOrRent, what: "penalty for ending early: an amount, or a number of months of rent" },
  { name: "indexationKind", type: { kind: "enum", values: ["none", "fixed_rate", "cpi", "landlord_unilateral"] }, what: "how the rent can rise: none, a fixed yearly rate, by the consumer price index, or at the landlord's discretion" },
  { name: "indexationRatePercent", type: { kind: "number" }, what: "yearly rent increase in percent, only if a fixed rate is stated" },
  { name: "deposit", type: moneyOrRent, what: "deposit: an amount, or a number of months of rent" },
  { name: "personalGuarantee", type: bool, what: "must a person (for example the director) personally guarantee the rent" },
  { name: "tenantPaysStructuralRepairs", type: bool, what: "must the tenant pay for structural repairs (roof, walls, installations)" },
  { name: "permittedUse", type: { kind: "text" }, what: "the use of the premises the lease allows" },
] as const satisfies readonly QuotedFieldSpec[]

type F<T> = Sourced<T> | MissingData

export type LeaseClauses = {
  readonly leaseId: string
  readonly listingId: string
  /** Months (code converted years to months). */
  readonly term: F<number>
  readonly tenantMayTerminateEarly: F<boolean>
  readonly noticePeriod: F<number>
  /** An amount, or months of rent (code turns it into an amount with the listing's rent). */
  readonly earlyExitPenalty: F<Money | RentMultiple>
  readonly indexationKind: F<IndexationKind>
  readonly indexationRatePercent: F<number>
  readonly deposit: F<Money | RentMultiple>
  readonly personalGuarantee: F<boolean>
  readonly tenantPaysStructuralRepairs: F<boolean>
  readonly permittedUse: F<string>
  /** Clauses the Lease reader stated but code could not verify (MissingData, "check before signing"). */
  readonly unverified: readonly UnverifiedField[]
}

/** Checks the Lease reader's answer against the lease text (same rules as the Scout; partial on the last attempt). */
export function buildLease(lease: LeaseText, answer: unknown, options: { partial?: boolean } = {}): LeaseClauses {
  const { fields, unverified } = extractQuotedFields(lease.text, LEASE_FIELDS, answer, {
    textId: lease.id,
    sourceFor: (clause, quote) => ({ kind: "lease", ref: lease.id, clause, quote }),
    partial: options.partial,
  })
  return Object.freeze({ leaseId: lease.id, listingId: lease.listingId, ...fields, unverified }) as unknown as LeaseClauses
}

/** A clause worth checking before signing (a soft flag). Never a legal verdict. */
export type LeaseConcern = { readonly rule: string; readonly claim: string; readonly checkBeforeSigning: string; readonly source: SourceRef }

export const MAX_TERM_WITHOUT_EXIT_MONTHS = 36
export const MAX_NOTICE_MONTHS = 3
export const MAX_FIXED_INDEXATION_PERCENT = 5

const found = <T>(f: F<T>): Sourced<T> | null => (isMissingData(f) ? null : f)

/**
 * Lease rules, decided in code. The model only reports what each clause says (with a quote); these rules decide
 * what is a deal breaker (hard flag, cancels the candidate) and what to check before signing (soft flag).
 */
export function evaluateLease(lease: LeaseClauses, raisedBy: string): { hardFlags: HardFlag[]; concerns: LeaseConcern[] } {
  const hardFlags: HardFlag[] = []
  const concerns: LeaseConcern[] = []
  const term = found(lease.term)
  const mayExit = found(lease.tenantMayTerminateEarly)
  const indexation = found(lease.indexationKind)

  if (mayExit && mayExit.value === false && (!term || term.value > MAX_TERM_WITHOUT_EXIT_MONTHS)) {
    hardFlags.push({
      aspect: "lease",
      rule: "locked_in_without_exit",
      reason: term
        ? `The tenant cannot end the lease early, and the term is ${term.value} months (more than ${MAX_TERM_WITHOUT_EXIT_MONTHS})`
        : "The tenant cannot end the lease early, and the term is not stated",
      raisedBy,
      source: mayExit.source,
    })
  }
  if (indexation?.value === "landlord_unilateral") {
    hardFlags.push({
      aspect: "lease",
      rule: "unlimited_rent_increase",
      reason: "The landlord may raise the rent at will, with no limit",
      raisedBy,
      source: indexation.source,
    })
  }

  const guarantee = found(lease.personalGuarantee)
  if (guarantee?.value) {
    concerns.push({ rule: "personal_guarantee", claim: "A person must personally guarantee the rent", checkBeforeSigning: "who signs the personal guarantee and up to what amount", source: guarantee.source })
  }
  const repairs = found(lease.tenantPaysStructuralRepairs)
  if (repairs?.value) {
    concerns.push({ rule: "tenant_pays_structural_repairs", claim: "The tenant pays for structural repairs", checkBeforeSigning: "which repairs are the tenant's and whether the cost is capped", source: repairs.source })
  }
  const notice = found(lease.noticePeriod)
  if (notice && notice.value > MAX_NOTICE_MONTHS) {
    concerns.push({ rule: "long_notice", claim: `Early exit needs ${notice.value} months' notice`, checkBeforeSigning: "whether the notice period can be shortened", source: notice.source })
  }
  const rate = found(lease.indexationRatePercent)
  if (indexation?.value === "fixed_rate" && rate && rate.value > MAX_FIXED_INDEXATION_PERCENT) {
    concerns.push({ rule: "high_indexation", claim: `Rent rises ${rate.value}% a year`, checkBeforeSigning: "whether the yearly increase can be tied to inflation instead", source: rate.source })
  }
  const penalty = found(lease.earlyExitPenalty)
  if (penalty) {
    const amount = isRentMultiple(penalty.value) ? `${penalty.value.monthsOfRent} month(s) of rent` : String(penalty.value)
    concerns.push({ rule: "early_exit_penalty", claim: `Early exit penalty of ${amount}`, checkBeforeSigning: "when exactly the penalty applies", source: penalty.source })
  }
  // A clause the reader reported but code could not verify is never used as a fact: it is a question to check.
  for (const u of lease.unverified) {
    const what = clauseInWords(u.field)
    concerns.push({
      rule: `unverified_${u.field}`,
      claim: `SuiteSpot could not confirm what the lease says about ${what}: ${plainReason(u.reason)}`,
      checkBeforeSigning: `what the lease says about ${what}`,
      source: { kind: "lease", ref: lease.leaseId, clause: u.field },
    })
  }
  return { hardFlags, concerns }
}

/** A lease field name (in any letter case) in plain words, for messages; never the internal name on screen. */
function clauseInWords(field: string): string {
  const spec = LEASE_FIELDS.find((f) => f.name.toLowerCase() === field.toLowerCase())
  return spec ? spec.what.split(":")[0]!.split(" (")[0]! : "this clause"
}

/** Why a reader answer was not used, in plain words (the technical reason stays in the trace). */
function plainReason(reason: string): string {
  if (/does not appear/i.test(reason)) return "the words the reader quoted are not in the lease text"
  if (/missing|no quote/i.test(reason)) return "the reader gave no quote from the lease"
  return "the answer could not be checked against the lease text"
}

/** Each rent increase kind in plain words (never the internal enum value on screen). */
export const INDEXATION_TEXT: Record<IndexationKind, string> = {
  none: "no increase during the lease",
  cpi: "follows the consumer price index",
  fixed_rate: "a fixed increase every year",
  landlord_unilateral: "the landlord may raise it at will, with no limit",
}

const CLAUSE_LABEL: Record<(typeof LEASE_FIELDS)[number]["name"], string> = {
  term: "Lease term",
  tenantMayTerminateEarly: "Tenant may end the lease early",
  noticePeriod: "Notice for early exit",
  earlyExitPenalty: "Early exit penalty",
  indexationKind: "Rent increases",
  indexationRatePercent: "Yearly rent increase",
  deposit: "Deposit",
  personalGuarantee: "Personal guarantee required",
  tenantPaysStructuralRepairs: "Tenant pays structural repairs",
  permittedUse: "Permitted use (check before signing, not a legal opinion)",
}

const wholeMoney = (m: Money) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(m.amount))} ${m.currency}`

/** One plain sentence per clause that is stated, with its value in words: "Rent increases: follows the consumer price index". */
export function leaseClauseClaims(clauses: LeaseClauses): { name: (typeof LEASE_FIELDS)[number]["name"]; claim: string; field: Sourced<unknown> }[] {
  const out: { name: (typeof LEASE_FIELDS)[number]["name"]; claim: string; field: Sourced<unknown> }[] = []
  for (const spec of LEASE_FIELDS) {
    const field = clauses[spec.name] as Sourced<unknown> | MissingData
    if (isMissingData(field)) continue
    const v = field.value
    const text =
      spec.name === "term" || spec.name === "noticePeriod"
        ? `${v} months`
        : spec.name === "indexationKind"
          ? INDEXATION_TEXT[v as IndexationKind]
          : spec.name === "indexationRatePercent"
            ? `${v}%`
            : typeof v === "boolean"
              ? v
                ? "yes"
                : "no"
              : isRentMultiple(v)
                ? `${v.monthsOfRent} month(s) of rent (amount computed by code)`
                : v instanceof Money
                  ? wholeMoney(v)
                  : String(v)
    out.push({ name: spec.name, claim: `${CLAUSE_LABEL[spec.name]}: ${text}`, field: field as Sourced<unknown> })
  }
  return out
}
