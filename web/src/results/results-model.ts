import { areaM2, candidateLocation, candidateShortName } from "../candidate-label"
import type { ResearchState } from "../research-state"
import type { CandidateDTO, FindingDTO, SourceDTO, ValueDTO, Verdict } from "../types"
import { formatMoney } from "../format"

/**
 * What the results screens show, derived only from the run's state. Pure functions, no DOM, nothing invented:
 * every line points to a finding, a listing field, the Ranker's score or the questionnaire.
 * Tested in tests/results-model.test.ts.
 */

export const VERDICT_LABEL: Record<Verdict, string> = { good: "Good", check_before_signing: "Check before signing", not_recommended: "Not recommended" }
export const CONFIDENCE_LABEL: Record<string, string> = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" }

/** Where a number comes from, in plain language. */
export function plainSource(source: SourceDTO): string {
  switch (source.kind) {
    case "listing":
      return source.field === "url" ? "you entered it" : source.form ? "from the listing form" : "from the listing"
    case "lease":
      return "from the lease draft"
    case "profile":
      return "your questionnaire"
    case "calc":
      return "our calculation"
    case "assumption":
      return "SuiteSpot assumption"
    case "osm":
      return "OpenStreetMap"
    case "estimate":
      return "estimate"
    default:
      return source.kind
  }
}

export type ListEntry = {
  candidate: CandidateDTO
  /** 1-based position of the listing in the run, for the "Listing N" fallback name */
  listingNumber: number
  name: string
  location: string | null
  areaM2: number | null
  monthlyCost: string | null
  verdict: Verdict
  score: number | null
  confidence: string | null
  /** the scale behind the confidence label, for its tooltip */
  scoreRangeNote: string | null
  mainReason: string
}

const findingOf = (c: CandidateDTO, name: string): FindingDTO | undefined => c.findings.find((f) => f.id === `${c.id}:finance:${name}`)

const moneyText = (value: ValueDTO | undefined): string | null => (value?.kind === "money" ? formatMoney(value.amount, value.currency) : null)

function monthlyCostText(c: CandidateDTO): string | null {
  return moneyText(findingOf(c, "monthly_cost")?.value) ?? moneyText(c.fields.rentMonthly?.value)
}

const listingNumbers = (s: ResearchState) => {
  const ids = [...new Set([...s.submitted, ...s.order])]
  return (id: string) => ids.indexOf(id) + 1 || ids.length + 1
}

/** "Lease: the lease allows early exit" reads as "The lease allows early exit". */
const sentence = (reason: string | undefined) => {
  if (!reason) return undefined
  const text = reason.replace(/^Lease: /, "")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function entryFor(c: CandidateDTO, listingNumber: number): ListEntry {
  const ranking = c.ranking
  const rejected = c.status === "rejected"
  const verdict: Verdict = rejected ? "not_recommended" : (ranking?.verdict.verdict ?? "not_recommended")
  const mainReason = rejected
    ? (c.rejection?.reason ?? "Rejected by a hard flag")
    : ranking
      ? (sentence(ranking.reasons[0]?.text) ?? ranking.verdict.why)
      : "This space could not be scored"
  return {
    candidate: c,
    listingNumber,
    name: candidateShortName(c, listingNumber),
    location: candidateLocation(c),
    areaM2: areaM2(c),
    monthlyCost: monthlyCostText(c),
    verdict,
    score: ranking?.score ?? null,
    confidence: ranking ? (CONFIDENCE_LABEL[ranking.confidence] ?? ranking.confidence) : null,
    scoreRangeNote: ranking
      ? ranking.scoreHigh > ranking.score
        ? `Worst case ${ranking.score}, ${ranking.scoreHigh} if every unknown turns out well. The rank uses the worst case.`
        : `Nothing in the score is unknown: ${ranking.score} out of 100.`
      : null,
    mainReason,
  }
}

/** One list, highest score first (ties: the Ranker's order). Rejected candidates are separate, for the bottom block. */
export function resultsList(s: ResearchState): { ranked: ListEntry[]; rejected: ListEntry[] } {
  const numberOf = listingNumbers(s)
  const candidates = s.order.map((id) => s.candidates[id]).filter((c): c is CandidateDTO => Boolean(c))
  const ranked = candidates
    .filter((c) => c.status !== "rejected")
    .map((c) => entryFor(c, numberOf(c.id)))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.candidate.ranking?.rank ?? 99) - (b.candidate.ranking?.rank ?? 99))
  const rejected = candidates.filter((c) => c.status === "rejected").map((c) => entryFor(c, numberOf(c.id)))
  return { ranked, rejected }
}

/** The one sentence above the list. */
export function headline(s: ResearchState): string {
  const { ranked, rejected } = resultsList(s)
  const best = ranked.find((e) => e.score !== null)
  if (!best) {
    return rejected.length > 0 ? "No space is recommended: every candidate was rejected by a hard flag or could not be scored." : "No candidate could be scored in this run."
  }
  const name = best.location && best.areaM2 !== null ? `${best.location.split(",")[0]}, ${Math.round(best.areaM2)} m2` : best.name
  if (best.verdict === "not_recommended") return `No space is recommended. Highest score: ${name} - Not recommended, score ${best.score}.`
  return `Best option: ${name} - ${VERDICT_LABEL[best.verdict]}, score ${best.score}.`
}

// ---------------------------------------------------------------- candidate page

export type CostRow = { label: string; value: string | null; source: string | null; note: string | null }

const costRow = (c: CandidateDTO, name: string, label: string, render: (v: ValueDTO) => string | null, missingNote: string): CostRow => {
  const f = findingOf(c, name)
  if (!f || !f.value) return { label, value: null, source: null, note: "Not calculated in this run" }
  if (f.value.kind === "missing") return { label, value: null, source: plainSource(f.source), note: missingNote }
  const fromQuestionnaireTerm = f.claim.includes("no lease draft") ? "Uses the lease length from your questionnaire (no lease draft yet)" : null
  return { label, value: render(f.value), source: plainSource(f.source), note: fromQuestionnaireTerm }
}

export function costRows(c: CandidateDTO): CostRow[] {
  const exit = costRow(c, "exit_cost_after_12_months", "Exit after 12 months", moneyText, "Needs lease terms (the notice period is unknown)")
  const known = findingOf(c, "exit_cost_known_part")
  if (exit.value === null && known?.value?.kind === "money") {
    exit.note = `Needs lease terms. Includes ${formatMoney(known.value.amount, known.value.currency)} unrecovered fit-out.`
  }
  const termMonths = /over (\d+) months/.exec(findingOf(c, "total_cost_over_term")?.claim ?? "")?.[1]
  return [
    costRow(c, "monthly_cost", "Monthly cost", moneyText, "Needs the rent from the listing"),
    costRow(c, "initial_costs", "Initial cost", moneyText, "Needs the rent and deposit"),
    costRow(c, "total_cost_over_term", termMonths ? `Total over the lease (${termMonths} months)` : "Total over the lease", moneyText, "Needs the lease length"),
    exit,
    costRow(c, "break_even_revenue", "Break-even revenue", (v) => (moneyText(v) ? `${moneyText(v)} per month` : null), "Needs your gross margin (questionnaire)"),
    costRow(c, "payback_months", "Payback", (v) => (v.kind === "number" ? `${v.value} months` : v.kind === "none" ? "Never at the expected revenue" : null), "Needs your gross margin (questionnaire)"),
  ]
}

export type PointItem = { text: string; hard: boolean; source: string | null }

/** Strengths and risks; hard flags first, then points to check before signing, then the Ranker's minus reasons. */
export function strengthsAndRisks(c: CandidateDTO): { strengths: PointItem[]; risks: PointItem[] } {
  const hardFlags = [...(c.rejection ? [c.rejection] : []), ...c.laterFlags]
  const risks: PointItem[] = [
    ...hardFlags.map((f) => ({ text: `Hard flag: ${f.reason}`, hard: true, source: plainSource(f.source) })),
    ...c.findings.filter((f) => f.severity === "soft").map((f) => ({ text: f.checkBeforeSigning ? `Check before signing: ${f.checkBeforeSigning}` : f.claim, hard: false, source: plainSource(f.source) })),
    ...c.unverified.map((u) => ({ text: `The ${u.field} could not be verified from the text`, hard: false, source: "from the listing" })),
    ...(c.ranking?.reasons.filter((r) => r.effect === "minus").map((r) => ({ text: r.text, hard: false, source: plainSource(r.source) })) ?? []),
  ]
  const strengths = c.ranking?.reasons.filter((r) => r.effect === "plus").map((r) => ({ text: r.text.replace(/^Lease: /, ""), hard: false, source: plainSource(r.source) })) ?? []
  return { strengths, risks }
}

/** Questions for the landlord when there is no lease draft: one per term the calculations needed and did not have. */
export const LANDLORD_QUESTIONS = [
  { term: "lease length", question: "How long is the lease, and can it be renewed?" },
  { term: "early exit", question: "Can the tenant end the lease early, and with how many months' notice?" },
  { term: "indexation", question: "Is the rent indexed each year, and by what (inflation or a fixed percentage)?" },
  { term: "deposit", question: "How large is the deposit, and when is it returned?" },
  { term: "repairs", question: "Who pays for structural repairs?" },
  { term: "permitted use", question: "Does the lease allow your business activity in this space?" },
] as const

export function leaseSection(c: CandidateDTO): { hasLease: boolean; terms: { text: string; source: string }[]; questions: string[] } {
  const terms = c.findings.filter((f) => f.aspect === "lease" && f.severity === "info").map((f) => ({ text: f.claim, source: plainSource(f.source) }))
  if (c.hasLease && terms.length > 0) return { hasLease: true, terms, questions: [] }
  return { hasLease: c.hasLease, terms, questions: LANDLORD_QUESTIONS.map((q) => q.question) }
}

const COMPONENT_LABEL: Record<string, string> = { cost: "Monthly cost against your budget", area: "Area against your range", lease: "Lease terms", checks: "Points to check before signing" }
const COMPONENT_MISSING: Record<string, string> = { cost: "the rent is not stated", area: "the area is not stated", lease: "no verified lease terms", checks: "not known" }

/** What lowers the confidence and by how much (points between the worst and the best case). */
export function unknowns(c: CandidateDTO): { items: { text: string; points: number }[]; totalPoints: number } {
  const ranking = c.ranking
  const items: { text: string; points: number }[] = []
  for (const component of ranking?.components ?? []) {
    if (component.value === null) items.push({ text: `${COMPONENT_LABEL[component.name] ?? component.name}: ${COMPONENT_MISSING[component.name] ?? "unknown"}`, points: component.weight })
  }
  for (const u of c.unverified) items.push({ text: `The ${u.field} could not be verified from the text (${u.reason})`, points: 0 })
  const monthly = findingOf(c, "monthly_cost")
  const unknownCosts = /unknown: (.+)$/.exec(monthly?.claim ?? "")?.[1]
  if (unknownCosts && unknownCosts !== "none") items.push({ text: `Not in the monthly cost: ${unknownCosts}`, points: 0 })
  return { items, totalPoints: ranking ? ranking.scoreHigh - ranking.score : 0 }
}

/** Every source behind this candidate, once each, in plain words plus the exact reference. */
export function allSources(c: CandidateDTO): { plain: string; detail: string }[] {
  const seen = new Map<string, { plain: string; detail: string }>()
  const add = (s: SourceDTO | undefined) => {
    if (!s) return
    const detail = s.kind === "profile" ? `Questionnaire: ${s.field ?? s.ref}` : s.kind === "calc" ? `Calculation: ${s.ref}` : `${s.ref}${s.field ? `, ${s.field}` : ""}${s.clause ? `, ${s.clause}` : ""}${s.quote ? `: "${s.quote}"` : ""}`
    if (!seen.has(detail)) seen.set(detail, { plain: plainSource(s), detail })
    for (const input of s.inputs ?? []) add(input)
  }
  for (const field of Object.values(c.fields)) add(field.source)
  for (const f of c.findings) add(f.source)
  for (const r of c.ranking?.reasons ?? []) add(r.source)
  if (c.listingUrl) add(c.listingUrl.source)
  return [...seen.values()]
}
