import { randomUUID } from "node:crypto"
import type { FastifyInstance } from "fastify"
import type { InferenceRunner } from "@mozaik-ai/core"
import { ResearchSession, type ResearchMode } from "../../application/research/research-session.js"
import { DomainError, MAX_LISTINGS, createLeaseText, createListingBatch, type LeaseText, type ListingTextInput } from "../../domain/index.js"
import { loadDemoLeases, loadDemoListings, loadDemoQuestionnaire, loadLeaseAnswers, loadScoutAnswers } from "../fixtures/demo-listings.js"
import { createLiveRunner } from "../inference/live-runner.js"
import { MockRunner } from "../inference/mock-runner.js"
import { demoRoomScript, type DemoLatency } from "../inference/scripts/demo-script.js"

export const LIVE_MODEL = "claude-haiku-4-5"
/** USD per million tokens for claude-haiku-4-5 (Anthropic price list, cached 3 Nov 2026 in the claude-api reference). */
export const LIVE_PRICE = { input: 1, output: 5 }
/** Cost guard: at most this many live research runs at the same time. */
export const MAX_ACTIVE_LIVE = 1
const KEEP_SESSIONS = 20

/** Demo pacing: slow enough to watch the agents work in the browser (deterministic per listing). */
export const DEMO_PACE: DemoLatency = {
  scout: (id) => 600 + ((Number(id.replace(/\D/g, "")) * 370) % 1800),
  leaseReader: 2600,
  financeStep: 1100,
}
export const FAST_PACE: DemoLatency = { scout: () => 10, leaseReader: 60, financeStep: 20 }

export type ResearchRoutesOptions = {
  /** Whether live mode may be used (SUITESPOT_MODE=live and a key on the server). */
  readonly liveAvailable: () => boolean
  readonly demoPace?: DemoLatency
  /** For tests: replaces the real Anthropic runner in live mode (no network, no cost). */
  readonly liveRunner?: () => InferenceRunner
}

type Body = { mode?: ResearchMode; source?: "demo" | "pasted"; listings?: { text?: unknown; lease?: unknown }[] }

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function registerResearchRoutes(app: FastifyInstance, options: ResearchRoutesOptions): void {
  const sessions = new Map<string, ResearchSession>()
  const secrets = () => [process.env.ANTHROPIC_API_KEY ?? ""].filter((s) => s.length >= 8)

  app.get("/api/config", async () => ({ liveAvailable: options.liveAvailable(), maxListings: MAX_LISTINGS, liveModel: LIVE_MODEL }))

  app.post("/api/research", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as Body
      const mode: ResearchMode = body.mode === "live" ? "live" : "demo"
      if (mode === "live") {
        if (!options.liveAvailable()) throw new HttpError(403, "Live mode is off on this server (demo mode only).")
        const active = [...sessions.values()].filter((s) => s.mode === "live" && s.status === "running").length
        if (active >= MAX_ACTIVE_LIVE) throw new HttpError(429, "A live research is already running. Wait for it to finish.")
      }
      let listings: ListingTextInput[]
      let leases: LeaseText[]
      if ((body.source ?? "demo") === "demo") {
        listings = loadDemoListings()
        leases = loadDemoLeases()
      } else {
        if (mode !== "live") throw new HttpError(400, "Pasted listings need live mode: demo mode replays scripted answers for the demo listings only.")
        const raw = Array.isArray(body.listings) ? body.listings : []
        listings = raw.map((l) => ({ text: typeof l.text === "string" ? l.text : "" }))
        createListingBatch(listings) // validates 1 to 8, empty texts; throws DomainError
        leases = raw.flatMap((l, i) => (typeof l.lease === "string" && l.lease.trim() ? [createLeaseText(`pasted-${i + 1}`, l.lease, false)] : []))
      }
      const { profile, requirements } = loadDemoQuestionnaire()
      const id = randomUUID()
      const session = new ResearchSession({
        id,
        mode,
        model: mode === "live" ? LIVE_MODEL : "mock",
        runner: mode === "live" ? (options.liveRunner ?? createLiveRunner)() : new MockRunner({ script: demoRoomScript({ scout: loadScoutAnswers(), lease: loadLeaseAnswers() }, options.demoPace ?? DEMO_PACE) }),
        listings,
        leases,
        profile,
        requirements,
        price: LIVE_PRICE,
        timeoutMs: mode === "live" ? 300_000 : 60_000,
        secrets: secrets(),
      })
      sessions.set(id, session)
      for (const old of [...sessions.keys()].slice(0, Math.max(0, sessions.size - KEEP_SESSIONS))) sessions.delete(old)
      return reply.code(201).send({ id, mode, listings: listings.length, synthetic: (body.source ?? "demo") === "demo" })
    } catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof DomainError ? 400 : 500
      const message = error instanceof HttpError || error instanceof DomainError ? error.message : "Could not start the research"
      if (status === 500) req.log.error(error)
      return reply.code(status).send({ error: message })
    }
  })

  app.get("/api/research/:id", async (req, reply) => {
    const session = sessions.get((req.params as { id: string }).id)
    if (!session) return reply.code(404).send({ error: "Unknown research" })
    return { id: session.id, mode: session.mode, status: session.status, events: session.events.length, metrics: session.metrics }
  })

  /**
   * Server-Sent Events: every wire event in bus order (id = seq). A reconnecting client sends Last-Event-ID and
   * gets only what it missed. The stream ends after research.done.
   */
  app.get("/api/research/:id/events", (req, reply) => {
    const session = sessions.get((req.params as { id: string }).id)
    if (!session) return reply.code(404).send({ error: "Unknown research" })
    const after = Number(req.headers["last-event-id"] ?? 0) || 0
    reply.hijack()
    const res = reply.raw
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" })
    const send = (e: { seq: number; type: string }) => res.write(`id: ${e.seq}\nevent: ${e.type === "research.done" ? "done" : "bus"}\ndata: ${JSON.stringify(e)}\n\n`)
    for (const e of session.events) if (e.seq > after) send(e)
    if (session.status === "done") return res.end()
    const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 15_000)
    const unsubscribe = session.subscribe((e) => {
      send(e)
      if (e.type === "research.done") {
        clearInterval(keepAlive)
        unsubscribe()
        res.end()
      }
    })
    req.raw.on("close", () => {
      clearInterval(keepAlive)
      unsubscribe()
    })
  })
}
