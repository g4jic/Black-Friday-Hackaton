import { Agent, SemanticEvent, SituationSpecification, createAgent, type SituationContext, type StructuredOutputFormat } from "@mozaik-ai/core"
import { DomainError, LEASE_FIELDS, buildLease, evaluateLease, leaseClauseClaims, type LeaseClauses, type LeaseText } from "../../domain/index.js"
import { CandidateCancellation, STOPPED_PREFIX, cancellationReporter, rejectCandidate } from "../cancellation/candidate-cancellation.js"
import { INFERENCE_FAILED_PREFIX } from "../resilience/resilient-runner.js"
import { safeHandler } from "../resilience/safe-handler.js"
import type { AppRuntime } from "../runtime.js"
import { QUOTED_FIELDS_RULES, quotedFieldsSchema } from "./quoted-schema.js"

export const LEASE_READER_NAME = "Lease reader"
export const LEASE_READER_MAX_ATTEMPTS = 2

export const LEASE_READER_INSTRUCTION = [
  "You are the Lease reader of SuiteSpot. You read ONE commercial lease draft and report what each clause says.",
  QUOTED_FIELDS_RULES,
  "For a period give the number and the unit exactly as written (\"10 godina\" -> value 10, unit years).",
  "You do not judge whether a clause is risky or legal: you only report it. Do not output names of people. You have no tools.",
  "Answer only with the JSON object.",
].join(" ")

/** The structured output the Lease reader must return, built from LEASE_FIELDS (10 union parameters, 0 optional). */
export const LEASE_EXTRACTION_SCHEMA: StructuredOutputFormat = quotedFieldsSchema("lease_extraction", LEASE_FIELDS)

export function leaseMessage(lease: LeaseText, feedback?: string): string {
  const lines = [`Lease id: ${lease.id}`, "Lease text:", '"""', lease.text, '"""']
  if (feedback) lines.push("", `Your previous extraction was rejected by the validator: ${feedback}`, "Fix every problem and answer again.")
  return lines.join("\n")
}

class WhenCandidateFound extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "candidate.found"
  }
}

class WhenOwnAnswer extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.producerId === participant.getId() && event.type === "model.answer"
  }
}

export type LeaseReaderOptions = { model: string }

/**
 * Lease reader: one AI loop per candidate that has a lease draft, running next to the Finance analyst. The model
 * reports clauses with quotes; buildLease checks each quote against the lease text; evaluateLease (code) decides hard
 * and soft flags. A hard flag rejects the candidate, which stops the other loops on it at their next breakpoint.
 */
export function createLeaseReader(rt: AppRuntime, options: LeaseReaderOptions): Agent {
  const start = (agent: Agent, candidateId: string, attempt: number, feedback?: string) => {
    const candidate = rt.state.candidate(candidateId)
    const lease = rt.state.leaseTexts.get(candidateId)!
    const key = `lease:${candidateId}:${attempt}`
    rt.startLoop({
      agent,
      key,
      candidateId,
      message: leaseMessage(lease, feedback),
      model: options.model,
      tools: [],
      structuredOutput: LEASE_EXTRACTION_SCHEMA,
      maxOutputTokens: 2048,
      interception: new CandidateCancellation(candidate, LEASE_READER_NAME, cancellationReporter(rt, candidateId, key, agent.getId(), LEASE_READER_NAME)),
    })
  }

  const recordClauses = (candidateId: string, clauses: LeaseClauses) => {
    for (const { name, claim, field } of leaseClauseClaims(clauses)) {
      rt.state.addFinding({ id: `${candidateId}:lease:${name}`, candidateId, aspect: "lease", severity: "info", claim, value: field, source: field.source, author: LEASE_READER_NAME })
    }
  }

  const onAnswer = (agent: Agent, candidateId: string, attempt: number, text: string) => {
    const agentId = agent.getId()
    if (text.startsWith(STOPPED_PREFIX)) return rt.state.recordLeaseResult(candidateId, null)
    if (text.startsWith(INFERENCE_FAILED_PREFIX)) {
      rt.state.recordLeaseResult(candidateId, null)
      rt.sendEvent(SemanticEvent.create("lease.failed", agentId, { candidateId, reason: `Provider error: ${text.slice(INFERENCE_FAILED_PREFIX.length).trim()}` }), agentId)
      return
    }
    let clauses: LeaseClauses
    try {
      // Last attempt: keep the clauses code can verify; a failing clause becomes unverified MissingData, so one bad
      // field can never hide a deal breaker in the others.
      clauses = buildLease(rt.state.leaseTexts.get(candidateId)!, text, { partial: attempt >= LEASE_READER_MAX_ATTEMPTS })
    } catch (error) {
      const reason = error instanceof DomainError ? error.message : `Unexpected error: ${(error as Error).message}`
      if (attempt < LEASE_READER_MAX_ATTEMPTS) {
        rt.sendEvent(SemanticEvent.create("lease.extraction_rejected", agentId, { candidateId, attempt, reason }), agentId)
        start(agent, candidateId, attempt + 1, reason)
      } else {
        rt.state.recordLeaseResult(candidateId, null)
        rt.sendEvent(SemanticEvent.create("lease.failed", agentId, { candidateId, reason }), agentId)
      }
      return
    }

    recordClauses(candidateId, clauses)
    const { hardFlags, concerns } = evaluateLease(clauses, LEASE_READER_NAME)
    for (const c of concerns) {
      rt.state.addFinding({
        id: `${candidateId}:lease:concern:${c.rule}`,
        candidateId,
        aspect: "lease",
        severity: "soft",
        claim: c.claim,
        source: c.source,
        author: LEASE_READER_NAME,
        checkBeforeSigning: c.checkBeforeSigning,
      })
    }
    for (const flag of hardFlags) {
      rt.state.addFinding({ id: `${candidateId}:lease:hard:${flag.rule}`, candidateId, aspect: "lease", severity: "hard", claim: flag.reason, source: flag.source, author: LEASE_READER_NAME })
    }
    rt.sendEvent(
      SemanticEvent.create("lease.read", agentId, { candidateId, leaseId: clauses.leaseId, attempt, hardFlags: hardFlags.map((f) => f.rule), concerns: concerns.map((c) => c.rule), unverified: clauses.unverified }),
      agentId,
    )
    // Reject BEFORE releasing the lease terms: a Finance tool waiting for them is aborted instead of computing on.
    for (const flag of hardFlags) rejectCandidate(rt, candidateId, flag, agentId)
    rt.state.recordLeaseResult(candidateId, clauses)
  }

  return createAgent({
    name: LEASE_READER_NAME,
    capabilities: ["inference"],
    instruction: LEASE_READER_INSTRUCTION,
    tools: [],
    handlers: [
      safeHandler({
        specification: new WhenCandidateFound(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const { candidateId } = event.payload as { candidateId: string }
            const candidate = rt.state.candidate(candidateId)
            if (!rt.state.hasLease(candidateId) || candidate.isRejected()) return // no lease draft: nothing to read yet
            if (candidate.status === "pending") candidate.startEvaluation()
            start(participant, candidateId, 1) // fire and forget: runs next to the Finance analyst
          },
        },
      }),
      safeHandler({
        specification: new WhenOwnAnswer(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const loop = rt.loopForEvent(event)
            const m = loop ? /^lease:(.+):(\d+)$/.exec(loop.key) : null
            if (!m) return
            const { answer } = event.payload as { answer: { content: { text: string } } }
            onAnswer(participant, m[1]!, Number(m[2]), answer.content.text)
          },
        },
      }),
    ],
  })
}
