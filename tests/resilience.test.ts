import { describe, expect, it } from "vitest"
import {
  Agent,
  ModelContext,
  SituationSpecification,
  createAgent,
  createHuman,
  type InferenceInput,
  type InferenceRunner,
  type SituationContext,
} from "@mozaik-ai/core"
import { MockRunner, developerText } from "../src/adapters/inference/mock-runner.js"
import { ResilientRunner, isFailedAnswer } from "../src/application/resilience/resilient-runner.js"
import { safeHandler } from "../src/application/resilience/safe-handler.js"
import { Semaphore } from "../src/application/resilience/semaphore.js"
import { createAppRuntime, type AppRuntime } from "../src/application/runtime.js"
import { createRecorder } from "../src/application/observers/recorder.js"
import { answerText, waitFor } from "./helpers.js"

const input = (): InferenceInput => ({ model: "mock", context: ModelContext.create() })

class FailingRunner implements InferenceRunner {
  calls = 0
  constructor(private readonly error: unknown) {}
  async run(): Promise<never> {
    this.calls++
    throw this.error
  }
  // eslint-disable-next-line require-yield
  async *stream(): AsyncGenerator<never> {
    throw this.error
  }
}

describe("ResilientRunner", () => {
  it("retries a provider error with backoff, then answers 'Inference failed' instead of throwing", async () => {
    const inner = new FailingRunner(Object.assign(new Error("overloaded"), { status: 529 }))
    const halted: string[] = []
    const runner = new ResilientRunner(inner, { retries: 2, baseDelayMs: 1, onHalted: (_i, reason) => halted.push(reason) })
    const output = await runner.run(input())
    expect(inner.calls).toBe(3)
    const text = (output.items[0] as unknown as { content: { text: string } }).content.text
    expect(isFailedAnswer(text)).toBe(true)
    expect(text).toContain("overloaded")
    expect(halted).toEqual(["overloaded"])
  })

  it("does not retry a 400 request error (it would fail the same way)", async () => {
    const inner = new FailingRunner(Object.assign(new Error("bad request"), { status: 400 }))
    const runner = new ResilientRunner(inner, { retries: 3, baseDelayMs: 1 })
    await runner.run(input())
    expect(inner.calls).toBe(1)
  })

  it("survives a throwing onHalted callback", async () => {
    const runner = new ResilientRunner(new FailingRunner(new Error("x")), {
      retries: 0,
      onHalted: () => {
        throw new Error("callback bug")
      },
    })
    await expect(runner.run(input())).resolves.toBeDefined()
  })
})

describe("Semaphore", () => {
  it("never lets more than max tasks run at once", async () => {
    const sem = new Semaphore(2)
    let running = 0
    let maxSeen = 0
    await Promise.all(
      Array.from({ length: 6 }, () =>
        sem.run(async () => {
          running++
          maxSeen = Math.max(maxSeen, running)
          await new Promise((r) => setTimeout(r, 20))
          running--
        }),
      ),
    )
    expect(maxSeen).toBe(2)
    expect(sem.peakInUse).toBe(2)
  })
})

class WhenHumanSpeaks extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === "message.sent" && event.producerId !== participant.getId()
  }
}

function evaluator(rt: AppRuntime, name: string, instruction: string): Agent {
  return createAgent({
    name,
    capabilities: ["inference"],
    instruction,
    tools: [],
    handlers: [
      safeHandler({
        specification: new WhenHumanSpeaks(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const { message } = event.payload as { message: string }
            // Fire-and-forget: no await, every agent's loop runs at the same time.
            rt.startLoop({ agent: participant, message, key: `${name}:1`, model: "mock" })
          },
        },
      }),
    ],
  })
}

describe("failure isolation (end to end, keyless)", () => {
  it("one agent with a broken model and one throwing observer do not stop the other agents", async () => {
    const latencyMs = 200
    const mock = new MockRunner({
      latencyMs,
      script: (req) => {
        if (developerText(req).includes("BROKEN")) throw Object.assign(new Error("provider exploded"), { status: 500 })
        return { text: "mock answer" }
      },
    })
    const rt = createAppRuntime({ runner: mock, maxParallelInference: 4, resilience: { retries: 1, baseDelayMs: 1 } })
    const recorder = createRecorder()
    const reported: string[] = []
    const faultyObserver = createHuman({
      name: "FaultyObserver",
      capabilities: [],
      handlers: [
        safeHandler(
          {
            specification: new (class extends SituationSpecification {
              isSatisfiedBy() {
                return true
              }
            })(),
            processor: {
              apply() {
                throw new Error("observer bug")
              },
            },
          },
          (error) => reported.push(String(error)),
        ),
      ],
    })
    const user = createHuman({ name: "User", capabilities: [], handlers: [] })
    const a = evaluator(rt, "Finance", "You are the finance analyst.")
    const b = evaluator(rt, "Broken", "BROKEN agent.")
    const c = evaluator(rt, "Lease", "You are the lease reader.")
    for (const p of [recorder.participant, faultyObserver, user, a, b, c]) rt.join(p)

    const started = Date.now()
    rt.sendMessage("Evaluate candidate 1", user.getId())

    const answers = () => recorder.events.filter((e) => e.type === "model.answer")
    await waitFor(() => answers().length === 3, 5000, "3 answers")
    const elapsed = Date.now() - started

    const byAgent = new Map(answers().map((e) => [e.producerId, answerText(e.event)]))
    expect(byAgent.get(a.getId())).toBe("mock answer")
    expect(byAgent.get(c.getId())).toBe("mock answer")
    expect(isFailedAnswer(byAgent.get(b.getId()) ?? "")).toBe(true)

    const halted = recorder.events.filter((e) => e.type === "agent.halted")
    expect(halted).toHaveLength(1)
    expect(halted[0]?.producerId).toBe(b.getId())

    // The observer threw on every event, yet nothing crashed and every error was reported.
    expect(reported.length).toBeGreaterThan(10)

    // Real concurrency: three loops of 200 ms each finished in well under 3 x 200 ms.
    expect(elapsed).toBeLessThan(latencyMs * 2.5)
    expect(rt.semaphore.peakInUse).toBe(3)
  })
})
