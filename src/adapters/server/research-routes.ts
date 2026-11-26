import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import type { FastifyInstance } from "fastify"
import type { InferenceRunner } from "@mozaik-ai/core"
import { ResearchSession, type ResearchMode } from "../../application/research/research-session.js"
import {
  BUDGET_TOLERANCE,
  DomainError,
  MAX_FIXED_INDEXATION_PERCENT,
  MAX_LISTINGS,
  MAX_NOTICE_MONTHS,
  MAX_TERM_WITHOUT_EXIT_MONTHS,
  RANKING_ASSUMPTIONS,
  VERDICT_RULES,
  BusinessProfile,
  createLeaseText,
  createListingBatch,
  type BusinessProfileInput,
  type LeaseText,
  type ListingTextInput,
} from "../../domain/index.js"
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
  reportWriter: 1500,
}
export const FAST_PACE: DemoLatency = { scout: () => 10, leaseReader: 60, financeStep: 20, reportWriter: 20 }

export type ResearchRoutesOptions = {
  /** Whether live mode may be used (SUITESPOT_MODE=live and a key on the server). */
  readonly liveAvailable: () => boolean
  readonly demoPace?: DemoLatency
  /** For tests: replaces the real Anthropic runner in live mode (no network, no cost). */
  readonly liveRunner?: () => InferenceRunner
}

type Body = { mode?: ResearchMode; source?: "demo" | "pasted"; listings?: { text?: unknown; lease?: unknown; url?: unknown }[]; profile?: Partial<BusinessProfileInput> }

/** Name of the environment variable with the live mode access code (also in .env.example, PROGRESS.md, CLAUDE.md). */
export const ACCESS_CODE_ENV = "SUITESPOT_ACCESS_CODE"
const accessCode = () => process.env[ACCESS_CODE_ENV]?.trim() ?? ""

/** Constant-time comparison (hashes first, so different lengths do not leak through timing either). */
function accessCodeMatches(given: unknown): boolean {
  const expected = accessCode()
  if (!expected) return true // no code configured: live mode is open (local development)
  if (typeof given !== "string" || !given) return false
  const digest = (s: string) => createHash("sha256").update(s).digest()
  return timingSafeEqual(digest(given.trim()), digest(expected))
}

/** The questionnaire of a live run, validated by the domain. Fields the form does not ask keep the demo values. */
function liveProfile(input: Partial<BusinessProfileInput> | undefined, demo: BusinessProfile): BusinessProfile {
  if (!input) return demo
  const allowed: (keyof BusinessProfileInput)[] = ["businessType", "description", "headcount", "areaMinM2", "areaMaxM2", "currency", "monthlyBudget", "expectedMonthlyRevenue", "grossMarginRate", "walkInCustomers", "leaseMonths", "city", "fitOutBudget", "equipmentBudget"]
  const picked = Object.fromEntries(allowed.filter((k) => input[k] !== undefined && input[k] !== null).map((k) => [k, input[k]]))
  return BusinessProfile.create({ ...demo.input, specialNeeds: undefined, ...picked } as BusinessProfileInput)
}

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

  app.get("/api/config", async () => ({ liveAvailable: options.liveAvailable(), liveNeedsAccessCode: Boolean(accessCode()), maxListings: MAX_LISTINGS, liveModel: LIVE_MODEL }))

  /** The fixed demo questionnaire, shown locked on the New research screen (demo runs always use it). */
  app.get("/api/demo-questionnaire", async () => {
    const { profile, requirements } = loadDemoQuestionnaire()
    return { profile: profile.input, requirements: requirements.map((r) => ({ id: r.id, text: r.text, hard: r.hard })) }
  })

  /** The rules the code uses, served from the code itself (the Assumptions screen can never drift from them). */
  app.get("/api/assumptions", async () => {
    const { profile } = loadDemoQuestionnaire()
    const p = profile.input
    return {
      ranking: { ...RANKING_ASSUMPTIONS, lease: { ...RANKING_ASSUMPTIONS.lease, noticeMonths: RANKING_ASSUMPTIONS.lease.noticeMonths.map((b) => ({ upTo: Number.isFinite(b.upTo) ? b.upTo : null, score: b.score })) } },
      hardFlags: {
        budgetTolerance: BUDGET_TOLERANCE,
        maxTermWithoutExitMonths: MAX_TERM_WITHOUT_EXIT_MONTHS,
      },
      verdict: VERDICT_RULES,
      leaseConcerns: { maxNoticeMonths: MAX_NOTICE_MONTHS, maxFixedIndexationPercent: MAX_FIXED_INDEXATION_PERCENT },
      demoQuestionnaire: {
        business: p.description,
        areaM2: [p.areaMinM2, p.areaMaxM2],
        monthlyBudget: p.monthlyBudget,
        expectedMonthlyRevenue: p.expectedMonthlyRevenue,
        leaseMonths: p.leaseMonths,
        currency: p.currency,
        grossMarginRate: p.grossMarginRate ?? null,
      },
    }
  })

  app.post("/api/research", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as Body
      const mode: ResearchMode = body.mode === "live" ? "live" : "demo"
      if (mode === "live") {
        if (!options.liveAvailable()) throw new HttpError(403, "Live mode is off on this server (demo mode only).")
        if (!accessCodeMatches(req.headers["x-access-code"])) throw new HttpError(401, "Live mode needs a valid access code. Enter it under Settings.")
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
        listings = raw.map((l) => ({ text: typeof l.text === "string" ? l.text : "", ...(typeof l.url === "string" && l.url.trim() ? { url: l.url } : {}) }))
        createListingBatch(listings) // validates 1 to 8, empty texts; throws DomainError
        leases = raw.flatMap((l, i) => (typeof l.lease === "string" && l.lease.trim() ? [createLeaseText(`pasted-${i + 1}`, l.lease, false)] : []))
      }
      const demo = loadDemoQuestionnaire()
      // Demo runs always use the fixed demo profile (the scripted answers were recorded for it).
      const profile = mode === "live" ? liveProfile(body.profile, demo.profile) : demo.profile
      const requirements = profile === demo.profile ? demo.requirements : []
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

  app.get("/api/research/:id/report", async (req, reply) => {
    const session = sessions.get((req.params as { id: string }).id)
    if (!session) return reply.code(404).send({ error: "Unknown research" })
    const report = session.report()
    if (!report) return reply.code(404).send({ error: "The report is not ready yet" })
    return report
  })

  /** Cancel: every agent loop stops at its next breakpoint; the run ends with research.done { cancelled: true }. */
  app.post("/api/research/:id/cancel", async (req, reply) => {
    const session = sessions.get((req.params as { id: string }).id)
    if (!session) return reply.code(404).send({ error: "Unknown research" })
    if (!session.cancel()) return reply.code(409).send({ error: "The research has already finished" })
    return reply.code(202).send({ status: "cancelling" })
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
