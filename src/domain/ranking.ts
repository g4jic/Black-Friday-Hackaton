import type { AreaM2 } from "./area.js"
import type { Finding } from "./finding.js"
import type { LeaseClauses } from "./lease.js"
import type { Listing } from "./listing-extraction.js"
import { isMissingData, missingData, type MissingData } from "./missing.js"
import type { Money } from "./money.js"
import type { BusinessProfile } from "./profile.js"
import { calc, sourced, validateSource, type SourceRef, type Sourced } from "./source.js"
import { verdictFor, type Verdict } from "./verdict.js"
import { scoreLocation, type AreaData } from "./location.js"
import { PREMISES_CONCERN_RULES, evaluatePremises, type PremisesFacts } from "./premises.js"

/**
 * The Ranker's rules: plain code, no model. Shown to the user on the Assumptions screen (served from this object, so
 * the screen and the code can never disagree). Labelled "SuiteSpot assumptions": they are our choices, not facts.
 */
export const RANKING_ASSUMPTIONS = {
  weights: { cost: 35, area: 15, lease: 15, location: 10, premises: 10, checks: 15 },
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
  location: {
    description: "OpenStreetMap counts within 300 m of the address, scored per type of business (see Location rules); unknown when the address is not found",
  },
  premises: {
    description: "Share of the premises checks for this type of business that the listing or the lease draft states as suitable (see Premises rules); a check the texts do not mention is unknown and widens the range",
  },
  rentShare: {
    description: "Monthly cost (rent + stated service charge) as a share of your expected monthly revenue. Above the threshold it is a point to check before signing (a soft flag): it never rejects a space and never stops an agent",
    checkAbove: 0.15,
    basis: "SuiteSpot assumption: one threshold for every type of business, our choice and not a rule from a law or a bank",
  },
  checks: {
    description: "Each point to check before signing (soft flag or unverified field) lowers this part by 0.15",
    penaltyEach: 0.15,
    /** Already scored under lease terms or premises, so not counted twice (they still block a Good verdict). */
    notCountedTwice: ["long_notice", "high_indexation", ...PREMISES_CONCERN_RULES],
  },
  missingData: "Unknown parts count as worst case for ranking.",
  missingDataDetail: "A part without data gives a score range: the low end counts it as 0, the high end as full. The rank uses the low end; the confidence says how much is unknown.",
  confidence: { high: "no key input missing", medium: "one key input missing (area, location, premises or verified lease terms; terms only from the listing form count as not verified) or an unverified field", low: "the rent is missing, or two or more key inputs are missing" },
  order: [
    "First by verdict: Good, then Check before signing, then Not recommended, so the best option never has a weaker verdict than another candidate",
    "Inside a verdict: candidates with a stated rent, by the low end of their score (worst case)",
    "Then candidates without a stated rent: they can never rank first",
    "Ties: higher confidence first, then candidate id",
  ],
} as const

export type Confidence = "high" | "medium" | "low"
/** value: the low end of the part (null = unknown). valueHigh: the high end when the part itself is a range (premises). */
export type ScoreComponent = { readonly name: keyof typeof RANKING_ASSUMPTIONS.weights; readonly weight: number; readonly value: number | null; readonly valueHigh?: number }
export type ScoreReason = { readonly text: string; readonly effect: "plus" | "minus" | "confidence" | "order"; readonly source: SourceRef }

/** Monthly cost as a share of expected revenue (code). MissingData when the rent or the expected revenue is not known. */
export type RentShare = { readonly share: Sourced<number>; readonly threshold: Sourced<number>; readonly aboveThreshold: boolean } | MissingData

export type CandidateScore = {
  readonly candidateId: string
  /** The low end (worst case): unknown parts count as 0. This is what the rank uses. */
  readonly score: number
  /** The high end: unknown parts count as full. Equal to score when nothing is unknown. */
  readonly scoreHigh: number
  readonly confidence: Confidence
  /** 1 = rent stated, 2 = no rent (never first). */
  readonly tier: 1 | 2
  /** Soft flags and unverified fields to check before signing, including the premises concerns scored under premises. */
  readonly pointsToCheck: number
  readonly rentShare: RentShare
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
  /** OpenStreetMap counts around the address (code), or null when the location could not be checked. */
  readonly area: AreaData | null
  /** What the Premises inspector read (quotes checked by code), or null when it was not read. */
  readonly premises: PremisesFacts | null
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const fmt = (m: Money) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(m.amount))} ${m.currency}`
const has = <T>(f: Sourced<T> | MissingData | undefined): f is Sourced<T> => f !== undefined && !isMissingData(f)
const round2 = (n: number) => Math.round(n * 100) / 100
/** 0.1834 reads as "18.3%" (the same rounding as the Finance analyst's rent share fact). */
const pct1 = (x: number) => `${Math.round(x * 1000) / 10}%`

/**
 * Monthly cost / expected monthly revenue, with the threshold as a labelled assumption. No monthly cost or no expected
 * revenue (0 means the questionnaire did not give one): MissingData, never a guess.
 */
export function rentShareOf(monthlyCost: Sourced<Money> | null, profile: BusinessProfile): RentShare {
  const revenue = profile.money("expectedMonthlyRevenue")
  if (!monthlyCost) return missingData("rent")
  if (revenue.value.amount <= 0) return missingData("expectedMonthlyRevenue")
  const share = calc(Math.round((monthlyCost.value.amount / revenue.value.amount) * 10000) / 10000, "monthly cost / expected monthly revenue", [monthlyCost, revenue])
  const threshold = sourced(RANKING_ASSUMPTIONS.rentShare.checkAbove, { kind: "assumption", ref: "RANKING_ASSUMPTIONS", field: "rentShare.checkAbove" })
  return { share, threshold, aboveThreshold: share.value > threshold.value }
}

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
    // Terms that only the listing form states (no lease draft read) are the landlord's claim, not a verified lease:
    // they still score, but they cannot give high confidence.
    if (parts.length > 0 && parts.every((p) => p.source.kind === "listing")) missing.push("verified lease")
    if (parts.length > 0) {
      lease = round2(parts.reduce((a, p) => a + p.score, 0) / parts.length)
      const worst = [...parts].sort((a, b) => a.score - b.score)[0]!
      const best = [...parts].sort((a, b) => b.score - a.score)[0]!
      const pick = lease >= 0.75 ? best : worst
      reasons.push({ text: `Lease: ${pick.text}`, effect: lease >= 0.75 ? "plus" : "minus", source: pick.source, impact: (lease - 0.5) * A.weights.lease })
    } else missing.push("lease terms")
  } else missing.push("lease terms")

  // Location: OpenStreetMap counts scored per business type (plain code); unknown when the address was not found.
  let location: number | null = null
  if (input.area) {
    const scored = scoreLocation(input.area, profile.businessType().value)
    location = scored.score
    for (const p of scored.parts) {
      reasons.push({ text: `Location: ${p.text}`, effect: p.effect, source: p.source, impact: ((p.score - 0.5) * A.weights.location) / scored.parts.length })
    }
  } else missing.push("location")

  // Premises: code judges the quoted facts per business type; a check the texts do not mention widens the range.
  let premises: number | null = null
  let premisesHigh: number | undefined
  if (input.premises) {
    const judged = evaluatePremises(input.premises, profile.businessType().value)
    premises = judged.score
    premisesHigh = judged.scoreHigh
    for (const p of judged.parts) {
      reasons.push({ text: `Premises: ${p.text.charAt(0).toLowerCase()}${p.text.slice(1)}`, effect: p.ok ? "plus" : "minus", source: p.source, impact: ((p.ok ? 0.5 : -0.5) * A.weights.premises) / judged.total })
    }
  } else missing.push("premises")

  // Rent share of revenue: a soft point to check above the threshold (assumption); unknown without revenue.
  const rentShare = rentShareOf(input.monthlyCost, profile)
  const rentShareCheck = !isMissingData(rentShare) && rentShare.aboveThreshold ? 1 : 0
  if (!isMissingData(rentShare)) {
    reasons.push({
      text: rentShare.aboveThreshold
        ? `Rent takes ${pct1(rentShare.share.value)} of expected revenue, above the ${pct(rentShare.threshold.value)} SuiteSpot threshold`
        : `Rent takes ${pct1(rentShare.share.value)} of expected revenue, within the ${pct(rentShare.threshold.value)} SuiteSpot threshold`,
      effect: rentShare.aboveThreshold ? "minus" : "plus",
      source: rentShare.share.source,
      impact: rentShare.aboveThreshold ? -A.weights.checks * A.checks.penaltyEach : 0.5,
    })
  }

  // Points to check before signing (soft flags and unverified fields), lease terms not counted twice.
  const notTwice = new Set<string>(A.checks.notCountedTwice)
  const counted = input.softFindings.filter((f) => !notTwice.has(f.id.split(":").pop() ?? ""))
  const unverified = listing.unverified
  const nChecks = counted.length + unverified.length + rentShareCheck
  const checks = round2(Math.max(0, 1 - A.checks.penaltyEach * nChecks))
  const premisesRules = new Set(PREMISES_CONCERN_RULES)
  const premisesConcerns = input.softFindings.filter((f) => premisesRules.has(f.id.split(":").pop() ?? "")).length
  if (nChecks > 0) {
    const sources = [
      ...counted.map((f) => f.source),
      ...unverified.map((u) => ({ kind: "listing" as const, ref: listing.ref, field: u.field, missing: true })),
      ...(rentShareCheck && !isMissingData(rentShare) ? [rentShare.share.source] : []),
    ]
    reasons.push({
      text: `${nChecks} point${nChecks > 1 ? "s" : ""} to check before signing${counted[0] ? ` (${counted[0].claim.charAt(0).toLowerCase()}${counted[0].claim.slice(1)})` : ""}`,
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
    { name: "location", weight: A.weights.location, value: location },
    { name: "premises", weight: A.weights.premises, value: premises, ...(premisesHigh !== undefined ? { valueHigh: premisesHigh } : {}) },
    { name: "checks", weight: A.weights.checks, value: checks },
  ]
  const total = components.reduce((a, c) => a + c.weight, 0)
  const score = Math.round((100 * components.reduce((a, c) => a + c.weight * (c.value ?? 0), 0)) / total)
  const scoreHigh = Math.round((100 * components.reduce((a, c) => a + c.weight * (c.valueHigh ?? c.value ?? 1), 0)) / total)

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
          : m === "premises"
          ? `premises not read: up to ${points("premises")} points unknown`
          : m === "location"
          ? `location not checked (no OpenStreetMap area data for this address): up to ${points("location")} points unknown`
          : m === "verified lease"
            ? "lease terms come from the listing form, not from a lease draft"
            : input.hasLeaseDraft
            ? `lease terms not verified: up to ${points("lease")} points unknown`
            : `no lease draft: up to ${points("lease")} points unknown`,
      ),
      ...(missing.includes("rent") ? [`rent not stated: up to ${points("cost")} points unknown`] : []),
      ...(unverified.length ? [`${unverified.length} unverified field${unverified.length > 1 ? "s" : ""}`] : []),
    ]
    const source: SourceRef = what.includes("verified lease")
      ? { kind: "listing", ref: listing.ref, field: "minimumTermMonths", form: true }
      : what.includes("lease terms")
      ? input.hasLeaseDraft
        ? { kind: "lease", ref: `lease-${input.candidateId}`, clause: "term" }
        : { kind: "profile", ref: "questionnaire", field: "leaseMonths" }
      : what.includes("area")
        ? { kind: "listing", ref: listing.ref, field: "area", missing: true }
        : what.includes("location")
          ? { kind: "osm", ref: "OpenStreetMap area data: not available for this address", field: "address" }
          : what.includes("premises")
            ? { kind: "listing", ref: listing.ref, field: "premises", missing: true }
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
  return Object.freeze({ candidateId: input.candidateId, score, scoreHigh, confidence, tier, pointsToCheck: nChecks + premisesConcerns, rentShare, components: Object.freeze(components), reasons: Object.freeze(out) })
}

const CONFIDENCE_ORDER: Record<Confidence, number> = { high: 0, medium: 1, low: 2 }
const VERDICT_ORDER: Record<Verdict, number> = { good: 0, check_before_signing: 1, not_recommended: 2 }

/**
 * Orders the scored candidates: the verdict first (Good, then Check before signing, then Not recommended), so the
 * first place never has a weaker verdict than another candidate; inside a verdict: tier (no rent last), the low end of
 * the score (worst case), confidence, then id.
 */
export function rankCandidates(scores: readonly CandidateScore[]): RankedCandidate[] {
  const verdictRank = (s: CandidateScore) => VERDICT_ORDER[verdictFor(s, false).verdict]
  return [...scores]
    .sort((a, b) => verdictRank(a) - verdictRank(b) || a.tier - b.tier || b.score - a.score || CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence] || a.candidateId.localeCompare(b.candidateId))
    .map((s, i) => Object.freeze({ ...s, rank: i + 1 }))
}
