import {
  ModelMessageItem,
  SemanticEvent,
  type InferenceInput,
  type InferenceOutput,
  type InferenceRunner,
} from "@mozaik-ai/core"
import type { Semaphore } from "./semaphore.js"

export const INFERENCE_FAILED_PREFIX = "Inference failed:"

export type ResilientRunnerOptions = {
  retries?: number
  baseDelayMs?: number
  semaphore?: Semaphore
  /** Called once when all retries are used up. Guarded: a throw here is logged, never propagated. */
  onHalted?: (input: InferenceInput, reason: string) => void
  /** Called on every failed attempt, for logging and the trace. */
  onRetry?: (input: InferenceInput, attempt: number, reason: string) => void
}

/**
 * Wraps a real InferenceRunner. Mozaik does not catch provider errors: a throw inside run() becomes an unhandled
 * rejection and kills the whole process. This wrapper retries with exponential backoff and, after the last retry,
 * returns a normal model message "Inference failed: <reason>" so the loop ends cleanly and other agents keep working.
 */
export class ResilientRunner implements InferenceRunner {
  private readonly retries: number
  private readonly baseDelayMs: number

  constructor(
    private readonly inner: InferenceRunner,
    private readonly options: ResilientRunnerOptions = {},
  ) {
    this.retries = options.retries ?? 3
    this.baseDelayMs = options.baseDelayMs ?? 500
  }

  async run(input: InferenceInput): Promise<InferenceOutput> {
    let lastReason = "unknown error"
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const call = () => this.inner.run(input)
        return await (this.options.semaphore ? this.options.semaphore.run(call) : call())
      } catch (error) {
        lastReason = describeError(error)
        this.safely(() => this.options.onRetry?.(input, attempt + 1, lastReason))
        if (!isRetryable(error) || attempt === this.retries) break
        await sleep(this.baseDelayMs * 2 ** attempt)
      }
    }
    this.safely(() => this.options.onHalted?.(input, lastReason))
    return failedOutput(lastReason)
  }

  // Streaming is not retried mid-stream; a failure becomes the same "Inference failed" answer.
  async *stream(input: InferenceInput): AsyncGenerator<SemanticEvent> {
    try {
      let sawOutput = false
      for await (const event of this.inner.stream(input)) {
        if (event.type === "inference.output") sawOutput = true
        yield event
      }
      if (!sawOutput) throw new Error("stream ended without output")
    } catch (error) {
      const reason = describeError(error)
      this.safely(() => this.options.onHalted?.(input, reason))
      yield SemanticEvent.create("inference.output", "resilient-runner", failedOutput(reason))
    }
  }

  private safely(fn: () => void): void {
    try {
      fn()
    } catch (error) {
      console.error("[resilient-runner] callback failed:", error)
    }
  }
}

export function isFailedAnswer(text: string): boolean {
  return text.startsWith(INFERENCE_FAILED_PREFIX)
}

function failedOutput(reason: string): InferenceOutput {
  return {
    items: [ModelMessageItem.rehydrate({ text: `${INFERENCE_FAILED_PREFIX} ${reason}` })],
    tokenUsage: undefined,
    rowResponse: null,
  }
}

/** 4xx errors (except timeout, conflict and rate limit) will fail the same way again, so we do not retry them. */
function isRetryable(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  if (typeof status !== "number") return true
  return status === 408 || status === 409 || status === 429 || status >= 500
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
