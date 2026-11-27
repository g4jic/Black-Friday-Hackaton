import { INFERENCE_FAILED_PREFIX } from "../resilience/resilient-runner.js"
import { safeHandler } from "../resilience/safe-handler.js"
import type { AppRuntime } from "../runtime.js"
import { CandidateCancellation, STOPPED_PREFIX, cancellableTool, cancellationReporter } from "../cancellation/candidate-cancellation.js"
import type { AreaLookup } from "../location/area-lookup.js"
import { strictObject } from "./quoted-schema.js"
import { Agent, SemanticEvent, SituationSpecification, createAgent, type SituationContext, type StructuredOutputFormat, type Tool } from "@mozaik-ai/core"
import { BUSINESS_TYPE_TEXT, LOCATION_ASSUMPTIONS, OSM_METRICS, OSM_METRIC_TEXT, AREA_RADIUS_M, scoreLocation, unsourcedNumbers, type AreaData } from "../../domain/index.js"

export const LOCATION_NAME = "Location analyst"
export const LOCATION_MAX_ATTEMPTS = 2

export const LOCATION_INSTRUCTION = [
  "You are the Location analyst of SuiteSpot. For one candidate space you explain what the area around it offers this type of business.",
  "The area_data tool returns counts of places mapped in OpenStreetMap near the address, counted by code. You never count or estimate anything yourself.",
  "Call at most one tool per turn. Wait for its result before the next call.",
  "Step 1: call area_data. Then answer with a short explanation (at most 80 words) for the business owner: what nearby helps this business, what competes with it, and what the data does not show.",
  "Use only numbers the tool returned, written exactly as returned. Never estimate revenue, customers or foot traffic: OpenStreetMap does not measure them.",
  "If the tool says the address was not found, say that the location could not be checked. This is not financial or legal advice.",
].join(" ")

export const LOCATION_EXPLANATION_SCHEMA: StructuredOutputFormat = {
  name: "location_explanation",
  strict: true,
  schema: strictObject({ explanation: { type: "string", description: "short explanation using only numbers the area_data tool returned" } }),
}

/** area_data takes no arguments: the candidate is fixed by the loop (an empty object keeps the schema strict). */
export const AREA_DATA_TOOL_SCHEMA: StructuredOutputFormat = { name: "area_data_parameters", strict: true, schema: strictObject({}) }

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

export type LocationOptions = { model: string; lookup: AreaLookup }

/** The tool's text: one line per count, with the OSM source and what the code scored for this business type. */
export function areaDataText(area: AreaData, businessType: keyof typeof LOCATION_ASSUMPTIONS.rules): string {
  const { score, parts } = scoreLocation(area, businessType)
  return [
    `Place: ${area.place} (${area.precision === "street" ? "the street" : "only the district centre was found, less precise"}); radius ${AREA_RADIUS_M} m; data © OpenStreetMap contributors, ODbL`,
    ...OSM_METRICS.map((m) => `${m} = ${area.counts[m].value} ${OSM_METRIC_TEXT[m]}`),
    `Scored by code for a ${BUSINESS_TYPE_TEXT[businessType]}: ${parts.map((p) => `${p.metric} ${p.score}`).join(", ")}; location part ${score}`,
  ].join("\n")
}

/**
 * Location analyst: one AI loop per candidate, next to the Finance analyst and the Lease reader. Code looks the area
 * up in OpenStreetMap (or the fixture of the seeded listings) and records it in shared state; the model only explains
 * the counts for this business, and its explanation is rejected if it contains a number the tool never returned.
 * A hard flag from another participant stops this loop at its next breakpoint, like every other.
 */
export function createLocationAnalyst(rt: AppRuntime, options: LocationOptions): Agent {
  const allowed = new Map<string, number[]>()

  const start = (agent: Agent, candidateId: string, attempt: number, feedback?: string) => {
    const candidate = rt.state.candidate(candidateId)
    const key = `location:${candidateId}:${attempt}`
    const onStop = cancellationReporter(rt, candidateId, key, agent.getId(), LOCATION_NAME)
    const tool: Tool = cancellableTool(
      { type: "function", name: "area_data", description: "Counts of places mapped in OpenStreetMap near this candidate's address (counted by code).", parameters: AREA_DATA_TOOL_SCHEMA.schema, strict: true },
      candidate,
      LOCATION_NAME,
      async (_args: unknown, signal) => {
        const known = rt.state.areas.get(candidateId)
        const area = known ?? (await options.lookup(candidateId, candidate.listing, signal))
        if (rt.state.runStop) return `Not executed: ${rt.state.runStop.reason}`
        if (!area) {
          rt.sendEvent(SemanticEvent.create("location.not_found", agent.getId(), { candidateId }), agent.getId())
          return "The address was not found in OpenStreetMap: the location cannot be checked (missing data)."
        }
        rt.state.recordArea(area)
        const businessType = rt.state.requireProfile().businessType().value
        const { score, parts } = scoreLocation(area, businessType)
        allowed.set(candidateId, [AREA_RADIUS_M, score, ...OSM_METRICS.map((m) => area.counts[m].value), ...parts.map((p) => p.score)])
        for (const m of OSM_METRICS) {
          const c = area.counts[m]
          rt.state.addFinding({ id: `${candidateId}:location:${m}`, candidateId, aspect: "location", severity: "info", claim: `${c.value} ${OSM_METRIC_TEXT[m]} within ${AREA_RADIUS_M} m`, value: c, source: c.source, author: LOCATION_NAME })
        }
        rt.sendEvent(SemanticEvent.create("location.area_found", agent.getId(), { candidateId, place: area.place, precision: area.precision, counts: Object.fromEntries(OSM_METRICS.map((m) => [m, area.counts[m].value])) }), agent.getId())
        return areaDataText(area, businessType)
      },
      onStop,
    )
    const message = [
      `Candidate id: ${candidateId}`,
      `Business: ${rt.state.requireProfile().input.description}`,
      ...(feedback ? ["", `Your previous explanation was rejected: ${feedback}`, "Use only numbers the tool returned, exactly as returned."] : []),
    ].join("\n")
    rt.startLoop({
      agent,
      key,
      candidateId,
      message,
      model: options.model,
      tools: [tool],
      structuredOutput: LOCATION_EXPLANATION_SCHEMA,
      maxOutputTokens: 768,
      interception: new CandidateCancellation(candidate, LOCATION_NAME, onStop),
    })
  }

  const onAnswer = (agent: Agent, candidateId: string, attempt: number, text: string) => {
    const agentId = agent.getId()
    if (text.startsWith(STOPPED_PREFIX)) return
    if (text.startsWith(INFERENCE_FAILED_PREFIX)) {
      rt.sendEvent(SemanticEvent.create("location.failed", agentId, { candidateId, reason: text }), agentId)
      return
    }
    let explanation = ""
    try {
      explanation = String((JSON.parse(text) as { explanation?: unknown }).explanation ?? "").trim()
    } catch {
      explanation = ""
    }
    const unsourced = explanation ? unsourcedNumbers(explanation, allowed.get(candidateId) ?? []) : []
    const problem = !explanation ? "the answer is not the JSON object {explanation}" : unsourced.length ? `numbers without a source: ${unsourced.join(", ")}` : null
    if (problem) {
      if (attempt < LOCATION_MAX_ATTEMPTS && !rt.state.candidate(candidateId).isRejected()) {
        rt.sendEvent(SemanticEvent.create("location.explanation_rejected", agentId, { candidateId, attempt, reason: problem }), agentId)
        start(agent, candidateId, attempt + 1, problem)
      } else rt.sendEvent(SemanticEvent.create("location.failed", agentId, { candidateId, reason: problem }), agentId)
      return
    }
    const area = rt.state.areas.get(candidateId)
    if (area) {
      rt.state.addFinding({
        id: `${candidateId}:location:explanation`,
        candidateId,
        aspect: "location",
        severity: "info",
        claim: explanation,
        source: { kind: "calc", ref: "Location analyst explanation of the OpenStreetMap counts", inputs: OSM_METRICS.map((m) => area.counts[m].source) },
        author: LOCATION_NAME,
      })
    }
    rt.sendEvent(SemanticEvent.create("location.explained", agentId, { candidateId, explanation }), agentId)
  }

  return createAgent({
    name: LOCATION_NAME,
    capabilities: ["inference"],
    instruction: LOCATION_INSTRUCTION,
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
            start(participant, candidateId, 1) // fire and forget: runs next to Finance and Lease
          },
        },
      }),
      safeHandler({
        specification: new WhenOwnAnswer(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const loop = rt.loopForEvent(event)
            const m = loop ? /^location:(.+):(\d+)$/.exec(loop.key) : null
            if (!m) return
            const { answer } = event.payload as { answer: { content: { text: string } } }
            onAnswer(participant, m[1]!, Number(m[2]), answer.content.text)
          },
        },
      }),
    ],
  })
}
