import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { Agent, SemanticEvent, SituationSpecification, createAgent, createHuman, type InferenceInput, type SituationContext, type Tool } from "@mozaik-ai/core"
import { MockRunner, developerText, lastUserText, toolOutputs, type MockReply } from "../src/adapters/inference/mock-runner.js"
import {
  CandidateCancellation,
  STOPPED_PREFIX,
  cancellableTool,
  rejectCandidate,
} from "../src/application/cancellation/candidate-cancellation.js"
import { createRecorder } from "../src/application/observers/recorder.js"
import { safeHandler } from "../src/application/resilience/safe-handler.js"
import { createAppRuntime, type AppRuntime } from "../src/application/runtime.js"
import { Candidate, Money, budgetExceeded, emptyListing, sourced, type Candidate as CandidateT, type Listing } from "../src/domain/index.js"
import { answerText, waitFor } from "./helpers.js"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const listing = (id: string): Listing => emptyListing(`https://example.test/listing/${id}`)

class WhenCandidateFound extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "candidate.found"
  }
}

type Probe = {
  modelCalls: Map<string, number>
  osmCalls: Map<string, number>
  leaseUnderlyingAborted: Set<string>
}

/** Tools per agent per candidate. Every tool is wrapped so a hard flag can stop it mid-call. */
function toolsFor(rt: AppRuntime, agentName: string, agentId: string, c: CandidateT, probe: Probe): Tool[] {
  if (agentName === "Finance") {
    return [
      cancellableTool({ type: "function", name: "check_budget", description: "Check monthly cost against budget", parameters: { type: "object", properties: {}, additionalProperties: false }, strict: true }, c, agentName, async () => {
        await sleep(20)
        const monthly = sourced(Money.of(c.id === "c1" ? 1450 : 1100, "EUR"), { kind: "listing", ref: c.listing.ref, field: "rent" })
        const budget = sourced(Money.of(1300, "EUR"), { kind: "profile", ref: "questionnaire", field: "monthlyBudget" })
        const flag = budgetExceeded(monthly, budget, "Finance")
        if (!flag) return "Within budget"
        rejectCandidate(rt, c.id, flag, agentId)
        return `Hard flag raised: ${flag.reason}`
      }),
    ]
  }
  if (agentName === "Lease") {
    return [
      cancellableTool({ type: "function", name: "fetch_listing_page", description: "Slow page fetch", parameters: { type: "object", properties: {}, additionalProperties: false }, strict: true }, c, agentName, async (_args, signal) => {
        // Simulates a 2 s web fetch that honours the abort signal (like fetch(url, { signal })).
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, 2000)
          signal.addEventListener("abort", () => {
            clearTimeout(t)
            probe.leaseUnderlyingAborted.add(c.id)
            reject(new Error("aborted"))
          })
        })
        return "page text"
      }),
    ]
  }
  if (agentName === "Location") {
    return [
      cancellableTool({ type: "function", name: "osm_lookup", description: "OSM query", parameters: { type: "object", properties: {}, additionalProperties: false }, strict: true }, c, agentName, async () => {
        probe.osmCalls.set(c.id, (probe.osmCalls.get(c.id) ?? 0) + 1)
        await sleep(10)
        return "3 competitors within 300 m"
      }),
    ]
  }
  return []
}

function evaluator(rt: AppRuntime, name: string, probe: Probe): Agent {
  return createAgent({
    name,
    capabilities: ["inference"],
    instruction: `ROLE=${name}`,
    tools: [],
    handlers: [
      safeHandler({
        specification: new WhenCandidateFound(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const { candidateId } = event.payload as { candidateId: string }
            const candidate = rt.state.candidate(candidateId)
            rt.startLoop({
              agent: participant,
              key: `${name}:${candidateId}`,
              candidateId,
              message: `Evaluate candidate ${candidateId}`,
              model: "mock",
              tools: toolsFor(rt, name, participant.getId(), candidate, probe),
              interception: new CandidateCancellation(candidate, name),
            })
          },
        },
      }),
    ],
  })
}

/** The scripted "models". Per-role latency is inside the script, so we control exactly where the flag lands. */
function script(probe: Probe) {
  return async (req: InferenceInput): Promise<MockReply> => {
    const role = developerText(req).replace("ROLE=", "")
    const cid = lastUserText(req).split(" ").pop() ?? "?"
    const key = `${role}:${cid}`
    probe.modelCalls.set(key, (probe.modelCalls.get(key) ?? 0) + 1)
    const outputs = toolOutputs(req)
    switch (role) {
      case "Finance":
        await sleep(50)
        return outputs.length === 0 ? { toolCall: { name: "check_budget", args: {} } } : { text: `finance: ${outputs[0]}` }
      case "Lease":
        await sleep(20)
        return outputs.length === 0 ? { toolCall: { name: "fetch_listing_page", args: {} } } : { text: "lease: fine" }
      case "Location":
        await sleep(40)
        return outputs.length < 5 ? { toolCall: { name: "osm_lookup", args: {} } } : { text: "location: done" }
      default:
        await sleep(300) // Premises: one long model call; the flag lands while it is in flight.
        return { text: "premises: fine" }
    }
  }
}

describe("hard flag cancels a candidate (interception spike, Mozaik 6.0.0)", () => {
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => unhandled.push(reason)
  beforeEach(() => {
    unhandled.length = 0
    process.on("unhandledRejection", onUnhandled)
  })
  afterEach(() => {
    process.off("unhandledRejection", onUnhandled)
  })

  it("stops other evaluators between steps, mid tool call and mid inference, without touching the other candidate", async () => {
    const probe: Probe = { modelCalls: new Map(), osmCalls: new Map(), leaseUnderlyingAborted: new Set() }
    const rt = createAppRuntime({ runner: new MockRunner({ script: script(probe) }), maxParallelInference: 8, resilience: { retries: 0 } })
    const recorder = createRecorder()
    const scout = createHuman({ name: "Scout", capabilities: [], handlers: [] })
    const roles = ["Finance", "Lease", "Location", "Premises"] as const
    const agents = Object.fromEntries(roles.map((r) => [r, evaluator(rt, r, probe)])) as Record<(typeof roles)[number], Agent>
    for (const p of [recorder.participant, scout, ...Object.values(agents)]) rt.join(p)

    const started = Date.now()
    for (const id of ["c1", "c2"]) {
      rt.state.addCandidate(new Candidate(id, listing(id))).startEvaluation()
      rt.sendEvent(SemanticEvent.create("candidate.found", scout.getId(), { candidateId: id }), scout.getId())
    }

    // 8 loops: 4 evaluators x 2 candidates.
    const answers = () => recorder.events.filter((e) => e.type === "model.answer")
    await waitFor(() => answers().length === 8, 5000, "8 answers")
    const elapsed = Date.now() - started

    // Map every answer to its loop (agent + candidate) through the runtime's loop registry.
    for (const e of recorder.events) rt.loopForEvent(e.event)
    const byKey = new Map<string, { text: string; at: number }>()
    for (const e of answers()) {
      const loop = rt.loopForEvent(e.event)
      if (loop) byKey.set(loop.key, { text: answerText(e.event), at: e.at - started })
    }

    if (process.env.SPIKE_REPORT) {
      const rejectedAt = recorder.events.find((e) => e.type === "candidate.rejected")!.at - started
      console.log(`candidate c1 rejected at ${rejectedAt} ms`)
      for (const [key, v] of [...byKey].sort()) console.log(`${key.padEnd(12)} ${String(v.at).padStart(5)} ms  ${v.text.slice(0, 70)}`)
      console.log("model calls", Object.fromEntries(probe.modelCalls), "osm calls", Object.fromEntries(probe.osmCalls), "total", elapsed, "ms")
    }

    // c1 was rejected by Finance; Finance itself finishes its own explanation.
    expect(rt.state.candidate("c1").status).toBe("rejected")
    expect(rt.state.candidate("c1").rejection?.raisedBy).toBe("Finance")
    expect(byKey.get("Finance:c1")?.text).toContain("Hard flag raised")

    // Mid tool call: the 2 s fetch was cut short, its underlying work got the abort signal,
    // and the model was never called again for that loop.
    expect(byKey.get("Lease:c1")?.text.startsWith(STOPPED_PREFIX)).toBe(true)
    expect(byKey.get("Lease:c1")!.at).toBeLessThan(500)
    expect(probe.leaseUnderlyingAborted.has("c1")).toBe(true)
    expect(probe.modelCalls.get("Lease:c1")).toBe(1)

    // Between steps: the multi-step OSM loop stopped before finishing its 5 lookups.
    expect(byKey.get("Location:c1")?.text.startsWith(STOPPED_PREFIX)).toBe(true)
    expect(probe.osmCalls.get("c1") ?? 0).toBeLessThan(5)

    // Mid inference: the in-flight model answer was replaced at the model_message breakpoint.
    expect(byKey.get("Premises:c1")?.text.startsWith(STOPPED_PREFIX)).toBe(true)

    // c2 is untouched: every evaluator gives its normal answer.
    expect(rt.state.candidate("c2").status).toBe("evaluating")
    expect(byKey.get("Finance:c2")?.text).toBe("finance: Within budget")
    expect(byKey.get("Lease:c2")?.text).toBe("lease: fine")
    expect(byKey.get("Location:c2")?.text).toBe("location: done")
    expect(byKey.get("Premises:c2")?.text).toBe("premises: fine")
    expect(probe.osmCalls.get("c2")).toBe(5)

    // Visible on the bus for the UI: one rejection event, and interception events for the stopped loops.
    expect(recorder.events.filter((e) => e.type === "candidate.rejected")).toHaveLength(1)
    expect(recorder.events.filter((e) => e.type === "interception.started").length).toBeGreaterThanOrEqual(3)

    // Nothing escaped, and everything ran in parallel (c2's Lease alone takes 2 s; total stays close to that).
    expect(unhandled).toEqual([])
    expect(elapsed).toBeLessThan(2600)
  })

  it("a second hard flag on the same candidate is recorded but changes nothing (idempotent)", () => {
    const rt = createAppRuntime({ runner: new MockRunner(), resilience: { retries: 0 } })
    const recorder = createRecorder()
    const p = createHuman({ name: "Code", capabilities: [], handlers: [] })
    rt.join(recorder.participant)
    rt.join(p)
    const c = rt.state.addCandidate(new Candidate("c1", listing("c1")))
    const flag = { aspect: "finance" as const, rule: "r", reason: "x", raisedBy: "Finance", source: { kind: "listing" as const, ref: c.listing.ref } }
    expect(rejectCandidate(rt, "c1", flag, p.getId())).toBe(true)
    expect(rejectCandidate(rt, "c1", { ...flag, raisedBy: "Location" }, p.getId())).toBe(false)
    expect(c.rejection?.raisedBy).toBe("Finance")
    expect(recorder.events.map((e) => e.type).filter((t) => t.startsWith("candidate."))).toEqual(["candidate.rejected", "candidate.flag_recorded"])
  })
})
