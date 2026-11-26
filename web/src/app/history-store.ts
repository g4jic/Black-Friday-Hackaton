import type { ResearchState } from "../research-state"
import type { AnswerSource } from "../types"

/**
 * A finished research run as kept in the history: the final screen state (without the raw event list) plus a
 * short summary for the list. Everything in it came from the server's events.
 */
export type HistoryRecord = {
  readonly id: string
  readonly ownerId: string
  readonly finishedAt: string
  readonly mode: "demo" | "live"
  readonly synthetic: boolean
  /** Where the answers came from (older records: unknown). */
  readonly answers?: AnswerSource
  readonly cancelled: boolean
  readonly summary: {
    readonly candidates: number
    readonly rejected: number
    readonly topCandidateId: string | null
    readonly topCandidateTitle: string | null
  }
  readonly state: ResearchState
}

/** Where finished runs are kept. Guests: this tab's sessionStorage. Accounts later: a Supabase implementation. */
export interface HistoryStore {
  list(ownerId: string): HistoryRecord[]
  get(ownerId: string, researchId: string): HistoryRecord | null
  save(record: HistoryRecord): void
}

const MAX_RUNS_PER_OWNER = 20

/**
 * Guest history: lives only as long as the browser tab (cleared when the tab is closed). Storage errors (private
 * mode, full storage) never break the app: the run stays visible for this page view, it is just not kept.
 */
export class SessionStorageHistoryStore implements HistoryStore {
  constructor(private readonly storage: () => Storage = () => window.sessionStorage) {}

  private key(ownerId: string): string {
    return `suitespot.history.v1.${ownerId}`
  }

  list(ownerId: string): HistoryRecord[] {
    try {
      const raw = this.storage().getItem(this.key(ownerId))
      const records = raw ? (JSON.parse(raw) as HistoryRecord[]) : []
      return Array.isArray(records) ? records.filter((r) => r.ownerId === ownerId) : []
    } catch {
      return []
    }
  }

  get(ownerId: string, researchId: string): HistoryRecord | null {
    return this.list(ownerId).find((r) => r.id === researchId) ?? null
  }

  save(record: HistoryRecord): void {
    // newest first; saving the same run twice replaces it (idempotent)
    const records = [record, ...this.list(record.ownerId).filter((r) => r.id !== record.id)].slice(0, MAX_RUNS_PER_OWNER)
    try {
      this.storage().setItem(this.key(record.ownerId), JSON.stringify(records))
    } catch {
      // storage full or blocked: drop the oldest half once and try again, then give up quietly
      try {
        this.storage().setItem(this.key(record.ownerId), JSON.stringify(records.slice(0, Math.ceil(records.length / 2))))
      } catch {
        /* not kept */
      }
    }
  }
}

export const historyStore: HistoryStore = new SessionStorageHistoryStore()
