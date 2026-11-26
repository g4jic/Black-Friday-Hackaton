import { RuntimeState } from "@mozaik-ai/core"
import {
  Candidate,
  DomainError,
  createFinding,
  type BusinessProfile,
  type Finding,
  type HardFlag,
  type Requirement,
} from "../domain/index.js"

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
  readonly candidates = new Map<string, Candidate>()
  readonly findings: Finding[] = []

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
