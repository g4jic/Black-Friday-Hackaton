import {
  AreaM2,
  Money,
  evaluatePremises,
  isMissingData,
  isRentMultiple,
  verdictFor,
  type Candidate,
  type Finding,
  type SourceRef,
  type Verdict,
} from "../../domain/index.js"
import type { SuiteSpotState } from "../state.js"

/**
 * What the browser receives. A small, whitelisted projection of the bus and the shared state: no model contexts,
 * no prompts, no inference inputs, nothing from the environment. Built only from domain values.
 */
export type WireEvent = {
  readonly seq: number
  /** ms since the research started */
  readonly at: number
  readonly type: string
  readonly agent?: string
  readonly loopKey?: string
  readonly candidateId?: string
  readonly data?: Record<string, unknown>
}

export type SourceDTO = { kind: string; ref: string; field?: string; clause?: string; quote?: string; missing?: boolean; form?: boolean; inputs?: SourceDTO[] }

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
  severity: string
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
  /** The listing page address, only when really given (typed by the user); never built or guessed. */
  listingUrl: { url: string; source: SourceDTO } | null
  status: string
  hasLease: boolean
  fields: Record<string, FieldDTO>
  unverified: { field: string; reason: string }[]
  rejection: FlagDTO | null
  laterFlags: FlagDTO[]
  findings: FindingDTO[]
  /** The Premises inspector's result: null while not read (or when it failed); notStated = checks the texts do not mention. */
  premises: { notStated: string[] } | null
  ranking: RankingDTO | null
}

export type RankingDTO = {
  rank: number
  /** Low end (worst case, used for the rank) and high end of the score. */
  score: number
  scoreHigh: number
  confidence: string
  tier: number
  reasons: { text: string; effect: string; source: SourceDTO }[]
  components: { name: string; weight: number; value: number | null; valueHigh?: number }[]
  /** Monthly cost / expected revenue (code); null when the rent or the revenue is unknown. */
  rentShare: { share: number; threshold: number; aboveThreshold: boolean; source: SourceDTO; thresholdSource: SourceDTO } | null
  /** Decided by code (domain/verdict.ts). */
  verdict: { verdict: Verdict; why: string }
}

export function sourceDTO(s: SourceRef): SourceDTO {
  return {
    kind: s.kind,
    ref: s.ref,
    ...(s.field ? { field: s.field } : {}),
    ...(s.clause ? { clause: s.clause } : {}),
    ...(s.quote ? { quote: s.quote } : {}),
    ...(s.missing ? { missing: true } : {}),
    ...(s.form ? { form: true } : {}),
    ...(s.inputs?.length ? { inputs: s.inputs.map(sourceDTO) } : {}),
  }
}

export function valueDTO(v: unknown): ValueDTO {
  if (v instanceof Money) return { kind: "money", amount: v.amount, currency: v.currency }
  if (v instanceof AreaM2) return { kind: "area", m2: v.value }
  if (isMissingData(v)) return { kind: "missing", missing: [...v.missing], ...(v.unverified ? { unverified: v.unverified } : {}) }
  if (isRentMultiple(v)) return { kind: "rent_multiple", months: v.monthsOfRent }
  if (typeof v === "number") return { kind: "number", value: v }
  if (typeof v === "string") return { kind: "text", value: v }
  if (typeof v === "boolean") return { kind: "bool", value: v }
  if (v && typeof v === "object" && "value" in v && "source" in v) return valueDTO((v as { value: unknown }).value)
  return { kind: "none" }
}

/** A listing field or a Sourced value: the value plus its source (MissingData has no source). */
export function fieldDTO(f: unknown): FieldDTO {
  if (f && typeof f === "object" && "source" in f && "value" in f) {
    return { value: valueDTO((f as { value: unknown }).value), source: sourceDTO((f as { source: SourceRef }).source) }
  }
  return { value: valueDTO(f) }
}

const flagDTO = (f: { rule: string; reason: string; raisedBy: string; aspect: string; source: SourceRef }): FlagDTO => ({
  rule: f.rule,
  reason: f.reason,
  raisedBy: f.raisedBy,
  aspect: f.aspect,
  source: sourceDTO(f.source),
})

function findingDTO(f: Finding): FindingDTO {
  return {
    id: f.id,
    aspect: f.aspect,
    severity: f.severity,
    claim: f.claim,
    author: f.author,
    ...(f.checkBeforeSigning ? { checkBeforeSigning: f.checkBeforeSigning } : {}),
    ...(f.value !== undefined ? { value: valueDTO(f.value) } : {}),
    source: sourceDTO(f.source),
  }
}

const LISTING_KEYS = ["title", "kind", "city", "address", "rentMonthly", "area", "deposit", "serviceChargeMonthly", "floor", "heating", "parking"] as const

export type ReportDTO = {
  recommended: string[]
  sections: Record<string, { text: string; status: string; note?: string; facts: { id: string; text: string; candidateId: string; source: SourceDTO }[] }[]>
  audit: { checked: number; corrected: number; removed: number; attempts: number }
  failed: string | null
}

/** The audited report with every cited fact and its source (the source labels next to each sentence). */
export function reportDTO(state: SuiteSpotState): ReportDTO {
  const r = state.report!
  const facts = new Map(state.reportFacts.map((f) => [f.id, f]))
  return {
    recommended: [...r.recommended],
    sections: Object.fromEntries(
      Object.entries(r.sections).map(([k, list]) => [
        k,
        list.map((s) => ({
          text: s.text,
          status: s.status,
          ...(s.note ? { note: s.note } : {}),
          facts: s.facts.flatMap((id) => {
            const f = facts.get(id)
            return f ? [{ id: f.id, text: f.text, candidateId: f.candidateId, source: sourceDTO(f.source) }] : []
          }),
        })),
      ]),
    ),
    audit: { ...r.audit },
    failed: r.failed ?? null,
  }
}

export function candidateDTO(c: Candidate, state: SuiteSpotState): CandidateDTO {
  const listing = c.listing as unknown as Record<string, unknown>
  return {
    id: c.id,
    synthetic: c.listing.synthetic,
    listingUrl: c.listing.url ? { url: c.listing.url.value, source: sourceDTO(c.listing.url.source) } : null,
    status: c.status,
    hasLease: state.hasLease(c.id),
    fields: Object.fromEntries(LISTING_KEYS.map((k) => [k, fieldDTO(listing[k])])),
    unverified: [...c.listing.unverified],
    rejection: c.rejection ? flagDTO(c.rejection) : null,
    laterFlags: c.laterFlags.map(flagDTO),
    findings: state.findings.filter((f) => f.candidateId === c.id).map(findingDTO),
    premises: premisesDTO(state, c.id),
    ranking: rankingDTO(state, c.id),
  }
}

function premisesDTO(state: SuiteSpotState, id: string): CandidateDTO["premises"] {
  const facts = state.premises.get(id)
  if (!facts || !state.profile) return null
  return { notStated: [...evaluatePremises(facts, state.profile.businessType().value).unknown] }
}

function rankingDTO(state: SuiteSpotState, id: string): RankingDTO | null {
  const r = state.rankings.get(id)
  if (!r) return null
  return {
    rank: r.rank,
    score: r.score,
    scoreHigh: r.scoreHigh,
    confidence: r.confidence,
    tier: r.tier,
    reasons: r.reasons.map((x) => ({ text: x.text, effect: x.effect, source: sourceDTO(x.source) })),
    components: r.components.map((c) => ({ name: c.name, weight: c.weight, value: c.value, ...(c.valueHigh !== undefined ? { valueHigh: c.valueHigh } : {}) })),
    rentShare: isMissingData(r.rentShare)
      ? null
      : { share: r.rentShare.share.value, threshold: r.rentShare.threshold.value, aboveThreshold: r.rentShare.aboveThreshold, source: sourceDTO(r.rentShare.share.source), thresholdSource: sourceDTO(r.rentShare.threshold.source) },
    verdict: verdictFor(r, false),
  }
}
