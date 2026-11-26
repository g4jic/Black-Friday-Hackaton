import { RuntimeState } from "@mozaik-ai/core"

/**
 * The one shared store every participant reads and writes. The domain model (profile, candidates,
 * findings, estimates) is added in step 3; this is the minimal version used by the resilience layer.
 */
export class SuiteSpotState extends RuntimeState {
  readonly startedAt = Date.now()
}
