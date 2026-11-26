import {
  DeveloperMessageItem,
  ModelContext,
  SemanticEvent,
  defineRuntime,
  type Agent,
  type InferenceInput,
  type InferenceRunner,
  type InterceptionHandler,
  type StructuredOutputFormat,
  type Tool,
} from "@mozaik-ai/core"
import { ResilientRunner, type ResilientRunnerOptions } from "./resilience/resilient-runner.js"
import { Semaphore } from "./resilience/semaphore.js"
import { SuiteSpotState } from "./state.js"

/** What we know about a loop we started. Mozaik's own loopId is only visible in event payloads. */
export type LoopInfo = {
  /** Our stable key, for example "finance:cand-3". */
  key: string
  agentId: string
  agentName: string
  candidateId?: string
  /** Mozaik loopId, filled in when the first loop event is seen. */
  loopId?: string
}

export type StartLoopOptions = {
  agent: Agent
  message: string
  key: string
  candidateId?: string
  model: string
  tools?: Tool[]
  structuredOutput?: StructuredOutputFormat
  maxOutputTokens?: number
  interception?: InterceptionHandler
}

export type AppRuntimeOptions = {
  state?: SuiteSpotState
  /** The model runner: MockRunner in demo mode, Mozaik's DefaultInferenceRunner in live mode. */
  runner: InferenceRunner
  maxParallelInference?: number
  resilience?: Omit<ResilientRunnerOptions, "semaphore" | "onHalted">
}

/**
 * Creates one SuiteSpot runtime. The app creates exactly one; tests create a fresh one per test.
 * Every model call goes through ResilientRunner (retries, semaphore, no crash on provider errors).
 */
export function createAppRuntime(options: AppRuntimeOptions) {
  const rt = defineRuntime<SuiteSpotState>()
  const state = options.state ?? new SuiteSpotState()
  const semaphore = new Semaphore(options.maxParallelInference ?? 4)
  const loopsByContext = new Map<string, LoopInfo>()

  const runner = new ResilientRunner(options.runner, {
    ...options.resilience,
    semaphore,
    onHalted: (input, reason) => {
      const loop = loopsByContext.get(input.context.id)
      if (!loop) return
      rt.sendEvent(SemanticEvent.create("agent.halted", loop.agentId, { loopKey: loop.key, candidateId: loop.candidateId, reason }), loop.agentId)
    },
  })

  const service = rt.initializeRuntime({ state, inferenceRunnerConfig: { runner } })

  /**
   * Starts one agent loop with its OWN context. Mozaik mutates ModelContext in place, so parallel loops of the
   * same agent must never share agent.getMemory().getContext(). Fire-and-forget: never await this.
   */
  function startLoop(opts: StartLoopOptions): ModelContext {
    const context = ModelContext.create().addContextItem(DeveloperMessageItem.create(opts.agent.getDeveloperMessage()))
    loopsByContext.set(context.id, {
      key: opts.key,
      agentId: opts.agent.getId(),
      agentName: opts.agent.getManifest().name,
      candidateId: opts.candidateId,
    })
    const input: InferenceInput = {
      model: opts.model,
      context,
      tools: opts.tools ?? opts.agent.getTools(),
      structuredOutput: opts.structuredOutput,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
    }
    rt.runLoop(opts.agent.getId(), opts.message, input, opts.interception)
    return context
  }

  /** Finds the loop an event belongs to (events carry Mozaik's loopId plus, early on, our context id). */
  function loopForEvent(event: SemanticEvent): LoopInfo | undefined {
    const payload = event.payload as { loopId?: string; input?: { context?: ModelContext }; context?: ModelContext }
    const contextId = payload.input?.context?.id ?? payload.context?.id
    if (contextId) {
      const loop = loopsByContext.get(contextId)
      if (loop && payload.loopId) loop.loopId = payload.loopId
      if (loop) return loop
    }
    if (!payload.loopId) return undefined
    for (const loop of loopsByContext.values()) if (loop.loopId === payload.loopId) return loop
    return undefined
  }

  return { ...rt, service, state, semaphore, startLoop, loopForEvent, loops: () => [...loopsByContext.values()] }
}

export type AppRuntime = ReturnType<typeof createAppRuntime>
