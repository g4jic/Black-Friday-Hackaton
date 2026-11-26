import { afterEach, describe, expect, it } from "vitest"
import { MockRunner } from "../src/adapters/inference/mock-runner.js"
import { FAST_PACE } from "../src/adapters/server/research-routes.js"
import { buildServer } from "../src/adapters/server/server.js"
import type { WireEvent } from "../src/application/research/wire.js"
import { SAMPLE_CATALOGUE } from "./fixtures/sample-listings.js"

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

  it("answers the health check in demo mode when there is no key, live with a key", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const app = await buildServer()
    const res = await app.inject({ method: "GET", url: "/api/health" })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: "ok", mode: "demo" })
    process.env.ANTHROPIC_API_KEY = FAKE_KEY
    expect((await app.inject({ method: "GET", url: "/api/health" })).json()).toEqual({ status: "ok", mode: "live" })
    await app.close()
  })

  it("streams the research events over SSE in bus order, and resumes after Last-Event-ID", async () => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY
    delete process.env.ANTHROPIC_API_KEY
    const app = await buildServer({ demoCatalogue: SAMPLE_CATALOGUE, demoPace: FAST_PACE })
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

    // The demo story is in the right order: Finance starts on listing-07, the lease rejects it, Finance is cut.
    const index = (pred: (e: WireEvent) => boolean) => events.findIndex((e) => pred(e.data))
    const financeStart = index((e) => e.type === "loop.started" && e.loopKey === "finance:listing-07:1")
    const rejected = index((e) => e.type === "candidate.rejected" && e.candidateId === "listing-07")
    const cancelled = index((e) => e.type === "loop.cancelled" && e.loopKey === "finance:listing-07:1")
    expect(financeStart).toBeGreaterThan(0)
    expect(financeStart).toBeLessThan(rejected)
    expect(rejected).toBeLessThan(cancelled)
    expect(events.filter((e) => e.data.type === "candidate.found")).toHaveLength(8)
    const metrics = events.at(-1)!.data.data!.metrics as { loops: number; peakParallel: number; rejected: number }
    expect(metrics.rejected).toBe(2) // listing-02 over budget (Finance) and listing-07 (lease)
    expect(metrics.peakParallel).toBeGreaterThan(1)

    const resumed = parseSse((await app.inject({ method: "GET", url: `/api/research/${id}/events`, headers: { "last-event-id": "10" } })).body)
    expect(resumed[0]!.id).toBe(11)
    expect(resumed).toHaveLength(events.length - 10)
    await app.close()
  })

  it("the API key never appears in any server response", async () => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY
    // A key means live mode; the "model" here is a local fake (no network, no cost).
    const app = await buildServer({ demoCatalogue: SAMPLE_CATALOGUE, demoPace: FAST_PACE, liveRunner: () => new MockRunner({ latencyMs: 10, script: () => ({ text: "{}" }) }) })
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
    expect((await call("/api/research", "POST", { mode: "live", source: "demo" })).statusCode).toBe(201)
    expect((await call("/api/research", "POST", { source: "pasted", listings: [{ text: "lokal" }] })).statusCode).toBe(400)
    for (const body of bodies) expect(body).not.toContain(FAKE_KEY)
    for (const body of bodies) expect(body).not.toContain("sk-ant-")
    await app.close()
  })

  it("cancel: every loop stops at its next breakpoint, nothing is ranked, and the run ends as cancelled", async () => {
    delete process.env.ANTHROPIC_API_KEY
    // Demo pace slow enough that loops are still running when Cancel arrives.
    const app = await buildServer({ demoCatalogue: SAMPLE_CATALOGUE, demoPace: { scout: () => 300, leaseReader: 600, financeStep: 300, reportWriter: 300 } })
    const { id } = (await app.inject({ method: "POST", url: "/api/research", payload: { source: "demo" } })).json() as { id: string }
    expect((await app.inject({ method: "POST", url: "/api/research/unknown-id/cancel" })).statusCode).toBe(404)
    await new Promise((r) => setTimeout(r, 450)) // the Scout has started, Finance and Lease reader are working
    const cancel = await app.inject({ method: "POST", url: `/api/research/${id}/cancel` })
    expect(cancel.statusCode).toBe(202)
    const started = Date.now()
    const events = parseSse((await app.inject({ method: "GET", url: `/api/research/${id}/events` })).body).map((e) => e.data)
    expect(Date.now() - started).toBeLessThan(3000) // no timeout: it ends as soon as the loops have stopped
    const done = events.at(-1)!
    expect(done).toMatchObject({ type: "research.done", data: { cancelled: true, metrics: { timedOut: false } } })
    const cancelAt = events.findIndex((e) => e.type === "research.cancel_requested")
    expect(cancelAt).toBeGreaterThan(0)
    // Nothing new starts after Cancel, nothing is ranked or reported.
    expect(events.slice(cancelAt).filter((e) => e.type === "loop.started")).toHaveLength(0)
    expect(events.some((e) => e.type === "candidate.scored" || e.type === "ranking.done" || e.type === "report.ready")).toBe(false)
    // Every loop that started has ended.
    const startedLoops = events.filter((e) => e.type === "loop.started").length
    expect(events.filter((e) => e.type === "loop.answered")).toHaveLength(startedLoops)
    expect((await app.inject({ method: "POST", url: `/api/research/${id}/cancel` })).statusCode).toBe(409)
    await app.close()
  })

  it("live mode needs the access code when SUITESPOT_ACCESS_CODE is set; demo mode never does", async () => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY
    process.env.SUITESPOT_ACCESS_CODE = "open-sesame"
    const app = await buildServer({ demoCatalogue: SAMPLE_CATALOGUE, demoPace: FAST_PACE, liveRunner: () => new MockRunner({ latencyMs: 50, script: () => ({ text: "{}" }) }) })
    expect((await app.inject({ method: "GET", url: "/api/config" })).json()).toMatchObject({ liveAvailable: true, liveNeedsAccessCode: true })
    const live = { mode: "live", source: "pasted", listings: [{ text: "Lokal 60 m2, Novi Sad, 900 EUR" }] }
    const missing = await app.inject({ method: "POST", url: "/api/research", payload: live })
    expect(missing.statusCode).toBe(401)
    expect(missing.body).not.toContain("open-sesame")
    expect((await app.inject({ method: "POST", url: "/api/research", payload: live, headers: { "x-access-code": "wrong" } })).statusCode).toBe(401)
    expect((await app.inject({ method: "POST", url: "/api/research", payload: { source: "demo" } })).statusCode).toBe(201)
    // A live profile from the questionnaire is validated by the domain.
    const badProfile = await app.inject({ method: "POST", url: "/api/research", payload: { ...live, profile: { monthlyBudget: -5 } }, headers: { "x-access-code": "open-sesame" } })
    expect(badProfile.statusCode).toBe(400)
    const ok = await app.inject({ method: "POST", url: "/api/research", payload: { ...live, profile: { city: "Beograd", monthlyBudget: 2000 } }, headers: { "x-access-code": "open-sesame" } })
    expect(ok.statusCode).toBe(201)
    await app.close()
  })

  it("serves the fixed demo questionnaire for the locked form", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const app = await buildServer()
    const body = (await app.inject({ method: "GET", url: "/api/demo-questionnaire" })).json() as { profile: { monthlyBudget: number; city: string } }
    expect(body.profile).toMatchObject({ monthlyBudget: 1500, city: "Novi Sad" })
    await app.close()
  })

  it("cost guard: at most 8 listings, and at most one live research at a time", async () => {
    process.env.ANTHROPIC_API_KEY = FAKE_KEY
    // A slow fake "live" model: no network, no cost.
    const app = await buildServer({ demoCatalogue: SAMPLE_CATALOGUE, demoPace: FAST_PACE, liveRunner: () => new MockRunner({ latencyMs: 400, script: () => ({ text: "{}" }) }) })
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

describe("Evaluate an outside listing", () => {
  it("needs the required listing fields; the domain lists every missing one and no run starts", async () => {
    const { outsideCandidate } = await import("../src/adapters/server/research-routes.js")
    const { ListingValidationError } = await import("../src/domain/index.js")
    let problems: readonly { field: string }[] = []
    try {
      outsideCandidate({ listing: { title: "Lokal" } })
    } catch (error) {
      expect(error).toBeInstanceOf(ListingValidationError)
      problems = (error as InstanceType<typeof ListingValidationError>).problems
    }
    expect(problems.map((p) => p.field)).toEqual(expect.arrayContaining(["city", "areaM2", "rentMonthly", "permittedUses"]))
  })

  it("builds one candidate from the typed fields, with the lease draft and the link kept as form sources", async () => {
    const { outsideCandidate, OUTSIDE_LISTING_ID } = await import("../src/adapters/server/research-routes.js")
    const listing = {
      title: "Lokal 60 m2 na Limanu", city: "Novi Sad", district: "Liman 3", street: "Bulevar cara Lazara", areaM2: 60, floor: 0,
      rentMonthly: 900, serviceChargeMonthly: 50, deposit: 1800, minimumTermMonths: 24, earlyTermination: { allowed: true, noticeMonths: 3 },
      indexation: { kind: "cpi" }, permittedUses: ["cafe_food"], tenantPaysStructuralRepairs: false,
    }
    const { catalogue, leases } = outsideCandidate({ listing, leaseDraft: "Clan 1. Zakupnina iznosi 900 EUR mesecno.", url: "https://example.com/oglas/1" })
    expect(catalogue).toHaveLength(1)
    expect(catalogue[0]!.listing.ref).toBe(OUTSIDE_LISTING_ID)
    expect(catalogue[0]!.listing.synthetic).toBe(false)
    expect(catalogue[0]!.listing.url?.value).toBe("https://example.com/oglas/1")
    expect(leases).toHaveLength(1)
  })
})
