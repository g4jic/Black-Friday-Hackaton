/**
 * A broken business rule. Thrown by domain methods; when an agent's tool hits one, Mozaik hands the message
 * back to the model as the tool result, so the agent can read it and adapt (feedback, not a crash).
 */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "DomainError"
  }
}

export type DomainErrorCode =
  | "invalid_money"
  | "currency_mismatch"
  | "invalid_area"
  | "invalid_source"
  | "finding_without_source"
  | "invalid_finding"
  | "invalid_profile"
  | "invalid_requirement"
  | "invalid_transition"
  | "invalid_input"
  | "invalid_listing_batch"
  | "invalid_listing_url"
  | "invalid_extraction"
  | "value_without_source"
  | "invalid_listing"
  | "not_listing_owner"
  | "listing_not_found"
