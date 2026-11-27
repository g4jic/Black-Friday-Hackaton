import { candidateShortName, withCandidateNames } from "../candidate-label"
import type { ResearchState } from "../research-state"

/**
 * What the run view shows, derived only from the server's events (no timers, nothing invented).
 * Pure functions, no DOM: tested in tests/run-view-model.test.ts.
 */

/**
 * Participants that can appear on the orbit. Each has a fixed slot (its index), decided before the run: a node
 * appears on its own slot when it really starts working and never moves when another one appears.
 */
export const ORBIT_AGENTS = ["Scout", "Finance analyst", "Lease reader", "Location analyst", "Premises inspector", "Ranker", "Auditor", "Report writer"] as const
export type OrbitAgentName = (typeof ORBIT_AGENTS)[number]

/** Plain-code participants (no model): labelled "code" on the orbit. */
export const CODE_PARTICIPANTS = new Set<string>(["Ranker", "Auditor"])

export type AgentNode = {
  name: OrbitAgentName
  /** slot index on the ring (stable, so a node never jumps) */
  slot: number
  /** loops (or audits) running right now */
  running: number
  /** total loops (or audits) so far */
  total: number
  /** seq of the event that last showed this participant at work (used for one-shot work, like the Ranker) */
  lastActiveSeq: number
}

export type CandidatePhase = "reading" | "found" | "evaluating" | "done" | "rejected" | "failed"

export type CandidateChip = {
  id: string
  /** short human label, e.g. "Liman 2 · 72 m2" ("Listing 3" until the Scout has read it) */
  label: string
  /** fixed slot around the inner ring, 0..1, evenly spaced (stable per candidate) */
  turn: number
  phase: CandidatePhase
  rank: number | null
  /** one line, for rejected or failed candidates */
  reason: string | null
}

export type RunCounters = { total: number; evaluated: number; rejected: number; runningNow: number; peak: number }

const runningLoopsByAgent = (s: ResearchState) => {
  const counts = new Map<string, { running: number; total: number }>()
  for (const l of [...Object.values(s.loops), ...Object.values(s.spans)]) {
    const entry = counts.get(l.agent) ?? { running: 0, total: 0 }
    entry.total += 1
    if (l.end === undefined) entry.running += 1
    counts.set(l.agent, entry)
  }
  return counts
}

export function agentNodes(s: ResearchState): AgentNode[] {
  const counts = runningLoopsByAgent(s)
  const lastSeq = new Map<string, number>()
  for (const e of s.events) if (e.agent) lastSeq.set(e.agent, e.seq)
  const rankerWorked = s.events.some((e) => e.type === "ranking.done") || Object.values(s.candidates).some((c) => c.ranking)
  return ORBIT_AGENTS.flatMap((name, slot) => {
    const c = counts.get(name)
    const worked = c !== undefined || (name === "Ranker" && rankerWorked)
    if (!worked) return []
    return [{ name, slot, running: c?.running ?? 0, total: c?.total ?? (name === "Ranker" ? 1 : 0), lastActiveSeq: lastSeq.get(name) ?? 0 }]
  })
}

const FAILED_TYPES = new Set(["listing.extraction_failed"])

/** Every submitted listing becomes a chip at once ("reading"), then moves inward as its candidate is evaluated. */
export function candidateChips(s: ResearchState): CandidateChip[] {
  const ids = [...new Set([...s.submitted, ...s.order])]
  const failed = new Map<string, string>()
  for (const e of s.events) {
    if (FAILED_TYPES.has(e.type)) failed.set(String(e.data?.listingId ?? ""), String(e.data?.reason ?? "could not be read"))
  }
  return ids.map((id, index) => {
    const turn = ids.length ? index / ids.length : 0
    const c = s.candidates[id]
    if (!c) {
      const reason = failed.get(id)
      return { id, label: candidateShortName(undefined, index + 1), turn, phase: reason ? "failed" : "reading", rank: null, reason: reason ? `The listing could not be read: ${reason}` : null }
    }
    const label = candidateShortName(c, index + 1)
    if (c.status === "rejected") return { id, label, turn, phase: "rejected", rank: null, reason: c.rejection ? `Hard flag: ${c.rejection.reason}` : "Rejected" }
    const loops = Object.values(s.loops).filter((l) => l.candidateId === id)
    const running = loops.some((l) => l.end === undefined)
    const phase: CandidatePhase = c.ranking || (loops.length > 0 && !running) ? "done" : running ? "evaluating" : "found"
    return { id, label, turn, phase, rank: c.ranking?.rank ?? null, reason: null }
  })
}

export function runCounters(s: ResearchState): RunCounters {
  const chips = candidateChips(s)
  const runningNow = [...Object.values(s.loops), ...Object.values(s.spans)].filter((l) => l.end === undefined).length
  return {
    total: chips.length,
    evaluated: chips.filter((c) => c.phase === "done" || c.phase === "rejected" || c.phase === "failed").length,
    rejected: chips.filter((c) => c.phase === "rejected").length,
    runningNow,
    peak: s.peak,
  }
}

const ACTIVITY: Record<string, (candidateLabel: string) => string> = {
  Scout: (label) => `Scout is reading ${label}`,
  "Finance analyst": (label) => `Finance analyst is checking the costs of ${label}`,
  "Lease reader": (label) => `Lease reader is reading the lease of ${label}`,
  "Location analyst": (label) => `Location analyst is reading the OpenStreetMap counts around ${label}`,
  "Premises inspector": (label) => `Premises inspector is reading what the listing says about the space of ${label}`,
  "Report writer": () => "Report writer is writing the report from the facts",
}

/** The human label of a candidate for sentences; the raw id only if the candidate is unknown. */
export function candidateLabel(s: ResearchState, candidateId: string): string {
  const index = [...new Set([...s.submitted, ...s.order])].indexOf(candidateId)
  if (index < 0) return candidateId
  return candidateShortName(s.candidates[candidateId], index + 1)
}

/** A text for the screen (a report sentence, a fact) with the candidates of this research named, not numbered by id. */
export function namedText(s: ResearchState, text: string): string {
  return withCandidateNames(text, (id) => (s.candidates[id] ? candidateLabel(s, id) : null))
}

/** The one-line live status in the centre, from the latest event that says what is happening. */
export function statusLine(s: ResearchState): string {
  for (let i = s.events.length - 1; i >= 0; i--) {
    const e = s.events[i]!
    const id = candidateLabel(s, e.candidateId ?? "")
    switch (e.type) {
      case "research.done": {
        if (s.cancelled) return "Research cancelled. Every agent stopped at its next step."
        const seconds = s.metrics ? (s.metrics.durationMs / 1000).toFixed(1) : null
        return seconds ? `Done in ${seconds} s` : "Done"
      }
      case "research.cancel_requested":
        return "Stopping every agent at its next step"
      case "report.ready":
        return "Report audited: every number checked against its source"
      case "audit.started":
        return "Auditor is checking every number in the report"
      case "ranking.done":
        return "Ranker has ordered the candidates"
      case "candidate.rejected":
        return `Hard flag: ${id} rejected by ${e.agent ?? "an agent"}`
      case "tool.started":
        if (e.agent === "Finance analyst") return `Finance analyst is running the calculator for ${id}`
        break
      case "loop.started": {
        const activity = e.agent ? ACTIVITY[e.agent] : undefined
        if (activity) return activity(id)
        break
      }
      case "listings.submitted":
        return `${s.submitted.length} listing${s.submitted.length === 1 ? "" : "s"} submitted`
    }
  }
  return "Starting the agents"
}
