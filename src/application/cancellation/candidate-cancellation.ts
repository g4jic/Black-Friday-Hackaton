import {
  ModelMessageItem,
  SemanticEvent,
  type ExecutableTransition,
  type InterceptionHandler,
  type Tool,
} from "@mozaik-ai/core"
import type { Candidate, HardFlag } from "../../domain/index.js"
import type { AppRuntime } from "../runtime.js"

export const STOPPED_PREFIX = "stopped:"

/** Where a loop was stopped, for the timeline and the Rejected row in the UI. */
export type StopPoint = "mid tool call" | "answer replaced" | `before ${string}`

/**
 * Publishes loop.cancelled once per loop (a loop can pass several breakpoints after the flag). Producer is the
 * stopped agent, so the event sits in that agent's lane.
 */
export function cancellationReporter(rt: AppRuntime, candidateId: string, loopKey: string, agentId: string, agentName: string): (where: StopPoint) => void {
  let reported = false
  return (where) => {
    if (reported) return
    reported = true
    const flag = rt.state.candidate(candidateId).rejection
    rt.sendEvent(SemanticEvent.create("loop.cancelled", agentId, { candidateId, loopKey, agent: agentName, where, rule: flag?.rule, raisedBy: flag?.raisedBy }), agentId)
  }
}

/** Steps we hold at the breakpoint once the candidate is rejected. */
const HELD_STEPS = new Set<ExecutableTransition["nextStateId"]>([
  "message_received",
  "inference",
  "inference_streaming",
  "function_call",
  "model_message",
])

export function stoppedText(flag: HardFlag): string {
  return `${STOPPED_PREFIX} Candidate rejected by ${flag.raisedBy} (${flag.aspect}): ${flag.reason}`
}

/**
 * Breakpoint for one evaluator loop on one candidate. Mozaik has no API to stop a running loop, so before every
 * step this checks the shared state. Once the candidate is rejected (by another agent), the next step is rewritten
 * into a final model message "stopped: ...": no further model call, no further tool call, and the loop ends
 * through Mozaik's normal model_message -> idle transition. It never returns "idle" itself (that crashes 6.0.0).
 *
 * The agent that raised the flag keeps running, so it can finish its own explanation.
 */
export class CandidateCancellation implements InterceptionHandler {
  constructor(
    private readonly candidate: Candidate,
    private readonly agentName: string,
    /** Called when this breakpoint stops the loop (once per step it rewrites). */
    private readonly onStop?: (where: StopPoint) => void,
  ) {}

  isSatisfiedBy(transition: ExecutableTransition): boolean {
    const flag = this.candidate.rejection
    if (!flag || flag.raisedBy === this.agentName) return false
    if (!HELD_STEPS.has(transition.nextStateId)) return false
    // Already rewritten: let our own "stopped" message through.
    if (transition.nextStateId === "model_message") return !transition.input.answer.content.text.startsWith(STOPPED_PREFIX)
    return true
  }

  async handle(transition: ExecutableTransition): Promise<ExecutableTransition> {
    const flag = this.candidate.rejection
    if (!flag) return transition
    this.onStop?.(transition.nextStateId === "model_message" ? "answer replaced" : `before ${transition.nextStateId}`)
    return { nextStateId: "model_message", input: { answer: ModelMessageItem.rehydrate({ text: stoppedText(flag) }) } }
  }
}

/** A tool implementation that receives the candidate's AbortSignal, so slow I/O (web fetch, OSM) can stop early. */
export type CancellableInvoke = (args: any, signal: AbortSignal) => Promise<unknown>

/**
 * Wraps a tool for one candidate. Covers the case interception cannot: the hard flag arrives WHILE this tool is
 * running. The call settles at once with "Not executed / aborted", the underlying work gets the abort signal, and
 * the interception then stops the loop at its next step.
 */
export function cancellableTool(
  tool: Omit<Tool, "invoke">,
  candidate: Candidate,
  agentName: string,
  invoke: CancellableInvoke,
  onStop?: (where: StopPoint) => void,
): Tool {
  // The agent that raises the flag is never cancelled by it (its own tool is usually what raised it).
  const stoppedByOther = () => (candidate.rejection && candidate.rejection.raisedBy !== agentName ? candidate.rejection : null)
  return {
    ...tool,
    invoke: async (args: unknown) => {
      const before = stoppedByOther()
      if (before) return `Not executed: ${stoppedText(before)}`
      // Own controller per call: aborted only when ANOTHER participant rejects the candidate.
      const controller = new AbortController()
      let settleAborted: ((text: string) => void) | undefined
      const aborted = new Promise<string>((resolve) => (settleAborted = resolve))
      const onCandidateAbort = () => {
        const flag = stoppedByOther()
        if (!flag) return
        controller.abort(flag)
        if (onStop) queueMicrotask(() => onStop("mid tool call")) // after candidate.rejected is published
        settleAborted?.(`Aborted mid-call: ${stoppedText(flag)}`)
      }
      candidate.signal.addEventListener("abort", onCandidateAbort, { once: true })
      try {
        return await Promise.race([invoke(args, controller.signal), aborted])
      } catch (error) {
        const flag = stoppedByOther()
        if (controller.signal.aborted && flag) return `Aborted mid-call: ${stoppedText(flag)}`
        throw error // a normal tool error: Mozaik hands it to the model as "Error calling tool: ..."
      } finally {
        candidate.signal.removeEventListener("abort", onCandidateAbort)
      }
    },
  }
}

/**
 * The single way a candidate gets cancelled: domain rule in state first, then a domain event so every participant
 * (UI, other evaluators, the Ranker) notices. Idempotent: a second flag only gets recorded.
 */
export function rejectCandidate(rt: AppRuntime, candidateId: string, flag: HardFlag, producerId: string): boolean {
  const first = rt.state.rejectCandidate(candidateId, flag)
  // The loops this rejection stops: every loop on the candidate still running, except the agent that raised it.
  const cancelledLoops = first ? rt.runningLoopsOf(candidateId, flag.raisedBy).map((l) => ({ loopKey: l.key, agent: l.agentName })) : []
  rt.sendEvent(SemanticEvent.create(first ? "candidate.rejected" : "candidate.flag_recorded", producerId, { candidateId, flag, cancelledLoops }), producerId)
  return first
}
