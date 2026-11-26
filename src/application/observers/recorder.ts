import { createHuman, SituationSpecification, type SemanticEvent } from "@mozaik-ai/core"
import { safeHandler } from "../resilience/safe-handler.js"

class AnyEvent extends SituationSpecification {
  isSatisfiedBy(): boolean {
    return true
  }
}

export type RecordedEvent = { at: number; type: string; producerId: string; event: SemanticEvent }

/**
 * Plain-code observer that records every event on the bus. Used for the JSONL trace, the lane chart and tests.
 * It is a participant like any other: it joins the room and notices events; nobody calls it.
 */
export function createRecorder(name = "Recorder") {
  const events: RecordedEvent[] = []
  const participant = createHuman({
    name,
    capabilities: ["observe"],
    handlers: [
      safeHandler({
        specification: new AnyEvent(),
        processor: {
          apply({ event }) {
            events.push({ at: Date.now(), type: event.type, producerId: event.producerId, event })
          },
        },
      }),
    ],
  })
  return { participant, events }
}
