// Wire types sent by the server (mirror of src/application/research/wire.ts; kept separate so the web app never
// imports server code).

export type WireEvent = {
  seq: number
  at: number
  type: string
  agent?: string
  loopKey?: string
  candidateId?: string
  data?: Record<string, unknown>
}

export type SourceDTO = { kind: string; ref: string; field?: string; clause?: string; quote?: string; missing?: boolean; form?: boolean; inputs?: SourceDTO[] }
/** Where a run's agent answers come from (sent in the research.started event). */
export type AnswerSource = "model" | "scripted" | "recorded"

export type ValueDTO =
  | { kind: "money"; amount: number; currency: string }
  | { kind: "area"; m2: number }
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "rent_multiple"; months: number }
  | { kind: "missing"; missing: string[]; unverified?: string }
  | { kind: "none" }

export type FieldDTO = { value: ValueDTO; source?: SourceDTO }

export type FindingDTO = {
  id: string
  aspect: string
  severity: "hard" | "soft" | "info"
  claim: string
  author: string
  checkBeforeSigning?: string
  value?: ValueDTO
  source: SourceDTO
}

export type FlagDTO = { rule: string; reason: string; raisedBy: string; aspect: string; source: SourceDTO }

export type CandidateDTO = {
  id: string
  synthetic: boolean
  /** the listing page address, only when really given (typed by the user); never built or guessed */
  listingUrl: { url: string; source: SourceDTO } | null
  status: "pending" | "evaluating" | "rejected" | "scored"
  hasLease: boolean
  fields: Record<string, FieldDTO>
  unverified: { field: string; reason: string }[]
  rejection: FlagDTO | null
  laterFlags: FlagDTO[]
  findings: FindingDTO[]
  ranking: RankingDTO | null
}

export type ReasonDTO = { text: string; effect: "plus" | "minus" | "confidence" | "order"; source: SourceDTO }

export type RankingDTO = {
  rank: number
  /** low end (worst case, used for the rank) */
  score: number
  scoreHigh: number
  confidence: "high" | "medium" | "low"
  tier: number
  reasons: ReasonDTO[]
  components: { name: string; weight: number; value: number | null }[]
  /** Decided by code on the server (domain/verdict.ts). */
  verdict: { verdict: Verdict; why: string }
}

export type Metrics = {
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

export type ReportFactDTO = { id: string; text: string; candidateId: string; source: SourceDTO }
export type ReportSentenceDTO = { text: string; status: "ok" | "removed"; note?: string; facts: ReportFactDTO[] }
export type ReportDTO = {
  recommended: string[]
  sections: Record<"recommendation" | "checkBeforeSigning" | "rejected" | "unknowns", ReportSentenceDTO[]>
  audit: { checked: number; corrected: number; removed: number; attempts: number }
  failed: string | null
}

export type Config = { liveAvailable: boolean; liveNeedsAccessCode: boolean; maxListings: number; liveModel: string }

export type Verdict = "good" | "check_before_signing" | "not_recommended"

/** The questionnaire fields the server validates (domain BusinessProfileInput). */
export type ProfileInput = {
  businessType: "cafe_food" | "retail" | "office_studio" | "workshop"
  description: string
  headcount: number
  areaMinM2: number
  areaMaxM2: number
  currency: "EUR" | "RSD" | "USD"
  monthlyBudget: number
  expectedMonthlyRevenue: number
  grossMarginRate?: number
  walkInCustomers: boolean
  leaseMonths: number
  city: string
  fitOutBudget: number
  equipmentBudget: number
}
