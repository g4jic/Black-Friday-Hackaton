import { RuntimeState } from "@mozaik-ai/core"
import {
  Candidate,
  DomainError,
  createFinding,
  createListingBatch,
  type BusinessProfile,
  type Finding,
  type HardFlag,
  type LeaseClauses,
  type LeaseText,
  type ListingText,
  type ListingTextInput,
  type Requirement,
} from "../domain/index.js"

export type FailedListing = { readonly listingId: string; readonly reason: string; readonly attempts: number }

export type ResearchMode = "A" | "B"

/**
 * The one shared store every participant reads and writes (Mozaik RuntimeState). It keeps itself consistent:
 * every write goes through a domain method that enforces the rules and throws a DomainError when broken.
 */
export class SuiteSpotState extends RuntimeState {
  readonly startedAt = Date.now()
  mode: ResearchMode = "B"
  profile: BusinessProfile | null = null
  requirements: Requirement[] = []
  /** Listing texts of this run, contacts already removed (the raw paste is never stored). */
  readonly listingTexts = new Map<string, ListingText>()
  readonly candidates = new Map<string, Candidate>()
  readonly findings: Finding[] = []
  /** The "failed items" queue: listings the Scout could not turn into a valid candidate. */
  readonly failedListings: FailedListing[] = []
  /** Lease drafts by listing id (optional, one per listing), and what the Lease reader extracted from them. */
  readonly leaseTexts = new Map<string, LeaseText>()
  readonly leaseClauses = new Map<string, LeaseClauses>()
  private readonly leaseWaiters = new Map<string, { promise: Promise<LeaseClauses | null>; resolve: (c: LeaseClauses | null) => void }>()

  /** The questionnaire (a fixed demo file for now; the Interviewer agent comes later). */
  setQuestionnaire(profile: BusinessProfile, requirements: readonly Requirement[]): void {
    this.profile = profile
    this.requirements = [...requirements]
  }

  requireProfile(): BusinessProfile {
    if (!this.profile) throw new DomainError("invalid_input", "The questionnaire is not filled in yet")
    return this.profile
  }

  submitLeases(leases: readonly LeaseText[]): void {
    for (const lease of leases) {
      if (this.leaseTexts.has(lease.listingId)) throw new DomainError("invalid_input", `A lease for "${lease.listingId}" was already submitted`)
      this.leaseTexts.set(lease.listingId, lease)
      let resolve!: (c: LeaseClauses | null) => void
      const promise = new Promise<LeaseClauses | null>((r) => (resolve = r))
      this.leaseWaiters.set(lease.listingId, { promise, resolve })
    }
  }

  hasLease(candidateId: string): boolean {
    return this.leaseTexts.has(candidateId)
  }

  /** The Lease reader's result (null = could not be read). Wakes whoever waits for it. Idempotent. */
  recordLeaseResult(candidateId: string, clauses: LeaseClauses | null): void {
    if (clauses && !this.leaseClauses.has(candidateId)) this.leaseClauses.set(candidateId, clauses)
    this.leaseWaiters.get(candidateId)?.resolve(clauses)
  }

  /** Resolves with the lease clauses once the Lease reader is done; at once with null when there is no lease. */
  waitForLease(candidateId: string): Promise<LeaseClauses | null> {
    return this.leaseWaiters.get(candidateId)?.promise ?? Promise.resolve(null)
  }

  /** Validates the batch (1 to 8 listings) and removes phone numbers and emails before storing anything. */
  submitListings(inputs: readonly ListingTextInput[]): ListingText[] {
    const batch = createListingBatch(inputs)
    for (const t of batch) {
      if (this.listingTexts.has(t.id)) throw new DomainError("invalid_listing_batch", `Listing "${t.id}" was already submitted`)
    }
    for (const t of batch) this.listingTexts.set(t.id, t)
    return batch
  }

  listingText(id: string): ListingText {
    const t = this.listingTexts.get(id)
    if (!t) throw new DomainError("invalid_input", `Unknown listing "${id}"`)
    return t
  }

  recordFailedListing(failed: FailedListing): void {
    if (this.failedListings.some((f) => f.listingId === failed.listingId)) return // idempotent
    this.failedListings.push(failed)
  }

  addCandidate(candidate: Candidate): Candidate {
    const existing = this.candidates.get(candidate.id)
    if (existing) return existing // idempotent: the same listing found twice changes nothing
    this.candidates.set(candidate.id, candidate)
    return candidate
  }

  candidate(id: string): Candidate {
    const c = this.candidates.get(id)
    if (!c) throw new DomainError("invalid_input", `Unknown candidate "${id}"`)
    return c
  }

  /** Validates the finding (source required) before it enters state. Idempotent by finding id. */
  addFinding(input: Finding): Finding {
    const finding = createFinding(input)
    this.candidate(finding.candidateId)
    const existing = this.findings.find((f) => f.id === finding.id)
    if (existing) return existing
    this.findings.push(finding)
    return finding
  }

  /** Returns true if this call cancelled the candidate (first hard flag wins). */
  rejectCandidate(candidateId: string, flag: HardFlag): boolean {
    return this.candidate(candidateId).reject(flag)
  }
}
