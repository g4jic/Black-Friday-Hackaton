import { AreaM2 } from "./area.js"
import { BUDGET_TOLERANCE } from "./hard-flags.js"
import { createLeaseText, type LeaseClauses, type LeaseText } from "./lease.js"
import type { Listing } from "./listing-extraction.js"
import { MAX_LISTINGS } from "./listing-text.js"
import { missingData } from "./missing.js"
import { Money } from "./money.js"
import type { BusinessProfile } from "./profile.js"
import { sourced, type SourceRef } from "./source.js"
import { floorLabel, type SpaceListing } from "./space-listing.js"

/**
 * SuiteSpot listings as research candidates. A listing on SuiteSpot is already structured (the landlord filled in a
 * form with rules in code), so no agent reads it: code turns each form field into a sourced value
 * ({ kind: "listing", ref: "listing-ns014", field, form: true }). Only the lease draft, which is free text, goes to
 * the Lease reader.
 */

const USE_TEXT = { cafe_food: "cafe or food", retail: "retail shop", office_studio: "office or studio", workshop: "small workshop" } as const

/** Plain-text summary of the form, for the agents that read a listing's text (never contact data: it is not here). */
function summary(p: SpaceListing["props"]): string {
  const exit = p.earlyTermination.allowed ? `yes, with ${p.earlyTermination.noticeMonths} months notice` : "no"
  const ix = p.indexation
  const indexation = ix.kind === "fixed_rate" ? `fixed ${ix.ratePercent}% a year` : ix.kind === "cpi" ? "by the consumer price index" : ix.kind === "none" ? "none" : "the landlord may raise the rent at will"
  return [
    `SuiteSpot listing (structured form filled in by the landlord)${p.isDemo ? ", SYNTHETIC DEMO LISTING" : ""}`,
    `Title: ${p.title}`,
    `Location: ${p.district}, ${p.street}, ${p.city}`,
    `Area: ${p.areaM2} m2, ${floorLabel(p.floor)}`,
    `Monthly rent: ${p.rentMonthly} EUR; monthly costs: ${p.serviceChargeMonthly} EUR; deposit: ${p.deposit} EUR`,
    `Minimum lease term: ${p.minimumTermMonths} months; tenant may end early: ${exit}; rent increases: ${indexation}`,
    `Permitted use: ${p.permittedUses.map((u) => USE_TEXT[u]).join(", ")}; structural repairs paid by: ${p.tenantPaysStructuralRepairs ? "the tenant" : "the landlord"}`,
    ...(p.description ? [`Description: ${p.description}`] : []),
  ].join("\n")
}

/** A SuiteSpot listing as a Listing: every value comes from a form field (heating and parking are not on the form). */
export function listingFromSpaceListing(space: SpaceListing): Listing {
  const p = space.props
  const from = (field: string): SourceRef => ({ kind: "listing", ref: space.id, field, form: true })
  const eur = (amount: number) => Money.of(amount, "EUR")
  return Object.freeze({
    ref: space.id,
    text: summary(p),
    synthetic: p.isDemo,
    url: null,
    title: sourced(p.title, from("title")),
    kind: sourced("rent" as const, from("kind")),
    city: sourced(p.city, from("city")),
    address: sourced(`${p.district}, ${p.street}`, from("address")),
    rentMonthly: sourced(eur(p.rentMonthly), from("rentMonthly")),
    area: sourced(AreaM2.of(p.areaM2), from("areaM2")),
    deposit: sourced(eur(p.deposit), from("deposit")),
    serviceChargeMonthly: sourced(eur(p.serviceChargeMonthly), from("serviceChargeMonthly")),
    floor: sourced(floorLabel(p.floor), from("floor")),
    heating: missingData("heating"),
    parking: missingData("parking"),
    unverified: [],
  })
}

/** The landlord's lease draft as a lease text for the Lease reader, or null when the listing has none. */
export function leaseTextOf(space: SpaceListing): LeaseText | null {
  const draft = space.props.leaseDraft
  return draft && draft.trim() ? createLeaseText(space.id, draft, space.props.isDemo) : null
}

/**
 * "Find spaces": the published listings that fit the questionnaire. Same city, area inside the range, the use the
 * business needs, and rent plus monthly costs within the budget plus the budget tolerance (the same tolerance as the
 * budget hard flag). At most MAX_LISTINGS, closest to the budget first, then by id (deterministic).
 */
export function matchListings(listings: readonly SpaceListing[], profile: BusinessProfile): SpaceListing[] {
  const q = profile.input
  const limit = q.monthlyBudget * (1 + BUDGET_TOLERANCE)
  const monthly = (l: SpaceListing) => l.props.rentMonthly + l.props.serviceChargeMonthly
  return listings
    .filter((l) => l.props.published)
    .filter((l) => l.props.city.toLowerCase() === q.city.trim().toLowerCase())
    .filter((l) => l.props.areaM2 >= q.areaMinM2 && l.props.areaM2 <= q.areaMaxM2)
    .filter((l) => l.props.permittedUses.includes(q.businessType))
    .filter((l) => monthly(l) <= limit)
    .sort((a, b) => Math.abs(monthly(a) - q.monthlyBudget) - Math.abs(monthly(b) - q.monthlyBudget) || a.id.localeCompare(b.id))
    .slice(0, MAX_LISTINGS)
}

/**
 * The lease terms the landlord typed in the form, as LeaseClauses with form sources. Used when the listing has no
 * lease draft: the same lease rules (evaluateLease) then run on the form, so a locked-in lease or an unlimited rent
 * increase is caught even without a draft. A guarantee or an exit penalty is not on the form: missing, never guessed.
 */
export function formLeaseTerms(space: SpaceListing): LeaseClauses {
  const p = space.props
  const from = (field: string): SourceRef => ({ kind: "listing", ref: space.id, field, form: true })
  const exit = p.earlyTermination
  const ix = p.indexation
  return Object.freeze({
    leaseId: `form-${space.id}`,
    listingId: space.id,
    term: sourced(p.minimumTermMonths, from("minimumTermMonths")),
    tenantMayTerminateEarly: sourced(exit.allowed, from("earlyTermination")),
    noticePeriod: exit.allowed ? sourced(exit.noticeMonths, from("earlyTermination.noticeMonths")) : missingData("noticePeriod"),
    earlyExitPenalty: missingData("earlyExitPenalty"),
    indexationKind: sourced(ix.kind, from("indexation")),
    indexationRatePercent: ix.kind === "fixed_rate" ? sourced(ix.ratePercent, from("indexation.ratePercent")) : missingData("indexationRatePercent"),
    deposit: sourced(Money.of(p.deposit, "EUR"), from("deposit")),
    personalGuarantee: missingData("personalGuarantee"),
    tenantPaysStructuralRepairs: sourced(p.tenantPaysStructuralRepairs, from("tenantPaysStructuralRepairs")),
    permittedUse: sourced(p.permittedUses.map((u) => USE_TEXT[u]).join(", "), from("permittedUses")),
    unverified: [],
  })
}

/** One SuiteSpot listing ready for a research run: the candidate's listing and the lease terms from the form. */
export type CatalogueCandidate = { readonly listing: Listing; readonly formTerms: LeaseClauses }

export function catalogueCandidate(space: SpaceListing): CatalogueCandidate {
  return { listing: listingFromSpaceListing(space), formTerms: formLeaseTerms(space) }
}
