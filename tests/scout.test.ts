import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createHuman, type InferenceInput } from "@mozaik-ai/core"
import { loadDemoListings, loadScoutAnswers } from "../src/adapters/fixtures/demo-listings.js"
import { MockRunner, lastUserText, type MockReply, type MockScript } from "../src/adapters/inference/mock-runner.js"
import { listingIdOf, scoutDemoScript } from "../src/adapters/inference/scripts/scout-script.js"
import { createScout, submitListings } from "../src/application/agents/scout.js"
import { createRecorder } from "../src/application/observers/recorder.js"
import { createAppRuntime } from "../src/application/runtime.js"
import { isMissingData, type ListingTextInput } from "../src/domain/index.js"
import { waitFor } from "./helpers.js"

function setup(script: MockScript) {
  const rt = createAppRuntime({ runner: new MockRunner({ script }), maxParallelInference: 8, resilience: { retries: 0 } })
  const recorder = createRecorder()
  const user = createHuman({ name: "User", capabilities: [], handlers: [] })
  const scout = createScout(rt, { model: "mock" })
  for (const p of [recorder.participant, user, scout]) rt.join(p)
  return { rt, recorder, user, scout }
}

const payload = <T>(e: { event: { payload: unknown } }) => e.event.payload as T

/** Everything reachable from an event payload as text (cycle safe), to prove no contact data travels on the bus. */
function dump(value: unknown): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, (_k, v: unknown) => {
    if (typeof v === "object" && v !== null) {
      if (seen.has(v)) return undefined
      seen.add(v)
    }
    return v
  })
}

describe("Scout (keyless, MockRunner)", () => {
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => unhandled.push(reason)
  beforeEach(() => {
    unhandled.length = 0
    process.on("unhandledRejection", onUnhandled)
  })
  afterEach(() => {
    process.off("unhandledRejection", onUnhandled)
  })

  // Different latency per listing, so loops finish in a known order that is NOT the input order.
  const LATENCY: Record<string, number> = { "demo-01": 240, "demo-02": 30, "demo-03": 180, "demo-04": 90, "demo-05": 150, "demo-06": 60, "demo-07": 210, "demo-08": 120 }

  it("reads 8 demo listings in parallel and publishes candidate.found one by one, as each is read", async () => {
    const { rt, recorder, user, scout } = setup(scoutDemoScript(loadScoutAnswers(), { latencyMs: (id) => LATENCY[id] ?? 0 }))
    const started = Date.now()
    submitListings(rt, loadDemoListings(), user.getId())

    const found = () => recorder.events.filter((e) => e.type === "candidate.found")
    await waitFor(() => found().length === 8, 3000, "8 candidates")
    const elapsed = Date.now() - started

    const types = recorder.events.map((e) => e.type)
    const own = recorder.events.filter((e) => e.producerId === scout.getId())
    // Exactly one submission, 8 loops, 8 answers, 8 candidates, nothing rejected or failed.
    expect(types.filter((t) => t === "listings.submitted")).toHaveLength(1)
    expect(own.filter((e) => e.type === "message_received.started")).toHaveLength(8)
    expect(own.filter((e) => e.type === "model.answer")).toHaveLength(8)
    expect(types.filter((t) => t.startsWith("listing.extraction_"))).toEqual([])

    // Parallel: all 8 loops started before the first answer arrived.
    const firstAnswer = types.indexOf("model.answer")
    const starts = recorder.events.map((e, i) => (e.type === "message_received.started" ? i : -1)).filter((i) => i >= 0)
    expect(Math.max(...starts)).toBeLessThan(firstAnswer)

    // One by one: candidates appear in finishing order (fastest first), and the first one is out before the
    // last answer arrives. Each candidate.found comes right after its own loop's answer.
    const order = found().map((e) => payload<{ candidateId: string }>(e).candidateId)
    expect(order).toEqual(Object.entries(LATENCY).sort((a, b) => a[1] - b[1]).map(([id]) => id))
    expect(types.indexOf("candidate.found")).toBeLessThan(types.lastIndexOf("model.answer"))
    for (const id of order) {
      const answerAt = recorder.events.findIndex((e) => e.type === "model.answer" && rt.loopForEvent(e.event)?.key === `scout:${id}:1`)
      const foundAt = recorder.events.findIndex((e) => e.type === "candidate.found" && payload<{ candidateId: string }>(e).candidateId === id)
      expect(answerAt).toBeGreaterThanOrEqual(0)
      expect(foundAt).toBeGreaterThan(answerAt)
    }

    // Total time is close to the slowest listing (240 ms), far below the sum (1080 ms).
    expect(elapsed).toBeLessThan(700)
    expect(rt.state.candidates.size).toBe(8)
    expect([...rt.state.candidates.values()].every((c) => c.status === "pending" && c.listing.synthetic)).toBe(true)
    expect(unhandled).toEqual([])
  })

  it("a listing without an area gets MissingData, never an invented number", async () => {
    const { rt, recorder, user } = setup(scoutDemoScript(loadScoutAnswers()))
    submitListings(rt, loadDemoListings(), user.getId())
    await waitFor(() => rt.state.candidates.size === 8, 3000, "8 candidates")

    const demo03 = rt.state.candidate("demo-03").listing
    expect(isMissingData(demo03.area)).toBe(true)
    expect(demo03.area).toEqual({ status: "missing_data", missing: ["area"] })
    // What the text does state carries its source and quote.
    expect(demo03.rentMonthly).toMatchObject({ source: { kind: "listing", ref: "demo-03", field: "rentMonthly", quote: "cena 900e" } })
    expect(isMissingData(demo03.rentMonthly)).toBe(false)
    // "Cena na upit" (price on request) stays missing; "jedna kirija" (one month's rent) is not computed.
    expect(isMissingData(rt.state.candidate("demo-08").listing.rentMonthly)).toBe(true)
    expect(isMissingData(rt.state.candidate("demo-07").listing.deposit)).toBe(true)

    const announced = recorder.events.find((e) => e.type === "candidate.found" && payload<{ candidateId: string }>(e).candidateId === "demo-03")
    expect(payload<{ missing: string[] }>(announced!).missing).toContain("area")
  })

  it("pasted text: phone numbers and emails are removed before the Scout, the model or the bus see them", async () => {
    const modelInputs: string[] = []
    const answers = {
      "pasted-1": { ...(loadScoutAnswers()["demo-03"] as object) },
      "pasted-2": { ...(loadScoutAnswers()["demo-06"] as object) },
    }
    const inner = scoutDemoScript(answers)
    const { rt, recorder, user } = setup(async (input: InferenceInput) => {
      modelInputs.push(lastUserText(input))
      return inner(input)
    })
    const pasted: ListingTextInput[] = [
      { text: loadDemoListings()[2]!.text + "\nzvati na 064/123-4567 ili +381 21 456 7890, mail vlasnik.lokala@example.com" },
      { text: loadDemoListings()[5]!.text + "\nINFO 065 111 2222" },
    ]
    submitListings(rt, pasted, user.getId())
    await waitFor(() => rt.state.candidates.size === 2, 3000, "2 candidates")

    const contacts = /064\/123-4567|\+381 21 456 7890|065 111 2222|vlasnik\.lokala@example\.com/
    for (const t of rt.state.listingTexts.values()) expect(t.text).not.toMatch(contacts)
    for (const c of rt.state.candidates.values()) expect(c.listing.text).not.toMatch(contacts)
    expect(modelInputs).toHaveLength(2)
    for (const m of modelInputs) expect(m).not.toMatch(contacts)
    for (const e of recorder.events) expect(dump(e.event.payload)).not.toMatch(contacts)

    const submitted = recorder.events.find((e) => e.type === "listings.submitted")!
    expect(payload<{ removedContacts: unknown }>(submitted).removedContacts).toEqual({ phones: 3, emails: 1 })
  })

  it("a value without a source goes back to the Scout as feedback, then the fixed listing becomes a candidate", async () => {
    const good = loadScoutAnswers()["demo-01"] as Record<string, unknown>
    const messages: string[] = []
    const script: MockScript = async (input): Promise<MockReply> => {
      const text = lastUserText(input)
      messages.push(text)
      const retry = text.includes("previous extraction was rejected")
      const answer = retry ? good : { ...good, rentMonthly: { found: true, amount: 1250, currency: "EUR", quote: null } }
      return { text: JSON.stringify(answer) }
    }
    const { rt, recorder, user } = setup(script)
    submitListings(rt, [loadDemoListings()[0]!], user.getId())
    await waitFor(() => rt.state.candidates.size === 1, 3000, "candidate after retry")

    const rejected = recorder.events.filter((e) => e.type === "listing.extraction_rejected")
    expect(rejected).toHaveLength(1)
    expect(payload<{ reason: string }>(rejected[0]!).reason).toContain("rentMonthly: value has no quote")
    expect(messages[1]).toContain("rentMonthly: value has no quote")
    expect(recorder.events.filter((e) => e.type === "candidate.found")).toHaveLength(1)
    expect(rt.state.failedListings).toEqual([])
  })

  it("a listing that stays invalid goes to the failed queue; the other listings are not affected", async () => {
    const answers = loadScoutAnswers()
    const script: MockScript = async (input): Promise<MockReply> => {
      const id = listingIdOf(input)
      if (id === "demo-02") return { text: JSON.stringify({ ...(answers[id] as object), area: { found: true, value: 999, quote: "58m2 u prizemlju" } }) }
      return { text: JSON.stringify(answers[id!]) }
    }
    const { rt, recorder, user } = setup(script)
    submitListings(rt, loadDemoListings().slice(0, 3), user.getId())
    await waitFor(() => recorder.events.some((e) => e.type === "listing.extraction_failed") && rt.state.candidates.size === 2, 3000, "1 failed, 2 found")

    expect(rt.state.failedListings).toHaveLength(1)
    expect(rt.state.failedListings[0]).toMatchObject({ listingId: "demo-02", attempts: 2 })
    expect(rt.state.candidates.has("demo-02")).toBe(false)
    expect(recorder.events.filter((e) => e.type === "candidate.found").map((e) => payload<{ candidateId: string }>(e).candidateId).sort()).toEqual(["demo-01", "demo-03"])
    expect(unhandled).toEqual([])
  })
})
