import {
  Agent,
  SemanticEvent,
  SituationSpecification,
  createAgent,
  type SituationContext,
  type StructuredOutputFormat,
} from "@mozaik-ai/core"
import {
  Candidate,
  DomainError,
  LISTING_FIELDS,
  buildListing,
  isMissingData,
  type Listing,
  type ListingText,
  type ListingTextInput,
} from "../../domain/index.js"
import { INFERENCE_FAILED_PREFIX } from "../resilience/resilient-runner.js"
import { QUOTED_FIELDS_RULES, quotedFieldsSchema } from "./quoted-schema.js"
import { safeHandler } from "../resilience/safe-handler.js"
import type { AppRuntime } from "../runtime.js"

export const SCOUT_NAME = "Scout"
/** One retry: the first rejection goes back to the Scout as feedback, the second puts the listing in the failed queue. */
export const SCOUT_MAX_ATTEMPTS = 2

export const SCOUT_INSTRUCTION = [
  "You are the Scout of SuiteSpot. You read the text of ONE commercial property listing and extract its fields.",
  QUOTED_FIELDS_RULES,
  "A service charge given as 'included' is not an amount: found=false.",
  "Do not output phone numbers, emails or people's names. You have no tools. Answer only with the JSON object.",
].join(" ")

/** The structured output the Scout must return, built from LISTING_FIELDS (11 union parameters, 0 optional). */
export const LISTING_EXTRACTION_SCHEMA: StructuredOutputFormat = quotedFieldsSchema("listing_extraction", LISTING_FIELDS)

export function scoutMessage(listing: ListingText, feedback?: string): string {
  const lines = [`Listing id: ${listing.id}`, "Listing text:", '"""', listing.text, '"""']
  if (feedback) lines.push("", `Your previous extraction was rejected by the validator: ${feedback}`, "Fix every problem and answer again.")
  return lines.join("\n")
}

/** Names of the fields the text did not state, for the UI and the evaluators. */
export function missingFields(listing: Listing): string[] {
  return LISTING_FIELDS.filter((f) => isMissingData(listing[f.name])).map((f) => f.name)
}

/**
 * Entry point for both inputs (demo fixtures and the user's 1 to 8 pasted texts): state removes contact data and
 * stores the texts, then one domain event tells the room. The Scout notices it; nobody calls the Scout.
 */
export function submitListings(rt: AppRuntime, inputs: readonly ListingTextInput[], producerId: string): ListingText[] {
  const batch = rt.state.submitListings(inputs)
  const removed = batch.reduce((acc, t) => ({ phones: acc.phones + t.removed.phones, emails: acc.emails + t.removed.emails }), { phones: 0, emails: 0 })
  rt.sendEvent(SemanticEvent.create("listings.submitted", producerId, { listingIds: batch.map((t) => t.id), removedContacts: removed }), producerId)
  return batch
}

class WhenListingsSubmitted extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === "listings.submitted" && event.producerId !== participant.getId()
  }
}

class WhenOwnLoopEvent extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.producerId === participant.getId()
  }
}

const loopKey = (listingId: string, attempt: number) => `scout:${listingId}:${attempt}`

function parseKey(key: string): { listingId: string; attempt: number } | null {
  const m = /^scout:(.+):(\d+)$/.exec(key)
  return m ? { listingId: m[1]!, attempt: Number(m[2]) } : null
}

export type ScoutOptions = { model: string }

/**
 * The Scout: one AI loop per listing, all in parallel. Each loop returns structured output; plain code
 * (buildListing) checks every value against the listing text before it enters state. A valid listing becomes a
 * candidate and is announced at once with candidate.found, so evaluators start while other listings are still being
 * read. A rejected extraction goes back to the Scout once as feedback; then the listing joins the failed queue.
 */
export function createScout(rt: AppRuntime, options: ScoutOptions): Agent {
  const startExtraction = (scout: Agent, listingId: string, attempt: number, feedback?: string) => {
    rt.startLoop({
      agent: scout,
      key: loopKey(listingId, attempt),
      message: scoutMessage(rt.state.listingText(listingId), feedback),
      model: options.model,
      tools: [],
      structuredOutput: LISTING_EXTRACTION_SCHEMA,
      maxOutputTokens: 2048,
    })
  }

  const fail = (scoutId: string, listingId: string, attempts: number, reason: string) => {
    rt.state.recordFailedListing({ listingId, reason, attempts })
    rt.sendEvent(SemanticEvent.create("listing.extraction_failed", scoutId, { listingId, attempts, reason }), scoutId)
  }

  const onAnswer = (scout: Agent, listingId: string, attempt: number, answer: string) => {
    const scoutId = scout.getId()
    // The provider failed (ResilientRunner already retried): the model never read the listing, so feedback cannot
    // help. Fail at once with the real reason instead of a misleading "not valid JSON" and a wasted second call.
    if (answer.startsWith(INFERENCE_FAILED_PREFIX)) {
      fail(scoutId, listingId, attempt, `Provider error: ${answer.slice(INFERENCE_FAILED_PREFIX.length).trim()}`)
      return
    }
    try {
      // Last attempt: keep what code can verify, mark the rest unverified (MissingData + check before signing).
      const listing = buildListing(rt.state.listingText(listingId), answer, { partial: attempt >= SCOUT_MAX_ATTEMPTS })
      const candidate = rt.state.addCandidate(new Candidate(listingId, listing))
      rt.sendEvent(
        SemanticEvent.create("candidate.found", scoutId, { candidateId: candidate.id, listingRef: listing.ref, synthetic: listing.synthetic, missing: missingFields(listing), unverified: listing.unverified }),
        scoutId,
      )
    } catch (error) {
      const reason = error instanceof DomainError ? error.message : `Unexpected error: ${(error as Error).message}`
      if (attempt < SCOUT_MAX_ATTEMPTS) {
        rt.sendEvent(SemanticEvent.create("listing.extraction_rejected", scoutId, { listingId, attempt, reason }), scoutId)
        startExtraction(scout, listingId, attempt + 1, reason)
        return
      }
      fail(scoutId, listingId, attempt, reason)
    }
  }

  return createAgent({
    name: SCOUT_NAME,
    capabilities: ["inference"],
    instruction: SCOUT_INSTRUCTION,
    tools: [],
    handlers: [
      safeHandler({
        specification: new WhenListingsSubmitted(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const { listingIds } = event.payload as { listingIds: string[] }
            for (const id of listingIds) startExtraction(participant, id, 1) // fire and forget: all loops run at once
          },
        },
      }),
      safeHandler({
        specification: new WhenOwnLoopEvent(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const loop = rt.loopForEvent(event) // also links Mozaik's loopId to our loop key on the first event
            if (event.type !== "model.answer" || !loop) return
            const parsed = parseKey(loop.key)
            if (!parsed) return
            const { answer } = event.payload as { answer: { content: { text: string } } }
            onAnswer(participant, parsed.listingId, parsed.attempt, answer.content.text)
          },
        },
      }),
    ],
  })
}
