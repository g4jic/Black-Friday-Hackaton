import { ModelMessageItem, type ExecutableTransition, type InterceptionHandler } from "@mozaik-ai/core"
import type { SuiteSpotState } from "../state.js"
import { STOPPED_PREFIX } from "./candidate-cancellation.js"

export const RUN_STOPPED_TEXT = `${STOPPED_PREFIX} the research was cancelled by the user`

const HELD_STEPS = new Set<ExecutableTransition["nextStateId"]>(["message_received", "inference", "inference_streaming", "function_call", "model_message"])

/**
 * Breakpoint for every loop of the run, in front of the loop's own breakpoint (for example CandidateCancellation).
 * Once the user cancels the run, the next step of every loop becomes a final "stopped: ..." model message: no
 * further model or tool call, and the loop ends through Mozaik's normal model_message -> idle path (never "idle"
 * from here, that crashes 6.0.0). Until then the inner breakpoint decides as before.
 */
export class RunStopBreakpoint implements InterceptionHandler {
  constructor(
    private readonly state: SuiteSpotState,
    private readonly inner?: InterceptionHandler,
  ) {}

  private stopsThis(transition: ExecutableTransition): boolean {
    if (!this.state.runStop || !HELD_STEPS.has(transition.nextStateId)) return false
    // Already stopped: let the "stopped" message through.
    if (transition.nextStateId === "model_message") return !transition.input.answer.content.text.startsWith(STOPPED_PREFIX)
    return true
  }

  isSatisfiedBy(transition: ExecutableTransition): boolean {
    return this.stopsThis(transition) || Boolean(this.inner?.isSatisfiedBy(transition))
  }

  async handle(transition: ExecutableTransition): Promise<ExecutableTransition> {
    if (this.stopsThis(transition)) return { nextStateId: "model_message", input: { answer: ModelMessageItem.rehydrate({ text: RUN_STOPPED_TEXT }) } }
    return this.inner ? this.inner.handle(transition) : transition
  }
}
