import { createHash } from "node:crypto"
import {
  FunctionCallItem,
  ModelMessageItem,
  SemanticEvent,
  type InferenceInput,
  type InferenceOutput,
  type InferenceRunner,
} from "@mozaik-ai/core"
import { INFERENCE_FAILED_PREFIX } from "../../application/resilience/resilient-runner.js"
import { developerText, lastUserText, toolOutputs } from "./mock-runner.js"

/**
 * Recorded runs: a real run with the model is recorded once (`npm run record:demo`) and replayed without a key. Every
 * replayed answer is exactly what the model said in that run; code still checks each value against its source, and
 * every result screen says "Recorded run".
 */
export type RecordedItem = { readonly text: string } | { readonly call: { readonly name: string; readonly args: string } }
export type RecordedCall = { readonly agent: string; readonly latencyMs: number; readonly items: readonly RecordedItem[]; readonly tokens?: { readonly input: number; readonly output: number } }
export type Recording = { readonly scenario: string; readonly model: string; readonly recordedAt: string; readonly calls: Record<string, RecordedCall[]> }

/**
 * The key of one inference request: which agent asks (from its instruction) and what it was given (the last user
 * message and the tool results so far). The same request in a replay finds the same recorded answer, whatever order
 * the parallel loops happen to run in.
 */
export function recordingKey(input: InferenceInput): string {
  const agent = /You are the ([A-Za-z ]+?) of SuiteSpot/.exec(developerText(input))?.[1] ?? "Agent"
  const hash = createHash("sha256").update(lastUserText(input)).update("\n--tools--\n").update(toolOutputs(input).join("\n--\n")).digest("hex").slice(0, 24)
  return `${agent}:${hash}`
}

const toRecorded = (output: InferenceOutput): RecordedItem[] =>
  output.items.flatMap((item): RecordedItem[] => {
    if (item instanceof FunctionCallItem) return [{ call: { name: item.name, args: item.args } }]
    if (item instanceof ModelMessageItem) return [{ text: item.content.text }]
    return []
  })

let replayCallCounter = 0
const fromRecorded = (items: readonly RecordedItem[]) =>
  items.map((i) => ("text" in i ? ModelMessageItem.rehydrate({ text: i.text }) : FunctionCallItem.rehydrate({ callId: `replay_call_${++replayCallCounter}`, name: i.call.name, args: i.call.args })))

/** Wraps the live runner and keeps every request and answer. */
export class RecordingRunner implements InferenceRunner {
  private readonly calls: Record<string, RecordedCall[]> = {}

  constructor(private readonly inner: InferenceRunner) {}

  async run(input: InferenceInput): Promise<InferenceOutput> {
    const key = recordingKey(input)
    const started = Date.now()
    const output = await this.inner.run(input)
    const usage = output.tokenUsage as { inputTokens?: number; outputTokens?: number } | undefined
    ;(this.calls[key] ??= []).push({
      agent: key.split(":")[0]!,
      latencyMs: Date.now() - started,
      items: toRecorded(output),
      ...(usage ? { tokens: { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 } } : {}),
    })
    return output
  }

  async *stream(input: InferenceInput): AsyncGenerator<SemanticEvent> {
    yield SemanticEvent.create("inference.output", "recording-runner", await this.run(input))
  }

  recording(scenario: string, model: string): Recording {
    return { scenario, model, recordedAt: new Date().toISOString(), calls: this.calls }
  }
}

/**
 * Replays a recording without a key, with the recorded latency (times `speed`) so the parallel loops overlap as they
 * did. A request that was never recorded gets the same answer as a provider failure: the agent records it as a
 * failure instead of inventing anything.
 */
export class ReplayRunner implements InferenceRunner {
  private readonly used = new Map<string, number>()

  constructor(
    private readonly recording: Recording,
    private readonly speed = 0.5,
  ) {}

  async run(input: InferenceInput): Promise<InferenceOutput> {
    const key = recordingKey(input)
    const list = this.recording.calls[key] ?? []
    const n = this.used.get(key) ?? 0
    const call = list[Math.min(n, list.length - 1)]
    this.used.set(key, n + 1)
    if (!call) return { items: [ModelMessageItem.rehydrate({ text: `${INFERENCE_FAILED_PREFIX} this request is not in the recording` })], tokenUsage: undefined, rowResponse: { replay: true } }
    await new Promise((r) => setTimeout(r, Math.round(call.latencyMs * this.speed)))
    return { items: fromRecorded(call.items), tokenUsage: undefined, rowResponse: { replay: true } }
  }

  async *stream(input: InferenceInput): AsyncGenerator<SemanticEvent> {
    yield SemanticEvent.create("inference.output", "replay-runner", await this.run(input))
  }

  /** Requests the replay asked for that the recording does not have (0 in a faithful replay). */
  missing(): string[] {
    return [...this.used.keys()].filter((k) => !this.recording.calls[k])
  }
}
