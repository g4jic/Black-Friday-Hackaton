import { createHuman, SituationSpecification, type InferenceRunner, type SemanticEvent } from "@mozaik-ai/core"
import type { BusinessProfile, CatalogueCandidate, LeaseText, ListingTextInput, Requirement } from "../../domain/index.js"
import { submitCatalogueListings } from "../agents/catalogue.js"
import { createFinanceAnalyst } from "../agents/finance-analyst.js"
import { createLeaseReader } from "../agents/lease-reader.js"
import { createRanker } from "../agents/ranker.js"
import { createAuditor } from "../agents/auditor.js"
import { createReportWriter } from "../agents/report-writer.js"
import { createScout, submitListings } from "../agents/scout.js"
import { safeHandler } from "../resilience/safe-handler.js"
import { createAppRuntime, type AppRuntime } from "../runtime.js"
import { candidateDTO, reportDTO, sourceDTO, type WireEvent } from "./wire.js"

export type ResearchMode = "demo" | "live"

export type ResearchInput = {
  readonly id: string
  readonly mode: ResearchMode
  readonly model: string
  readonly runner: InferenceRunner
  /** Pasted listing texts (the Scout reads them). May be empty when the run uses SuiteSpot listings. */
  readonly listings: readonly ListingTextInput[]
  /** SuiteSpot listings, built by code from the structured form (no Scout). */
  readonly catalogue?: readonly CatalogueCandidate[]
  readonly leases: readonly LeaseText[]
  readonly profile: BusinessProfile
  readonly requirements: readonly Requirement[]
  /** USD per million tokens, for the cost metric (live only). */
  readonly price?: { readonly input: number; readonly output: number }
  readonly timeoutMs?: number
  /** Values that must never reach the browser (for example the API key); replaced in every outgoing event. */
  readonly secrets?: readonly string[]
}

export type ResearchMetrics = {
  durationMs: number
  loops: number
  peakParallel: number
  toolCalls: number
  candidates: number
  rejected: number
  loopsCancelled: number
  softFlags: number
  rejectedExtractions: number
  agentsHalted: number
  tokens: { input: number; output: number }
  costUsd: number | null
  timedOut: boolean
}

class Everything extends SituationSpecification {
  isSatisfiedBy(): boolean {
    return true
  }
}

type Payload = Record<string, unknown> & {
  loopId?: string
  candidateId?: string
  loopKey?: string
  call?: { name?: string }
  answer?: { content?: { text?: string } }
  tokenUsage?: { inputTokens?: number; outputTokens?: number }
  flag?: { rule: string; reason: string; raisedBy: string; aspect: string; source: never }
}

/** Domain event fields that may go to the browser, per event type (everything else is dropped). */
const PASS_THROUGH: Record<string, readonly string[]> = {
  "listings.submitted": ["listingIds", "removedContacts"],
  "catalogue.matched": ["listingIds"],
  "candidate.found": ["candidateId", "missing", "unverified"],
  "candidate.rejected": ["candidateId", "cancelledLoops"],
  "candidate.flag_recorded": ["candidateId"],
  "loop.cancelled": ["candidateId", "loopKey", "agent", "where", "rule", "raisedBy"],
  "lease.read": ["candidateId", "leaseId", "attempt", "hardFlags", "concerns", "unverified"],
  "lease.extraction_rejected": ["candidateId", "attempt", "reason"],
  "lease.failed": ["candidateId", "reason"],
  "listing.extraction_rejected": ["listingId", "attempt", "reason"],
  "listing.extraction_failed": ["listingId", "attempts", "reason"],
  "finance.explained": ["candidateId", "explanation"],
  "finance.explanation_rejected": ["candidateId", "attempt", "reason"],
  "finance.failed": ["candidateId", "reason"],
  "agent.halted": ["loopKey", "candidateId", "reason"],
  "candidate.scored": ["candidateId", "rank", "score", "scoreHigh", "confidence"],
  "ranking.done": ["order", "excluded"],
  "report.drafted": ["attempt", "ok"],
  "audit.started": ["attempt"],
  "audit.done": ["attempt", "checked", "problems"],
  "report.audit_failed": ["attempt", "problems"],
  "report.ready": ["audit", "recommended", "failed"],
}

/**
 * One research run: its own Mozaik runtime with the Scout, Finance analyst and Lease reader, plus a plain-code tap
 * that turns bus events into WireEvents for the browser (in bus order, numbered) and computes the run metrics from
 * those events. Nobody calls the agents: the tap only listens.
 */
export class ResearchSession {
  readonly events: WireEvent[] = []
  status: "running" | "done" = "running"
  metrics: ResearchMetrics | null = null
  private readonly listeners = new Set<(e: WireEvent) => void>()
  private readonly started = Date.now()
  private readonly rt: AppRuntime
  private readonly snapshots = new Map<string, string>()
  private readonly tokens = { input: 0, output: 0 }
  private rankingDone = false
  private reportDone = false
  private busy = 0
  private peak = 0
  private stableSince = 0
  private readonly timer: ReturnType<typeof setInterval>

  constructor(private readonly input: ResearchInput) {
    this.rt = createAppRuntime({
      runner: input.runner,
      maxParallelInference: 8,
      resilience: input.mode === "live" ? { retries: 2, baseDelayMs: 1000 } : { retries: 0 },
    })
    const names = new Map<string, string>()
    const tap = createHuman({
      name: "Wire tap",
      capabilities: ["observe"],
      handlers: [safeHandler({ specification: new Everything(), processor: { apply: ({ event }) => this.onBus(event, names) } })],
    })
    const user = createHuman({ name: "User", capabilities: [], handlers: [] })
    const agents = [createScout(this.rt, { model: input.model }), createFinanceAnalyst(this.rt, { model: input.model }), createLeaseReader(this.rt, { model: input.model }), createRanker(this.rt), createReportWriter(this.rt, { model: input.model }), createAuditor(this.rt)]
    for (const p of [tap, user, ...agents]) {
      names.set(p.getId(), p.getManifest().name)
      this.rt.join(p)
    }
    this.rt.state.setQuestionnaire(input.profile, input.requirements)
    this.rt.state.submitLeases(input.leases)
    this.timer = setInterval(() => this.checkDone(), 50)
    if (input.listings.length > 0) submitListings(this.rt, input.listings, user.getId())
    if (input.catalogue?.length) submitCatalogueListings(this.rt, input.catalogue, user.getId())
  }

  get id(): string {
    return this.input.id
  }

  get mode(): ResearchMode {
    return this.input.mode
  }

  /** The audited report as sent to the browser (null until report.ready). */
  report() {
    return this.rt.state.report ? reportDTO(this.rt.state) : null
  }

  /**
   * The user pressed Cancel: every loop stops at its next breakpoint, nothing is ranked or reported, and the run
   * ends with research.done { cancelled: true } as soon as no loop is running. Returns false when it already ended.
   */
  cancel(): boolean {
    if (this.status === "done") return false
    if (this.rt.state.stopRun("the research was cancelled by the user")) this.emit("research.cancel_requested", { agent: "User" })
    return true
  }

  subscribe(listener: (e: WireEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(type: string, fields: Omit<WireEvent, "seq" | "at" | "type"> = {}): void {
    let event: WireEvent = { seq: this.events.length + 1, at: Date.now() - this.started, type, ...fields }
    if (this.input.secrets?.some((s) => s && JSON.stringify(event).includes(s))) {
      let json = JSON.stringify(event)
      for (const s of this.input.secrets) if (s) json = json.split(s).join("[redacted]")
      event = JSON.parse(json) as WireEvent
    }
    this.events.push(event)
    for (const l of this.listeners) {
      try {
        l(event)
      } catch {
        // a broken listener (closed connection) never stops the research
      }
    }
  }

  private onBus(event: SemanticEvent, names: Map<string, string>): void {
    const p = (event.payload ?? {}) as Payload
    const agent = names.get(event.producerId)
    const loop = this.rt.loopForEvent(event)
    const loopFields = loop ? { loopKey: loop.key, ...(loop.candidateId ? { candidateId: loop.candidateId } : {}), agent: loop.agentName } : { ...(agent ? { agent } : {}) }
    switch (event.type) {
      case "message_received.started":
        if (!loop) return
        this.peak = Math.max(this.peak, ++this.busy)
        return this.emit("loop.started", loopFields)
      case "function_call.started":
        return this.emit("tool.started", { ...loopFields, data: { tool: p.call?.name ?? "tool" } })
      case "function_call.completed":
        return this.emit("tool.done", loopFields)
      case "inference.completed":
        this.tokens.input += p.tokenUsage?.inputTokens ?? 0
        this.tokens.output += p.tokenUsage?.outputTokens ?? 0
        return
      case "model.answer": {
        if (!loop) return
        this.busy--
        const stopped = (p.answer?.content?.text ?? "").startsWith("stopped:")
        this.emit("loop.answered", { ...loopFields, data: { stopped } })
        return this.snapshot(loop.candidateId)
      }
    }
    if (event.type === "ranking.done") this.rankingDone = true
    if (event.type === "report.ready") this.reportDone = true
    const allowed = PASS_THROUGH[event.type]
    if (!allowed) return
    const data: Record<string, unknown> = Object.fromEntries(allowed.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]))
    if (p.flag) data.flag = { rule: p.flag.rule, reason: p.flag.reason, raisedBy: p.flag.raisedBy, aspect: p.flag.aspect, source: sourceDTO(p.flag.source) }
    const candidateId = (p.candidateId as string | undefined) ?? loop?.candidateId
    this.emit(event.type, { ...(agent ? { agent } : {}), ...(p.loopKey ? { loopKey: p.loopKey } : {}), ...(candidateId ? { candidateId } : {}), data })
    this.snapshot(candidateId)
    if (event.type === "report.ready" && this.rt.state.report) this.emit("report.snapshot", { data: { report: reportDTO(this.rt.state) } })
  }

  /** Publishes the candidate's current state when it changed (listing fields, status, flags, findings). */
  private snapshot(candidateId: string | undefined): void {
    if (!candidateId || !this.rt.state.candidates.has(candidateId)) return
    const dto = candidateDTO(this.rt.state.candidate(candidateId), this.rt.state)
    const json = JSON.stringify(dto)
    if (this.snapshots.get(candidateId) === json) return
    this.snapshots.set(candidateId, json)
    this.emit("candidate.snapshot", { candidateId, data: { candidate: dto } })
  }

  private checkDone(): void {
    if (this.status === "done") return
    const state = this.rt.state
    // Finance writes findings inside tool calls: refresh running candidates so the UI sees new figures.
    for (const id of state.candidates.keys()) this.snapshot(id)
    const loopsDone = this.rt.loops().every((l) => l.status === "done")
    const settled = state.runStop
      ? loopsDone // cancelled: done as soon as every loop has stopped
      : state.candidates.size + state.failedListings.length >= state.expectedListings() &&
        this.rt.loops().length > 0 &&
        loopsDone &&
        (this.rankingDone || state.candidates.size === 0) &&
        (this.reportDone || !this.rankingDone)
    const timedOut = Date.now() - this.started > (this.input.timeoutMs ?? 120_000)
    if (settled) this.stableSince ||= Date.now()
    else this.stableSince = 0
    if (!(settled && Date.now() - this.stableSince > 150) && !timedOut) return
    this.finish(timedOut && !settled, Boolean(state.runStop))
  }

  private finish(timedOut: boolean, cancelled = false): void {
    clearInterval(this.timer)
    this.status = "done"
    const count = (type: string) => this.events.filter((e) => e.type === type).length
    const price = this.input.price
    this.metrics = {
      durationMs: Date.now() - this.started,
      loops: count("loop.started"),
      peakParallel: this.peak,
      toolCalls: count("tool.started"),
      candidates: this.rt.state.candidates.size,
      rejected: count("candidate.rejected"),
      loopsCancelled: count("loop.cancelled"),
      softFlags: this.rt.state.findings.filter((f) => f.severity === "soft").length,
      rejectedExtractions: count("listing.extraction_rejected") + count("lease.extraction_rejected") + count("finance.explanation_rejected"),
      agentsHalted: count("agent.halted"),
      tokens: { ...this.tokens },
      costUsd: this.input.mode === "live" && price ? Math.round(((this.tokens.input * price.input + this.tokens.output * price.output) / 1_000_000) * 10_000) / 10_000 : null,
      timedOut,
    }
    this.emit("research.done", { data: { metrics: this.metrics, cancelled } })
  }
}
