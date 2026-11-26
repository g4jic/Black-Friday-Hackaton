import { DomainError } from "./errors.js"
import { ASPECTS, type Aspect } from "./requirement.js"
import { validateSource, type SourceRef } from "./source.js"

export type Severity = "hard" | "soft" | "info"
const SEVERITIES: readonly Severity[] = ["hard", "soft", "info"]

/** One claim about one candidate. It cannot exist without a valid source. */
export type Finding = {
  readonly id: string
  readonly candidateId: string
  readonly aspect: Aspect
  readonly severity: Severity
  readonly claim: string
  readonly value?: unknown
  readonly source: SourceRef
  /** Participant that wrote it, so the Auditor can send a rejected finding back to its author. */
  readonly author: string
  /** For "check before signing" items: what exactly to check. Never a legal verdict. */
  readonly checkBeforeSigning?: string
}

export function createFinding(input: Finding): Finding {
  if (input.source === undefined || input.source === null) throw new DomainError("finding_without_source", "Finding has no source")
  let source: SourceRef
  try {
    source = validateSource(input.source)
  } catch (error) {
    throw new DomainError("finding_without_source", `Finding has no source: ${(error as Error).message}`)
  }
  if (!input.id?.trim() || !input.candidateId?.trim()) throw new DomainError("invalid_finding", "Finding needs an id and a candidate id")
  if (!input.claim?.trim()) throw new DomainError("invalid_finding", "Finding claim is empty")
  if (!ASPECTS.includes(input.aspect)) throw new DomainError("invalid_finding", `Unknown aspect "${input.aspect}"`)
  if (!SEVERITIES.includes(input.severity)) throw new DomainError("invalid_finding", `Unknown severity "${input.severity}"`)
  if (!input.author?.trim()) throw new DomainError("invalid_finding", "Finding needs an author")
  return Object.freeze({ ...input, source })
}
