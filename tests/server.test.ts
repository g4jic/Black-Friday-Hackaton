import { afterEach, describe, expect, it } from "vitest"
import { MockRunner } from "../src/adapters/inference/mock-runner.js"
import { FAST_PACE } from "../src/adapters/server/research-routes.js"
import { buildServer } from "../src/adapters/server/server.js"
import type { WireEvent } from "../src/application/research/wire.js"

const FAKE_KEY = "sk-ant-test-0123456789-THIS-MUST-NEVER-LEAVE-THE-SERVER"

function parseSse(body: string): { id: number; event: string; data: WireEvent }[] {
  return body
    .split("\n\n")
    .filter((block) => block.includes("data: "))
    .map((block) => {
      const line = (name: string) => block.split("\n").find((l) => l.startsWith(`${name}: `))?.slice(name.length + 2) ?? ""
      return { id: Number(line("id")), event: line("event"), data: JSON.parse(line("data")) as WireEvent }
    })
}

describe("server", () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
  })

  it("answers the health check in demo mode by default", async () => {
    delete process.env.SUITESPOT_MODE
    const app = await buildServer()
    const res = await app.inject({ method: "GET", url: "/api/health" })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: "ok", mode: "demo" })
    await app.close()
  })

  it("streams the research events over SSE in bus order, and resumes after Last-Event-ID", async () => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY
    delete process.env.SUITESPOT_MODE
    const app = await buildServer({ demoPace: FAST_PACE })
    const post = await app.inject({ method: "POST", url: "/api/research", payload: { source: "demo" } })
    expect(post.statusCode).toBe(201)
    const { id } = post.json() as { id: string }

    const sse = await app.inject({ method: "GET", url: `/api/research/${id}/events` })
    expect(sse.headers["content-type"]).toContain("text/event-stream")
    const events = parseSse(sse.body)
    // Numbered 1..n without gaps, ids match seq, times never go back, and the stream ends with research.done.
    expect(events.map((e) => e.id)).toEqual(events.map((_, i) => i + 1))
    expect(events.every((e) => e.id === e.data.seq)).toBe(true)
    expect(events.every((e, i) => i === 0 || e.data.at >= events[i - 1]!.data.at)).toBe(true)
    expect(events.at(-1)).toMatchObject({ event: "done", data: { type: "research.done" } })

    // The demo story is in the right order: Finance starts on demo-07, the lease rejects it, Finance is cut.
    const index = (pred: (e: WireEvent) => boolean) => events.findIndex((e) => pred(e.data))
    const financeStart = index((e) => e.type === "loop.started" && e.loopKey === "finance:demo-07:1")
    const rejected = index((e) => e.type === "candidate.rejected" && e.candidateId === "demo-07")
    const cancelled = index((e) => e.type === "loop.cancelled" && e.loopKey === "finance:demo-07:1")
    expect(financeStart).toBeGreaterThan(0)
    expect(financeStart).toBeLessThan(rejected)
    expect(rejected).toBeLessThan(cancelled)
    expect(events.filter((e) => e.data.type === "candidate.found")).toHaveLength(8)
    const metrics = events.at(-1)!.data.data!.metrics as { loops: number; peakParallel: number; rejected: number }
    expect(metrics.rejected).toBe(2) // demo-02 over budget (Finance) and demo-07 (lease)
    expect(metrics.peakParallel).toBeGreaterThan(1)

    const resumed = parseSse((await app.inject({ method: "GET", url: `/api/research/${id}/events`, headers: { "last-event-id": "10" } })).body)
    expect(resumed[0]!.id).toBe(11)
    expect(resumed).toHaveLength(events.length - 10)
    await app.close()
  })

  it("the API key never appears in any server response", async () => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY
    process.env.SUITESPOT_MODE = "demo"
    const app = await buildServer({ demoPace: FAST_PACE })
    const bodies: string[] = []
    const call = async (url: string, method: "GET" | "POST" = "GET", payload?: object) => {
      const res = await app.inject({ method, url, payload })
      bodies.push(res.body, JSON.stringify(res.headers))
      return res
    }
    await call("/api/health")
    await call("/api/config")
    const { id } = (await call("/api/research", "POST", { source: "demo" })).json() as { id: string }
    await call(`/api/research/${id}/events`)
    await call(`/api/research/${id}`)
    expect((await call("/api/research", "POST", { mode: "live", source: "demo" })).statusCode).toBe(403)
    expect((await call("/api/research", "POST", { source: "pasted", listings: [{ text: "lokal" }] })).statusCode).toBe(400)
    for (const body of bodies) expect(body).not.toContain(FAKE_KEY)
    for (const body of bodies) expect(body).not.toContain("sk-ant-")
    await app.close()
  })

  it("cost guard: at most 8 listings, and at most one live research at a time", async () => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY
    process.env.SUITESPOT_MODE = "live"
    // A slow fake "live" model: no network, no cost.
    const app = await buildServer({ demoPace: FAST_PACE, liveRunner: () => new MockRunner({ latencyMs: 400, script: () => ({ text: "{}" }) }) })
    const nine = Array.from({ length: 9 }, (_, i) => ({ text: `Lokal ${i + 1}, Novi Sad` }))
    const tooMany = await app.inject({ method: "POST", url: "/api/research", payload: { mode: "live", source: "pasted", listings: nine } })
    expect(tooMany.statusCode).toBe(400)
    expect(tooMany.json()).toEqual({ error: "A research run takes 1 to 8 listings, got 9" })

    const first = await app.inject({ method: "POST", url: "/api/research", payload: { mode: "live", source: "pasted", listings: nine.slice(0, 2) } })
    expect(first.statusCode).toBe(201)
    const second = await app.inject({ method: "POST", url: "/api/research", payload: { mode: "live", source: "demo" } })
    expect(second.statusCode).toBe(429)
    // Demo runs are not limited by the live guard.
    expect((await app.inject({ method: "POST", url: "/api/research", payload: { source: "demo" } })).statusCode).toBe(201)
    await app.close()
  })
})
