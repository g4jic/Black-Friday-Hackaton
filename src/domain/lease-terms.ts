import type { LeaseClauses } from "./lease.js"
import type { LeaseTerms } from "./lease-cost.js"
import type { Listing } from "./listing-extraction.js"
import { isMissingData, missingData, type MissingData } from "./missing.js"
import type { Money } from "./money.js"
import { amountFromRentMultiple, isRentMultiple, type RentMultiple } from "./quoted-extraction.js"
import type { BusinessProfile } from "./profile.js"
import { calc, type Sourced } from "./source.js"

const found = <T>(f: Sourced<T> | MissingData | undefined): Sourced<T> | null => (f === undefined || isMissingData(f) ? null : f)

/**
 * Puts together the inputs of the lease cost calculator for one candidate, every one with its source:
 * rent and service charge from the listing, term, notice, indexation and penalty from the lease (when there is one),
 * fit-out and equipment budgets from the questionnaire. No rent: MissingData, nothing is computed.
 * Values the sources do not state stay null and show up as "unknowns" in the results.
 */
export function leaseTermsFor(listing: Listing, profile: BusinessProfile, lease: LeaseClauses | null): LeaseTerms | MissingData {
  const rent = found(listing.rentMonthly)
  if (!rent) return missingData("rentMonthly")
  // "N months of rent" in the lease becomes an amount here, computed by code from the listing's sourced rent.
  const amount = (field: string, f: Sourced<Money | RentMultiple> | MissingData | undefined): Sourced<Money> | null => {
    const v = found(f)
    if (!v) return null
    if (!isRentMultiple(v.value)) return v as Sourced<Money>
    return found(amountFromRentMultiple(field, v as Sourced<RentMultiple>, rent))
  }
  const rate = found(lease?.indexationRatePercent)
  const kind = found(lease?.indexationKind)
  const indexation =
    kind?.value === "fixed_rate" && rate ? calc(rate.value / 100, "indexation percent / 100", [rate]) : kind?.value === "none" ? calc(0, "no indexation clause", [kind]) : null
  return {
    currency: rent.value.currency,
    rentMonthly: rent,
    serviceChargeMonthly: found(listing.serviceChargeMonthly),
    vatOnRentRate: null,
    utilitiesMonthly: null,
    localTaxMonthly: null,
    deposit: amount("deposit", lease?.deposit) ?? found(listing.deposit),
    agencyFee: null,
    fitOut: profile.money("fitOutBudget"),
    equipment: profile.money("equipmentBudget"),
    termMonths: found(lease?.term) ?? profile.leaseMonths(),
    indexationRatePerYear: indexation,
    noticeMonths: found(lease?.noticePeriod),
    earlyExitPenalty: amount("earlyExitPenalty", lease?.earlyExitPenalty),
  }
}
