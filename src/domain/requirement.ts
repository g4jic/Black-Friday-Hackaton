import { DomainError } from "./errors.js"
import { validateSource, type SourceRef } from "./source.js"

export type Aspect = "premises" | "location" | "lease" | "finance"
export const ASPECTS: readonly Aspect[] = ["premises", "location", "lease", "finance"]

/** A need of this business, written by the Interviewer from the profile. Hard = deal breaker if definitely not met. */
export type Requirement = {
  readonly id: string
  readonly text: string
  readonly hard: boolean
  readonly aspect: Aspect
  readonly source: SourceRef
}

export function createRequirement(input: Requirement): Requirement {
  if (!input.id?.trim()) throw new DomainError("invalid_requirement", "Requirement id is required")
  if (!input.text?.trim()) throw new DomainError("invalid_requirement", "Requirement text is required")
  if (!ASPECTS.includes(input.aspect)) throw new DomainError("invalid_requirement", `Unknown aspect "${input.aspect}"`)
  return Object.freeze({ ...input, source: validateSource(input.source) })
}
