import { useEffect, useSyncExternalStore } from "react"
import { applyEvent, initialResearch, type ResearchState } from "../research-state"
import type { AnswerSource, WireEvent } from "../types"
import { historyStore, type HistoryRecord } from "./history-store"
import { currentUser } from "./identity"

/**
 * One place that owns the research runs of this tab: it starts them, keeps one SSE stream per run (so moving
 * from the run view to the results never reconnects) and saves each finished run to the history.
 * The screen state is always a pure function of the server's events (research-state.ts).
 */
export type RunStatus = "connecting" | "running" | "done" | "missing"

export type RunSnapshot = {
  readonly researchId: string
  readonly status: RunStatus
  readonly state: ResearchState
  readonly mode: "demo" | "live"
  readonly synthetic: boolean
  /** Where the agents' answers come from; null until the server says (first event). */
  readonly answers: AnswerSource | null
  /** Browser time (ms) that matches event time 0, for the live "now" line. null until the first event. */
  readonly clientStartMs: number | null
}

type Entry = { snapshot: RunSnapshot; eventSource: EventSource | null }

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

function update(researchId: string, change: (snapshot: RunSnapshot) => RunSnapshot): void {
  const entry = entries.get(researchId)
  if (!entry) return
  entry.snapshot = change(entry.snapshot)
  notify()
}

function toHistoryRecord(snapshot: RunSnapshot): HistoryRecord {
  const { state } = snapshot
  const candidates = state.order.map((id) => state.candidates[id]).filter((c) => c !== undefined)
  const top = candidates.filter((c) => c.ranking).sort((a, b) => a.ranking!.rank - b.ranking!.rank)[0]
  const title = top?.fields.title?.value
  return {
    id: snapshot.researchId,
    ownerId: currentUser().id,
    finishedAt: new Date().toISOString(),
    mode: snapshot.mode,
    synthetic: snapshot.synthetic,
    ...(snapshot.answers ? { answers: snapshot.answers } : {}),
    cancelled: Boolean(state.cancelled),
    summary: {
      candidates: candidates.length,
      rejected: candidates.filter((c) => c.status === "rejected").length,
      topCandidateId: top?.id ?? null,
      topCandidateTitle: title?.kind === "text" ? title.value : null,
    },
    // the raw event list is only needed while the run is live
    state: { ...state, events: [] },
  }
}

function openStream(researchId: string): void {
  const entry = entries.get(researchId)
  if (!entry || entry.eventSource) return
  const eventSource = new EventSource(`/api/research/${researchId}/events`)
  entry.eventSource = eventSource
  const onEvent = (message: MessageEvent<string>) => {
    const event = JSON.parse(message.data) as WireEvent
    update(researchId, (s) => {
      const state = applyEvent(s.state, event)
      const synthetic = s.synthetic || Object.values(state.candidates).some((c) => c.synthetic)
      const started = event.type === "research.started" ? (event.data as { mode?: "demo" | "live"; answers?: AnswerSource } | undefined) : undefined
      return { ...s, state, synthetic, mode: started?.mode ?? s.mode, answers: started?.answers ?? s.answers, status: state.done ? "done" : "running", clientStartMs: s.clientStartMs ?? Date.now() - event.at }
    })
  }
  eventSource.addEventListener("bus", onEvent as EventListener)
  eventSource.addEventListener("done", ((message: MessageEvent<string>) => {
    onEvent(message)
    eventSource.close()
    entry.eventSource = null
    historyStore.save(toHistoryRecord(entry.snapshot))
  }) as EventListener)
  eventSource.onerror = () => {
    // The browser retries on its own; if the server no longer knows the run (restart), stop and say so.
    void fetch(`/api/research/${researchId}`).then((response) => {
      if (response.status !== 404) return
      eventSource.close()
      entry.eventSource = null
      update(researchId, (s) => (s.status === "done" ? s : { ...s, status: "missing" }))
    })
  }
}

function ensureEntry(researchId: string): void {
  if (entries.has(researchId)) return
  const saved = historyStore.get(currentUser().id, researchId)
  if (saved) {
    entries.set(researchId, {
      eventSource: null,
      snapshot: { researchId, status: "done", state: saved.state, mode: saved.mode, synthetic: saved.synthetic, answers: saved.answers ?? null, clientStartMs: null },
    })
    return
  }
  // Not in this tab's history: the server replays the whole run from its first event (if it still has it).
  entries.set(researchId, {
    eventSource: null,
    snapshot: { researchId, status: "connecting", state: initialResearch(researchId), mode: "demo", synthetic: false, answers: null, clientStartMs: null },
  })
  openStream(researchId)
}

export type StartRequest =
  | { source: "demo" }
  | { mode: "live"; source: "pasted"; listings: { text: string; url?: string; lease?: string }[]; profile?: unknown }
  | { mode: "live"; source: "search"; profile?: unknown }
  | { mode: "live"; source: "outside"; outside: { listing: unknown; leaseDraft?: string; url?: string }; profile?: unknown }
  | { mode?: "live"; source: "listing"; listingId: string; profile?: unknown }

/** A refused start: the server's message, plus the field problems when the typed listing is incomplete. */
export class StartError extends Error {
  constructor(
    message: string,
    readonly problems: { field: string; message: string }[],
  ) {
    super(message)
  }
}

/** Starts a run on the server and begins streaming it. Throws with the server's message on refusal. */
export async function startResearch(request: StartRequest, accessCode?: string): Promise<string> {
  const response = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(accessCode ? { "X-Access-Code": accessCode } : {}) },
    body: JSON.stringify(request),
  })
  const answer = (await response.json().catch(() => ({}))) as { id?: string; error?: string; problems?: { field: string; message: string }[]; mode?: "demo" | "live"; answers?: AnswerSource; synthetic?: boolean }
  if (!response.ok || !answer.id) throw new StartError(answer.error ?? `The server answered ${response.status}`, answer.problems ?? [])
  entries.set(answer.id, {
    eventSource: null,
    snapshot: { researchId: answer.id, status: "connecting", state: initialResearch(answer.id), mode: answer.mode ?? "demo", synthetic: Boolean(answer.synthetic), answers: answer.answers ?? null, clientStartMs: null },
  })
  openStream(answer.id)
  notify()
  return answer.id
}

/** Asks the server to stop a running research. The run then ends through its normal events. */
export async function cancelResearch(researchId: string): Promise<void> {
  const response = await fetch(`/api/research/${researchId}/cancel`, { method: "POST" })
  if (!response.ok) {
    const answer = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(answer.error ?? `The server answered ${response.status}`)
  }
}

export function useResearch(researchId: string): RunSnapshot {
  // the entry is created before the first read, so the snapshot below always exists
  ensureEntry(researchId)
  useEffect(() => ensureEntry(researchId), [researchId])
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => entries.get(researchId)!.snapshot,
  )
}
