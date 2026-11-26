import {
  FunctionCallItem,
  ModelMessageItem,
  SemanticEvent,
  type InferenceInput,
  type InferenceOutput,
  type InferenceRunner,
} from "@mozaik-ai/core"

/** What the scripted model does next: answer with text, or propose one tool call. */
export type MockReply = { text: string } | { toolCall: { name: string; args: Record<string, unknown> } }

/** A deterministic "model": looks at the request (instruction, messages, tool results) and decides the reply. */
export type MockScript = (input: InferenceInput) => MockReply | Promise<MockReply>

export type MockRunnerOptions = {
  script?: MockScript
  /** Simulated model latency, so concurrency is visible in the timeline. */
  latencyMs?: number
}

let callCounter = 0

/**
 * Keyless InferenceRunner used in demo mode and tests. No network, no API key.
 * Implements the same contract as Mozaik's DefaultInferenceRunner.
 */
export class MockRunner implements InferenceRunner {
  private readonly script: MockScript
  private readonly latencyMs: number

  constructor(options: MockRunnerOptions = {}) {
    this.script = options.script ?? (() => ({ text: "mock answer" }))
    this.latencyMs = options.latencyMs ?? 0
  }

  async run(input: InferenceInput): Promise<InferenceOutput> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs))
    const reply = await this.script(input)
    const item =
      "text" in reply
        ? ModelMessageItem.rehydrate({ text: reply.text })
        : FunctionCallItem.rehydrate({
            callId: `mock_call_${++callCounter}`,
            name: reply.toolCall.name,
            args: JSON.stringify(reply.toolCall.args),
          })
    return { items: [item], tokenUsage: undefined, rowResponse: { mock: true } }
  }

  async *stream(input: InferenceInput): AsyncGenerator<SemanticEvent> {
    // Mozaik's streaming state waits for one "inference.output" event that carries the final output.
    yield SemanticEvent.create("inference.output", "mock-runner", await this.run(input))
  }
}

type TextItem = { type: string; role?: string; content?: { text?: string }; output?: { text?: string } }

/** Helpers for scripts: read what is in the context so far. */
export function lastUserText(input: InferenceInput): string {
  const items = input.context.getItems() as unknown as TextItem[]
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item?.type === "message" && item.role === "user") return item.content?.text ?? ""
  }
  return ""
}

export function developerText(input: InferenceInput): string {
  const items = input.context.getItems() as unknown as TextItem[]
  return items.find((i) => i.role === "developer")?.content?.text ?? ""
}

export function toolOutputs(input: InferenceInput): string[] {
  const items = input.context.getItems() as unknown as TextItem[]
  return items.filter((i) => i.type === "function_call_output").map((i) => i.output?.text ?? "")
}
