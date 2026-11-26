import { SemanticEvent } from "@mozaik-ai/core"
import { evaluateLease, type CatalogueCandidate } from "../../domain/index.js"
import { rejectCandidate } from "../cancellation/candidate-cancellation.js"
import type { AppRuntime } from "../runtime.js"
import { missingFields } from "./scout.js"

/** Who raises a flag found in the listing form (plain code, not an agent). */
export const FORM_CHECK_NAME = "Listing form check"

/**
 * Entry point for SuiteSpot listings ("Find spaces" and "Evaluate for my business"). They are structured already,
 * so plain code adds them as candidates and announces each with candidate.found, the same event the Scout publishes
 * for a pasted text. The Finance analyst and the Lease reader notice it; nobody calls them.
 *
 * A listing without a lease draft has nothing for the Lease reader, so code applies the same lease rules to the terms
 * the landlord typed in the form. Those terms also become the lease terms Finance and the Ranker use. A deal breaker
 * rejects the candidate at once; any loop that already started on it stops at its next breakpoint.
 */
export function submitCatalogueListings(rt: AppRuntime, entries: readonly CatalogueCandidate[], producerId: string): void {
  rt.sendEvent(SemanticEvent.create("catalogue.matched", producerId, { listingIds: entries.map((e) => e.listing.ref) }), producerId)
  for (const { listing, formTerms } of entries) {
    const candidate = rt.state.addCatalogueCandidate(listing)
    const fromForm = !rt.state.hasLease(candidate.id)
    if (fromForm) rt.state.recordLeaseResult(candidate.id, formTerms)
    rt.sendEvent(
      SemanticEvent.create("candidate.found", producerId, { candidateId: candidate.id, listingRef: listing.ref, synthetic: listing.synthetic, missing: missingFields(listing), unverified: listing.unverified }),
      producerId,
    )
    if (!fromForm) continue
    const { hardFlags, concerns } = evaluateLease(formTerms, FORM_CHECK_NAME)
    for (const c of concerns) {
      rt.state.addFinding({ id: `${candidate.id}:form:concern:${c.rule}`, candidateId: candidate.id, aspect: "lease", severity: "soft", claim: c.claim, source: c.source, author: FORM_CHECK_NAME, checkBeforeSigning: c.checkBeforeSigning })
    }
    for (const flag of hardFlags) {
      rt.state.addFinding({ id: `${candidate.id}:form:hard:${flag.rule}`, candidateId: candidate.id, aspect: "lease", severity: "hard", claim: flag.reason, source: flag.source, author: FORM_CHECK_NAME })
      rejectCandidate(rt, candidate.id, flag, producerId)
    }
  }
}
