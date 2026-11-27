import type { ResearchState } from "../research-state"
import type { WireEvent } from "../types"
import { ORBIT_AGENTS, candidateChips, type CandidatePhase, type OrbitAgentName } from "./run-view-model"

/**
 * The orbit of the run view, as plain data. Every dot and every encounter on screen is one of these objects, and
 * every one of them carries the seq of the wire event that caused it, so nothing moves that the bus did not say.
 * Pure, no DOM: tested in tests/orbit-model.test.ts against recorded runs.
 *
 * - a dot is one agent loop (or one audit) on one candidate: it appears on loop.started (audit.started),
 *   circles the agent that runs it and goes away on loop.answered (audit.done);
 * - "flag": candidate.rejected; the loops it names in cancelledLoops bounce off and the candidate is marked;
 * - "handoff": lease.read without a hard flag while that candidate's Finance loop is still running (Finance waits
 *   for these lease terms in shared state, see finance-analyst.ts);
 * - "auditReturn": report.audit_failed (the Auditor sends the draft's problems back to the Report writer);
 * - "ranked": ranking.done (the Ranker orders the candidates).
 */

export type OrbitDot = {
  loopKey: string
  agent: OrbitAgentName
  /** null for work on the whole run (the Report writer, the Auditor) */
  candidateId: string | null
  /** seq of loop.started (or audit.started) */
  startSeq: number
  /** seq of loop.answered (or audit.done); null while it runs */
  endSeq: number | null
  /** seq of the candidate.rejected that cancelled this loop */
  cancelSeq: number | null
}

type CueBase = { key: string; seq: number; at: number }
export type FlagCue = CueBase & {
  kind: "flag"
  candidateId: string
  rule: string | null
  raisedBy: string | null
  agent: OrbitAgentName | null
  cancelledLoopKeys: string[]
}
/** fromLoopKey: the Lease reader loop on that candidate whose answer produced lease.read (it has usually just ended) */
export type HandoffCue = CueBase & { kind: "handoff"; candidateId: string; fromLoopKey: string | null; toLoopKey: string }
export type AuditReturnCue = CueBase & { kind: "auditReturn"; attempt: number; problems: number }
export type RankedCue = CueBase & { kind: "ranked"; order: string[] }
export type OrbitCue = FlagCue | HandoffCue | AuditReturnCue | RankedCue

/** The wire event type behind each kind of cue (the test checks every cue against it). */
export const CUE_EVENT: Record<OrbitCue["kind"], string> = {
  flag: "candidate.rejected",
  handoff: "lease.read",
  auditReturn: "report.audit_failed",
  ranked: "ranking.done",
}

export type OrbitCandidate = {
  id: string
  label: string
  /** place in the order, 0..1; after ranking.done, the Ranker's order */
  slot: number
  phase: CandidatePhase
  rank: number | null
}

export type OrbitModel = {
  /** every loop of the run so far; the ones with endSeq === null are on screen */
  dots: OrbitDot[]
  cues: OrbitCue[]
  candidates: OrbitCandidate[]
  /** loops and audits running right now: exactly the dots on screen */
  atWork: number
}

const ON_ORBIT = new Set<string>(ORBIT_AGENTS)
const asOrbitAgent = (name: string | undefined | null): OrbitAgentName | null => (name && ON_ORBIT.has(name) ? (name as OrbitAgentName) : null)
const auditKey = (e: WireEvent) => `audit:all:${String(e.data?.attempt ?? 1)}`

export function orbitModel(s: ResearchState): OrbitModel {
  const dots = new Map<string, OrbitDot>()
  const cues: OrbitCue[] = []
  for (const e of s.events) {
    switch (e.type) {
      case "loop.started": {
        const agent = asOrbitAgent(e.agent)
        if (e.loopKey && agent)
          dots.set(e.loopKey, { loopKey: e.loopKey, agent, candidateId: e.candidateId ?? null, startSeq: e.seq, endSeq: null, cancelSeq: null })
        break
      }
      case "loop.answered": {
        const dot = e.loopKey ? dots.get(e.loopKey) : undefined
        if (dot && dot.endSeq === null) dot.endSeq = e.seq
        break
      }
      case "audit.started": {
        const key = auditKey(e)
        dots.set(key, { loopKey: key, agent: "Auditor", candidateId: null, startSeq: e.seq, endSeq: null, cancelSeq: null })
        break
      }
      case "audit.done": {
        const dot = dots.get(auditKey(e))
        if (dot && dot.endSeq === null) dot.endSeq = e.seq
        break
      }
      case "candidate.rejected": {
        if (!e.candidateId) break
        const flag = e.data?.flag as { rule?: string; raisedBy?: string } | undefined
        const cancelled = ((e.data?.cancelledLoops as { loopKey: string }[] | undefined) ?? []).map((l) => l.loopKey)
        for (const key of cancelled) {
          const dot = dots.get(key)
          if (dot && dot.endSeq === null && dot.cancelSeq === null) dot.cancelSeq = e.seq
        }
        const raisedBy = flag?.raisedBy ?? null
        cues.push({
          kind: "flag",
          key: `flag:${e.seq}`,
          seq: e.seq,
          at: e.at,
          candidateId: e.candidateId,
          rule: flag?.rule ?? null,
          raisedBy,
          agent: asOrbitAgent(raisedBy),
          cancelledLoopKeys: cancelled,
        })
        break
      }
      case "lease.read": {
        if (!e.candidateId || ((e.data?.hardFlags as string[] | undefined) ?? []).length > 0) break
        const onCandidate = [...dots.values()].filter((d) => d.candidateId === e.candidateId)
        const finance = onCandidate.find((d) => d.agent === "Finance analyst" && d.endSeq === null)
        if (!finance) break // Finance already finished on this candidate: nobody receives the terms now
        const readers = onCandidate.filter((d) => d.agent === "Lease reader")
        const reader = readers[readers.length - 1] // not .at(-1): Safari before 15.4 has no Array.prototype.at
        cues.push({
          kind: "handoff",
          key: `handoff:${e.seq}`,
          seq: e.seq,
          at: e.at,
          candidateId: e.candidateId,
          fromLoopKey: reader?.loopKey ?? null,
          toLoopKey: finance.loopKey,
        })
        break
      }
      case "report.audit_failed":
        cues.push({
          kind: "auditReturn",
          key: `audit-return:${e.seq}`,
          seq: e.seq,
          at: e.at,
          attempt: Number(e.data?.attempt ?? 1),
          problems: ((e.data?.problems as unknown[] | undefined) ?? []).length,
        })
        break
      case "ranking.done":
        cues.push({
          kind: "ranked",
          key: `ranked:${e.seq}`,
          seq: e.seq,
          at: e.at,
          order: [...((e.data?.order as string[] | undefined) ?? []), ...((e.data?.excluded as string[] | undefined) ?? [])],
        })
        break
    }
  }

  const chips = candidateChips(s)
  const ranked = [...cues].reverse().find((c): c is RankedCue => c.kind === "ranked")
  const order = ranked
    ? [...ranked.order.filter((id) => chips.some((c) => c.id === id)), ...chips.map((c) => c.id).filter((id) => !ranked.order.includes(id))]
    : chips.map((c) => c.id)
  const candidates = chips.map((c) => ({ id: c.id, label: c.label, slot: order.length ? order.indexOf(c.id) / order.length : 0, phase: c.phase, rank: c.rank }))
  const all = [...dots.values()]
  return { dots: all, cues, candidates, atWork: all.filter((d) => d.endSeq === null).length }
}

/** A cue is played only while it is fresh: a page opened late (or a reconnect replaying old events) shows the result, not a burst of old animations. */
export const CUE_FRESH_MS = 2500
export const isFresh = (cue: OrbitCue, s: ResearchState) => s.lastAt - cue.at <= CUE_FRESH_MS
