import type { AreaM2 } from "./area.js"
import { DomainError } from "./errors.js"
import type { Money } from "./money.js"
import type { Aspect } from "./requirement.js"
import { validateSource, type SourceRef, type Sourced } from "./source.js"

/** Listing values as found on the public page. A value the page does not state stays null, never a guess. */
export type Listing = {
  readonly url: string
  readonly title: string
  readonly rentMonthly: Sourced<Money> | null
  readonly area: Sourced<AreaM2> | null
  readonly deposit: Sourced<Money> | null
  readonly serviceChargeMonthly: Sourced<Money> | null
  readonly description: string
  readonly updatedAt: string | null
  readonly synthetic: boolean
}

export type CandidateStatus = "pending" | "evaluating" | "rejected" | "scored"

/** Why a candidate was cancelled. Decided by code, never by the model. */
export type HardFlag = {
  readonly aspect: Aspect
  readonly rule: string
  readonly reason: string
  readonly raisedBy: string
  readonly source: SourceRef
}

/**
 * A space under evaluation. Status machine: pending -> evaluating -> scored, and any non-final state -> rejected.
 * reject() is idempotent: the first flag wins, later flags are recorded but do not change the outcome.
 */
export class Candidate {
  private _status: CandidateStatus = "pending"
  private _rejection: HardFlag | null = null
  private readonly _laterFlags: HardFlag[] = []
  private _score: number | null = null
  private readonly abort = new AbortController()

  constructor(
    readonly id: string,
    readonly listing: Listing,
  ) {
    if (!id.trim()) throw new DomainError("invalid_input", "Candidate id is required")
  }

  get status(): CandidateStatus {
    return this._status
  }

  get rejection(): HardFlag | null {
    return this._rejection
  }

  get laterFlags(): readonly HardFlag[] {
    return this._laterFlags
  }

  get score(): number | null {
    return this._score
  }

  /** Aborted the moment the candidate is rejected; tools in flight listen to it. */
  get signal(): AbortSignal {
    return this.abort.signal
  }

  isRejected(): boolean {
    return this._status === "rejected"
  }

  startEvaluation(): void {
    if (this._status === "evaluating") return
    if (this._status !== "pending") throw new DomainError("invalid_transition", `Cannot start evaluating a ${this._status} candidate`)
    this._status = "evaluating"
  }

  /** Returns true if this call rejected the candidate, false if it was already rejected (idempotent). */
  reject(flag: HardFlag): boolean {
    validateSource(flag.source)
    if (this._status === "rejected") {
      this._laterFlags.push(flag)
      return false
    }
    if (this._status === "scored") throw new DomainError("invalid_transition", "Cannot reject a candidate that is already scored")
    this._status = "rejected"
    this._rejection = flag
    this.abort.abort(flag)
    return true
  }

  markScored(score: number): void {
    if (this._status === "rejected") throw new DomainError("invalid_transition", "A rejected candidate cannot be scored")
    if (this._status !== "evaluating") throw new DomainError("invalid_transition", `Cannot score a ${this._status} candidate`)
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new DomainError("invalid_input", "Score must be between 0 and 100")
    this._status = "scored"
    this._score = score
  }
}
