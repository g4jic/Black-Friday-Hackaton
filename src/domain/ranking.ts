import type { AreaM2 } from "./area.js"
import type { Finding } from "./finding.js"
import type { LeaseClauses } from "./lease.js"
import type { Listing } from "./listing-extraction.js"
import { isMissingData, type MissingData } from "./missing.js"
import type { Money } from "./money.js"
import type { BusinessProfile } from "./profile.js"
import { calc, validateSource, type SourceRef, type Sourced } from "./source.js"

/**
 * The Ranker's rules: plain code, no model. Shown to the user on the Assumptions screen (served from this object, so
 * the screen and the code can never disagree). Labelled "SuiteSpot assumptions": they are our choices, not facts.
 */
export const RANKING_ASSUMPTIONS = {
  weights: { cost: 45, area: 20, lease: 20, checks: 15 },
  cost: {
    description: "Monthly cost (rent + stated service charge) as a share of the monthly budget",
    fullScoreAtOrBelow: 0.7,
    zeroScoreAt: 1.1,
  },
  area: {
    description: "Inside the required range scores 0.7 to 1 (best in the middle); outside scores 0",
    insideMin: 0.7,
  },
  lease: {
    description: "Average of the lease terms the lease states (only when a lease draft was read and verified)",
    earlyExit: { allowed: 1, notAllowed: 0.3 },
    noticeMonths: [
      { upTo: 3, score: 1 },
      { upTo: 6, score: 0.6 },
      { upTo: Infinity, score: 0.3 },
    ],
    indexation: { none: 1, cpi: 1, fixedUpTo3: 0.9, fixedUpTo5: 0.7, fixedAbove5: 0.4 },
  },
  checks: {
    description: "Each point to check before signing (soft flag or unverified field) lowers this part by 0.15",
    penaltyEach: 0.15,
    /** Already scored under lease terms, so not counted twice. */
    notCountedTwice: ["long_notice", "high_indexation"],
  },
  missingData: "Unknown parts count as worst case for ranking.",
  missingDataDetail: "A part without data gives a score range: the low end counts it as 0, the high end as full. The rank uses the low end; the confidence says how much is unknown.",
  confidence: { high: "no key input missing", medium: "one key input missing (area or verified lease terms) or an unverified field", low: "the rent is missing, or two or more key inputs are missing" },
  order: [
    "Candidates with a stated rent, by the low end of their score (worst case)",
    "Then candidates without a stated rent: they can never rank first",
    "Ties: higher confidence first, then candidate id",
  ],
} as const

export type Confidence = "high" | "medium" | "low"
export type ScoreComponent = { readonly name: keyof typeof RANKING_ASSUMPTIONS.weights; readonly weight: number; readonly value: number | null }
export type ScoreReason = { readonly text: string; readonly effect: "plus" | "minus" | "confidence" | "order"; readonly source: SourceRef }

export type CandidateScore = {
  readonly candidateId: string
  /** The low end (worst case): unknown parts count as 0. This is what the rank uses. */
  readonly score: number
  /** The high end: unknown parts count as full. Equal to score when nothing is unknown. */
  readonly scoreHigh: number
  readonly confidence: Confidence
  /** 1 = rent stated, 2 = no rent (never first). */
  readonly tier: 1 | 2
  readonly components: readonly ScoreComponent[]
  readonly reasons: readonly ScoreReason[]
}

export type RankedCandidate = CandidateScore & { readonly rank: number }

export type RankingInput = {
  readonly candidateId: string
  readonly listing: Listing
  readonly profile: BusinessProfile
  /** The Finance analyst's monthly cost finding (code-computed), or null when it could not be computed. */
  readonly monthlyCost: Sourced<Money> | null
  readonly lease: LeaseClauses | null
  readonly hasLeaseDraft: boolean
  /** Soft findings of this candidate (lease concerns and others). */
  readonly softFindings: readonly Finding[]
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const fmt = (m: Money) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(m.amount)} ${m.currency}`
const has = <T>(f: Sourced<T> | MissingData | undefined): f is Sourced<T> => f !== undefined && !isMissingData(f)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Scores one candidate. Deterministic: the same input always gives the same score, confidence and reasons. */
export function scoreCandidate(input: RankingInput): CandidateScore {
  const A = RANKING_ASSUMPTIONS
  const { listing, profile } = input
  const reasons: (ScoreReason & { impact: number })[] = []
  const missing: string[] = []

  // Cost: monthly cost against the budget.
  let cost: number | null = null
  if (input.monthlyCost) {
    const budget = profile.money("monthlyBudget")
    const ratio = calc(round2(input.monthlyCost.value.amount / budget.value.amount), "monthly cost / monthly budget", [input.monthlyCost, budget])
    cost = Math.max(0, Math.min(1, (A.cost.zeroScoreAt - ratio.value) / (A.cost.zeroScoreAt - A.cost.fullScoreAtOrBelow)))
    reasons.push({
      text: `Monthly cost ${fmt(input.monthlyCost.value)} is ${pct(ratio.value)} of the ${fmt(budget.value)} budget`,
      effect: cost >= 0.5 ? "plus" : "minus",
      source: ratio.source,
      impact: (cost - 0.5) * A.weights.cost,
    })
  } else missing.push("rent")

  // Area: inside the required range.
  let area: number | null = null
  if (has<AreaM2>(listing.area)) {
    const { min, max } = profile.areaRange()
    const m2 = listing.area.value.value
    const mid = (min.value.value + max.value.value) / 2
    const half = Math.max(1, (max.value.value - min.value.value) / 2)
    const inside = listing.area.value.isWithin(min.value, max.value)
    area = inside ? round2(1 - (Math.abs(m2 - mid) / half) * (1 - A.area.insideMin)) : 0
    const src = calc(m2, "area compared with the required range", [listing.area, min, max]).source
    reasons.push({
      text: inside ? `${m2} m² is inside the required ${min.value.value}-${max.value.value} m²` : `${m2} m² is outside the required ${min.value.value}-${max.value.value} m²`,
      effect: inside ? "plus" : "minus",
      source: src,
      impact: (area - 0.5) * A.weights.area,
    })
  } else missing.push("area")

  // Lease terms: only from a read lease (verified clauses).
  let lease: number | null = null
  const clauses = input.lease
  if (clauses) {
    const parts: { score: number; text: string; source: SourceRef }[] = []
    if (has(clauses.tenantMayTerminateEarly)) {
      const ok = clauses.tenantMayTerminateEarly.value
      parts.push({ score: ok ? A.lease.earlyExit.allowed : A.lease.earlyExit.notAllowed, text: ok ? "the lease allows early exit" : "the lease does not allow early exit", source: clauses.tenantMayTerminateEarly.source })
    }
    if (has(clauses.noticePeriod)) {
      const n = clauses.noticePeriod.value
      parts.push({ score: A.lease.noticeMonths.find((b) => n <= b.upTo)!.score, text: `${n} months' notice`, source: clauses.noticePeriod.source })
    }
    if (has(clauses.indexationKind)) {
      const kind = clauses.indexationKind.value
      const rate = has(clauses.indexationRatePercent) ? clauses.indexationRatePercent.value : null
      const s =
        kind === "none" || kind === "cpi"
          ? A.lease.indexation[kind]
          : kind === "fixed_rate" && rate !== null
            ? rate <= 3
              ? A.lease.indexation.fixedUpTo3
              : rate <= 5
                ? A.lease.indexation.fixedUpTo5
                : A.lease.indexation.fixedAbove5
            : null
      if (s !== null) parts.push({ score: s, text: kind === "fixed_rate" ? `rent rises ${rate}% a year` : kind === "cpi" ? "rent follows the price index" : "no rent increase clause", source: clauses.indexationKind.source })
    }
    if (parts.length > 0) {
      lease = round2(parts.reduce((a, p) => a + p.score, 0) / parts.length)
      const worst = [...parts].sort((a, b) => a.score - b.score)[0]!
      const best = [...parts].sort((a, b) => b.score - a.score)[0]!
      const pick = lease >= 0.75 ? best : worst
      reasons.push({ text: `Lease: ${pick.text}`, effect: lease >= 0.75 ? "plus" : "minus", source: pick.source, impact: (lease - 0.5) * A.weights.lease })
    } else missing.push("lease terms")
  } else missing.push("lease terms")

  // Points to check before signing (soft flags and unverified fields), lease terms not counted twice.
  const notTwice = new Set<string>(A.checks.notCountedTwice)
  const counted = input.softFindings.filter((f) => !notTwice.has(f.id.split(":").pop() ?? ""))
  const unverified = listing.unverified
  const nChecks = counted.length + unverified.length
  const checks = round2(Math.max(0, 1 - A.checks.penaltyEach * nChecks))
  if (nChecks > 0) {
    const sources = [...counted.map((f) => f.source), ...unverified.map((u) => ({ kind: "listing" as const, ref: listing.ref, field: u.field, missing: true }))]
    reasons.push({
      text: `${nChecks} point${nChecks > 1 ? "s" : ""} to check before signing${counted[0] ? ` (${counted[0].claim.toLowerCase()})` : ""}`,
      effect: "minus",
      source: calc(nChecks, "count of points to check before signing", sources.map((s) => ({ value: 0, source: s }))).source,
      impact: (checks - 1) * A.weights.checks - 0.01,
    })
  }

  // Score range: unknown parts count as 0 for the low end (worst case) and as full for the high end.
  const components: ScoreComponent[] = [
    { name: "cost", weight: A.weights.cost, value: cost },
    { name: "area", weight: A.weights.area, value: area },
    { name: "lease", weight: A.weights.lease, value: lease },
    { name: "checks", weight: A.weights.checks, value: checks },
  ]
  const total = components.reduce((a, c) => a + c.weight, 0)
  const score = Math.round((100 * components.reduce((a, c) => a + c.weight * (c.value ?? 0), 0)) / total)
  const scoreHigh = Math.round((100 * components.reduce((a, c) => a + c.weight * (c.value ?? 1), 0)) / total)

  const keyMissing = missing.length + (unverified.length > 0 ? 1 : 0)
  const confidence: Confidence = missing.includes("rent") || keyMissing >= 2 ? "low" : keyMissing === 1 ? "medium" : "high"
  const tier: 1 | 2 = missing.includes("rent") ? 2 : 1

  const out: ScoreReason[] = []
  if (tier === 2) {
    out.push({ text: "Cannot rank first: the listing does not state the rent (missing data)", effect: "order", source: { kind: "listing", ref: listing.ref, field: "rentMonthly", missing: true } })
  }
  const byImpact = [...reasons].sort((a, b) => b.impact - a.impact || a.text.localeCompare(b.text))
  const plus = byImpact.find((r) => r.effect === "plus")
  const minus = [...byImpact].reverse().find((r) => r.effect === "minus")
  for (const r of [plus, minus]) if (r && out.length < 3) out.push({ text: r.text, effect: r.effect, source: r.source })
  // Always at least two reasons: add the next most important one that is not shown yet.
  for (const r of byImpact) {
    if (out.length >= 2) break
    if (!out.some((o) => o.text === r.text)) out.push({ text: r.text, effect: r.effect, source: r.source })
  }
  if (confidence !== "high" && out.length < 3) {
    const what = missing.filter((m) => m !== "rent")
    const points = (name: ScoreComponent["name"]) => A.weights[name]
    const label = [
      ...what.map((m) =>
        m === "area"
          ? `area not stated: up to ${points("area")} points unknown`
          : input.hasLeaseDraft
            ? `lease terms not verified: up to ${points("lease")} points unknown`
            : `no lease draft: up to ${points("lease")} points unknown`,
      ),
      ...(missing.includes("rent") ? [`rent not stated: up to ${points("cost")} points unknown`] : []),
      ...(unverified.length ? [`${unverified.length} unverified field${unverified.length > 1 ? "s" : ""}`] : []),
    ]
    const source: SourceRef = what.includes("lease terms")
      ? input.hasLeaseDraft
        ? { kind: "lease", ref: `lease-${input.candidateId}`, clause: "term" }
        : { kind: "profile", ref: "questionnaire", field: "leaseMonths" }
      : what.includes("area")
        ? { kind: "listing", ref: listing.ref, field: "area", missing: true }
        : { kind: "listing", ref: listing.ref, field: unverified[0]?.field ?? "rentMonthly", missing: true }
    if (label.length) {
      out.push({
        text: `Confidence ${confidence}: ${label.join("; ")}`,
        effect: "confidence",
        source,
      })
    }
  }
  for (const r of out) validateSource(r.source) // no reason without a valid source
  return Object.freeze({ candidateId: input.candidateId, score, scoreHigh, confidence, tier, components: Object.freeze(components), reasons: Object.freeze(out) })
}

const CONFIDENCE_ORDER: Record<Confidence, number> = { high: 0, medium: 1, low: 2 }

/** Orders the scored candidates: tier (no rent last), then the low end of the score (worst case), then confidence, then id. */
export function rankCandidates(scores: readonly CandidateScore[]): RankedCandidate[] {
  return [...scores]
    .sort((a, b) => a.tier - b.tier || b.score - a.score || CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence] || a.candidateId.localeCompare(b.candidateId))
    .map((s, i) => Object.freeze({ ...s, rank: i + 1 }))
}
