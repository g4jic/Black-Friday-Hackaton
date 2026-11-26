import type { CandidateDTO, Metrics, ReportDTO, WireEvent } from "./types"

/** One agent loop as seen from the events (nothing here is invented: every field comes from a wire event). */
export type LoopView = {
  key: string
  agent: string
  candidateId?: string
  start: number
  end?: number
  stopped: boolean
  tools: { at: number; end?: number; name: string }[]
  cancelledAt?: number
  cancelWhere?: string
}

export type Rejection = { candidateId: string; at: number; rule?: string; cancelledLoops: { loopKey: string; agent: string }[] }

export type ResearchState = {
  id: string | null
  events: WireEvent[]
  loops: Record<string, LoopView>
  candidates: Record<string, CandidateDTO>
  order: string[]
  rejections: Record<string, Rejection>
  busy: number
  peak: number
  lastAt: number
  done: boolean
  metrics: Metrics | null
  submitted: string[]
  report: ReportDTO | null
  /** Plain-code work with a start and an end (the Auditor), drawn on the Timeline like a loop. */
  spans: Record<string, LoopView>
}

export const initialResearch = (id: string | null): ResearchState => ({
  id,
  events: [],
  loops: {},
  candidates: {},
  order: [],
  rejections: {},
  busy: 0,
  peak: 0,
  lastAt: 0,
  done: false,
  metrics: null,
  submitted: [],
  report: null,
  spans: {},
})

/** Pure reducer: the whole screen is a function of the event stream. */
export function applyEvent(s: ResearchState, e: WireEvent): ResearchState {
  if (s.events.length && e.seq <= s.events[s.events.length - 1]!.seq) return s // already seen (reconnect)
  const next: ResearchState = { ...s, events: [...s.events, e], lastAt: Math.max(s.lastAt, e.at) }
  const loop = e.loopKey ? s.loops[e.loopKey] : undefined
  switch (e.type) {
    case "listings.submitted":
      next.submitted = (e.data?.listingIds as string[]) ?? []
      break
    case "loop.started":
      if (!e.loopKey) break
      next.loops = { ...s.loops, [e.loopKey]: { key: e.loopKey, agent: e.agent ?? "?", candidateId: e.candidateId, start: e.at, stopped: false, tools: [] } }
      next.busy = s.busy + 1
      next.peak = Math.max(s.peak, next.busy)
      break
    case "tool.started":
      if (loop) next.loops = { ...s.loops, [loop.key]: { ...loop, tools: [...loop.tools, { at: e.at, name: String(e.data?.tool ?? "tool") }] } }
      break
    case "tool.done":
      if (loop) {
        const tools = loop.tools.map((t, i) => (i === loop.tools.length - 1 && t.end === undefined ? { ...t, end: e.at } : t))
        next.loops = { ...s.loops, [loop.key]: { ...loop, tools } }
      }
      break
    case "loop.answered":
      if (loop) {
        next.loops = { ...s.loops, [loop.key]: { ...loop, end: e.at, stopped: Boolean(e.data?.stopped) } }
        next.busy = Math.max(0, s.busy - 1)
      }
      break
    case "loop.cancelled":
      if (loop) next.loops = { ...s.loops, [loop.key]: { ...loop, cancelledAt: e.at, cancelWhere: String(e.data?.where ?? "") } }
      break
    case "candidate.rejected":
      if (e.candidateId) {
        next.rejections = {
          ...s.rejections,
          [e.candidateId]: { candidateId: e.candidateId, at: e.at, rule: (e.data?.flag as { rule?: string } | undefined)?.rule, cancelledLoops: (e.data?.cancelledLoops as Rejection["cancelledLoops"]) ?? [] },
        }
      }
      break
    case "candidate.snapshot": {
      const c = e.data?.candidate as CandidateDTO | undefined
      if (c) {
        next.candidates = { ...s.candidates, [c.id]: c }
        if (!s.order.includes(c.id)) next.order = [...s.order, c.id]
      }
      break
    }
    case "report.snapshot":
      next.report = (e.data?.report as ReportDTO) ?? null
      break
    case "audit.started": {
      const key = `audit:all:${String(e.data?.attempt ?? 1)}`
      next.spans = { ...s.spans, [key]: { key, agent: e.agent ?? "Auditor", start: e.at, stopped: false, tools: [] } }
      break
    }
    case "audit.done": {
      const key = `audit:all:${String(e.data?.attempt ?? 1)}`
      const span = s.spans[key]
      if (span) next.spans = { ...s.spans, [key]: { ...span, end: e.at } }
      break
    }
    case "research.done":
      next.done = true
      next.metrics = (e.data?.metrics as Metrics) ?? null
      break
  }
  return next
}

export type Group = "Pending" | "Evaluating" | "Check before signing" | "Scored" | "Rejected"
export const GROUPS: Group[] = ["Pending", "Evaluating", "Check before signing", "Scored", "Rejected"]

export const runningLoops = (s: ResearchState, candidateId: string) =>
  Object.values(s.loops).filter((l) => l.candidateId === candidateId && l.end === undefined)

/** The note Finance writes when term-level figures do not use verified lease terms. */
export function leaseNote(claim: string): string | null {
  const m = /\((lease not verified|lease term not verified|no lease draft)[^)]*\)/.exec(claim)
  return m ? m[1]! : null
}

/**
 * View group (DESIGN.md 7.3). "Check before signing" is not a domain status: a finished candidate with a soft flag,
 * an unverified field, or figures that could not use verified lease terms.
 */
export function groupOf(s: ResearchState, c: CandidateDTO): Group {
  if (c.status === "rejected") return "Rejected"
  if (runningLoops(s, c.id).length > 0) return "Evaluating"
  const anyLoop = Object.values(s.loops).some((l) => l.candidateId === c.id)
  if (!anyLoop) return "Pending"
  const missingKey = c.fields.rentMonthly?.value.kind === "missing" || c.fields.area?.value.kind === "missing"
  const soft = missingKey || c.findings.some((f) => f.severity === "soft") || c.unverified.length > 0 || c.findings.some((f) => f.checkBeforeSigning)
  return soft ? "Check before signing" : "Scored"
}
