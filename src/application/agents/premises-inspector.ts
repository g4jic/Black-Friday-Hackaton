import { Agent, SemanticEvent, SituationSpecification, createAgent, type SituationContext, type StructuredOutputFormat } from "@mozaik-ai/core"
import { BUSINESS_TYPE_TEXT, DomainError, PREMISES_FIELDS, buildPremises, evaluatePremises, isMissingData, premisesDocument, type PremisesFacts, type PremisesTexts } from "../../domain/index.js"
import { CandidateCancellation, STOPPED_PREFIX, cancellationReporter } from "../cancellation/candidate-cancellation.js"
import { INFERENCE_FAILED_PREFIX } from "../resilience/resilient-runner.js"
import { safeHandler } from "../resilience/safe-handler.js"
import type { AppRuntime } from "../runtime.js"
import { QUOTED_FIELDS_RULES, quotedFieldsSchema } from "./quoted-schema.js"

export const PREMISES_NAME = "Premises inspector"
export const PREMISES_MAX_ATTEMPTS = 2

export const PREMISES_INSTRUCTION = [
  "You are the Premises inspector of SuiteSpot. You read ONE listing (and its lease draft, if there is one) and report what it states about the space itself:",
  "the floor, a storefront, parking, heating, kitchen ventilation, water and drain, whether it needs renovation, and step-free access.",
  QUOTED_FIELDS_RULES,
  "Report only what the text states; a feature the text does not mention is not found. You do not judge whether the space suits the business: code does that.",
  "Do not output names of people. You have no tools. Answer only with the JSON object.",
].join(" ")

/** The structured output, built from PREMISES_FIELDS (8 union parameters, 0 optional). */
export const PREMISES_EXTRACTION_SCHEMA: StructuredOutputFormat = quotedFieldsSchema("premises_extraction", PREMISES_FIELDS)

export function premisesMessage(candidateId: string, business: string, texts: PremisesTexts, feedback?: string): string {
  const lines = [`Candidate id: ${candidateId}`, `Business: ${business}`, "Text:", '"""', premisesDocument(texts), '"""']
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

export type PremisesOptions = { model: string }

/**
 * Premises inspector: one AI loop per candidate, next to Finance, Lease and Location. The model reports what the
 * listing and the lease draft say about the space, each value with a quote; buildPremises checks every quote against
 * the text; evaluatePremises (code) decides what suits this business and what to check before signing. It raises
 * soft flags only. A hard flag from another participant stops this loop at its next breakpoint.
 */
export function createPremisesInspector(rt: AppRuntime, options: PremisesOptions): Agent {
  const textsOf = (candidateId: string): PremisesTexts => {
    const candidate = rt.state.candidate(candidateId)
    const lease = rt.state.leaseTexts.get(candidateId) ?? null
    return { listingRef: candidate.listing.ref, listingText: candidate.listing.text, leaseId: lease?.id ?? null, leaseText: lease?.text ?? null }
  }

  const start = (agent: Agent, candidateId: string, attempt: number, feedback?: string) => {
    const candidate = rt.state.candidate(candidateId)
    const key = `premises:${candidateId}:${attempt}`
    const profile = rt.state.requireProfile()
    rt.startLoop({
      agent,
      key,
      candidateId,
      message: premisesMessage(candidateId, `${profile.input.description} (${BUSINESS_TYPE_TEXT[profile.businessType().value]})`, textsOf(candidateId), feedback),
      model: options.model,
      tools: [],
      structuredOutput: PREMISES_EXTRACTION_SCHEMA,
      maxOutputTokens: 1536,
      interception: new CandidateCancellation(candidate, PREMISES_NAME, cancellationReporter(rt, candidateId, key, agent.getId(), PREMISES_NAME)),
    })
  }

  const record = (agentId: string, candidateId: string, attempt: number, facts: PremisesFacts) => {
    rt.state.recordPremises(facts)
    const result = evaluatePremises(facts, rt.state.requireProfile().businessType().value)
    for (const p of result.parts) {
      rt.state.addFinding({ id: `${candidateId}:premises:${p.name}`, candidateId, aspect: "premises", severity: "info", claim: p.text, source: p.source, author: PREMISES_NAME })
    }
    for (const c of result.concerns) {
      rt.state.addFinding({ id: `${candidateId}:premises:concern:${c.rule}`, candidateId, aspect: "premises", severity: "soft", claim: c.claim, source: c.source, author: PREMISES_NAME, checkBeforeSigning: c.checkBeforeSigning })
    }
    const heating = facts.heating
    if (!isMissingData(heating)) rt.state.addFinding({ id: `${candidateId}:premises:heating`, candidateId, aspect: "premises", severity: "info", claim: `Heating: ${heating.value}`, source: heating.source, author: PREMISES_NAME })
    rt.sendEvent(
      SemanticEvent.create("premises.read", agentId, { candidateId, attempt, concerns: result.concerns.map((c) => c.rule), unknown: result.unknown, unverified: facts.unverified, score: result.score, scoreHigh: result.scoreHigh }),
      agentId,
    )
  }

  const onAnswer = (agent: Agent, candidateId: string, attempt: number, text: string) => {
    const agentId = agent.getId()
    if (text.startsWith(STOPPED_PREFIX)) return
    if (text.startsWith(INFERENCE_FAILED_PREFIX)) {
      rt.sendEvent(SemanticEvent.create("premises.failed", agentId, { candidateId, reason: `Provider error: ${text.slice(INFERENCE_FAILED_PREFIX.length).trim()}` }), agentId)
      return
    }
    let facts: PremisesFacts
    try {
      // Last attempt: keep what code can verify; a failing field becomes unverified missing data.
      facts = buildPremises(candidateId, textsOf(candidateId), text, { partial: attempt >= PREMISES_MAX_ATTEMPTS })
    } catch (error) {
      const reason = error instanceof DomainError ? error.message : `Unexpected error: ${(error as Error).message}`
      if (attempt < PREMISES_MAX_ATTEMPTS && !rt.state.candidate(candidateId).isRejected()) {
        rt.sendEvent(SemanticEvent.create("premises.extraction_rejected", agentId, { candidateId, attempt, reason }), agentId)
        start(agent, candidateId, attempt + 1, reason)
      } else rt.sendEvent(SemanticEvent.create("premises.failed", agentId, { candidateId, reason }), agentId)
      return
    }
    record(agentId, candidateId, attempt, facts)
  }

  return createAgent({
    name: PREMISES_NAME,
    capabilities: ["inference"],
    instruction: PREMISES_INSTRUCTION,
    tools: [],
    handlers: [
      safeHandler({
        specification: new WhenCandidateFound(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const { candidateId } = event.payload as { candidateId: string }
            const candidate = rt.state.candidate(candidateId)
            if (candidate.isRejected()) return
            if (candidate.status === "pending") candidate.startEvaluation()
            start(participant, candidateId, 1) // fire and forget: runs next to Finance, Lease and Location
          },
        },
      }),
      safeHandler({
        specification: new WhenOwnAnswer(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const loop = rt.loopForEvent(event)
            const m = loop ? /^premises:(.+):(\d+)$/.exec(loop.key) : null
            if (!m) return
            const { answer } = event.payload as { answer: { content: { text: string } } }
            onAnswer(participant, m[1]!, Number(m[2]), answer.content.text)
          },
        },
      }),
    ],
  })
}
