import { areaM2, candidateLocation, candidateShortName } from "../candidate-label"
import type { ResearchState } from "../research-state"
import type { CandidateDTO, FindingDTO, SourceDTO, ValueDTO, Verdict } from "../types"
import { formatMoney } from "../format"

/**
 * What the results screens show, derived only from the run's state. Pure functions, no DOM, nothing invented:
 * every line points to a finding, a listing field, the Ranker's score or the questionnaire.
 * Tested in tests/results-model.test.ts.
 */

/** The server's verdict, plus "cannot_judge" for a candidate whose rent is not stated (a score without a price means little). */
export type DisplayVerdict = Verdict | "cannot_judge"
export const VERDICT_LABEL: Record<DisplayVerdict, string> = {
  good: "Good",
  check_before_signing: "Check before signing",
  not_recommended: "Not recommended",
  cannot_judge: "Can't judge: rent not stated",
}
/** The colour of the rank circle: green good, yellow check before signing, red not recommended, grey cannot judge. */
export type VerdictTone = "good" | "check" | "bad" | "unknown"
export const VERDICT_TONE: Record<DisplayVerdict, VerdictTone> = {
  good: "good",
  check_before_signing: "check",
  not_recommended: "bad",
  cannot_judge: "unknown",
}
/** What each colour means, for the legend, the tooltip and How it works. */
export const VERDICT_MEANING: Record<DisplayVerdict, string> = {
  good: "No deal breaker and nothing to check before signing",
  check_before_signing: "Worth a look, with named points to check first",
  not_recommended: "A deal breaker was found, or the space does not fit",
  cannot_judge: "The rent is not stated, so the cost cannot be judged",
}
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
  monthlyCostSource: SourceDTO | null
  /** "18.3% of expected revenue", from the Ranker (code); null when the rent or the revenue is unknown */
  rentShare: { text: string; aboveThreshold: boolean; source: SourceDTO } | null
  verdict: DisplayVerdict
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

function monthlyCostSource(c: CandidateDTO): SourceDTO | null {
  const f = findingOf(c, "monthly_cost")
  if (f?.value?.kind === "money") return f.source
  return c.fields.rentMonthly?.value.kind === "money" ? (c.fields.rentMonthly.source ?? null) : null
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

/** Lower-cases the first letter to join two reasons, and puts back the product name the Ranker's own text lowered. */
const lowerFirst = (s: string) => (s.charAt(0).toLowerCase() + s.slice(1)).replace(/\bsuiteSpot\b/g, "SuiteSpot")

/** Why the score is what it is, in one line: the strongest plus and the biggest minus (the Ranker's own reasons). */
export function scoreReason(c: CandidateDTO): string | undefined {
  const reasons = c.ranking?.reasons ?? []
  const plus = sentence(reasons.find((r) => r.effect === "plus")?.text)
  const minus = sentence(reasons.find((r) => r.effect === "minus")?.text)
  if (plus && minus) return `${plus}; but ${lowerFirst(minus)}`
  return plus ?? minus
}

const rentMissing = (c: CandidateDTO) => {
  const rent = c.fields.rentMonthly?.value
  return !rent || rent.kind === "missing"
}

function entryFor(c: CandidateDTO, listingNumber: number): ListEntry {
  const ranking = c.ranking
  const rejected = c.status === "rejected"
  const verdict: DisplayVerdict = rejected ? "not_recommended" : rentMissing(c) ? "cannot_judge" : (ranking?.verdict.verdict ?? "not_recommended")
  const mainReason = rejected
    ? (c.rejection?.reason ?? "Rejected by a hard flag")
    : verdict === "cannot_judge"
      ? "The listing does not state the rent, so the cost cannot be judged"
      : ranking
        ? (scoreReason(c) ?? ranking.verdict.why)
        : "This space could not be scored"
  return {
    candidate: c,
    listingNumber,
    name: candidateShortName(c, listingNumber),
    location: candidateLocation(c),
    areaM2: areaM2(c),
    monthlyCost: monthlyCostText(c),
    monthlyCostSource: monthlyCostSource(c),
    rentShare: rentShareOf(c),
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

/** One list in the Ranker's order (verdict first, then the worst-case score). Rejected candidates are separate, for the bottom block. */
export function resultsList(s: ResearchState): { ranked: ListEntry[]; rejected: ListEntry[] } {
  const numberOf = listingNumbers(s)
  const candidates = s.order.map((id) => s.candidates[id]).filter((c): c is CandidateDTO => Boolean(c))
  const ranked = candidates
    .filter((c) => c.status !== "rejected")
    .map((c) => entryFor(c, numberOf(c.id)))
    .sort((a, b) => (a.candidate.ranking?.rank ?? Number.MAX_SAFE_INTEGER) - (b.candidate.ranking?.rank ?? Number.MAX_SAFE_INTEGER))
  const rejected = candidates.filter((c) => c.status === "rejected").map((c) => entryFor(c, numberOf(c.id)))
  return { ranked, rejected }
}

/** The one sentence above the list. */
export function headline(s: ResearchState): string {
  const { ranked, rejected } = resultsList(s)
  // A candidate without a rent cannot be judged, so it is never called the best option.
  const best = ranked.find((e) => e.score !== null && e.verdict !== "cannot_judge") ?? ranked.find((e) => e.score !== null)
  if (!best) {
    return rejected.length > 0
      ? "No space is recommended: every candidate was rejected by a hard flag or could not be scored."
      : "No candidate could be scored in this run."
  }
  const name = best.location && best.areaM2 !== null ? `${best.location.split(",")[0]}, ${Math.round(best.areaM2)} m2` : best.name
  if (best.verdict === "cannot_judge") return `No space can be judged yet: ${name} has the highest score, but its rent is not stated.`
  if (best.verdict === "not_recommended") return `No space is recommended. Highest score: ${name} - Not recommended, score ${best.score}.`
  return `Best option: ${name} - ${VERDICT_LABEL[best.verdict]}, score ${best.score}.`
}

// ---------------------------------------------------------------- candidate page

/** 0.1834 reads as "18.3%", the same rounding as the server's facts. */
export const percent1 = (share: number) => `${Math.round(share * 1000) / 10}%`

export function rentShareOf(c: CandidateDTO): ListEntry["rentShare"] {
  const r = c.ranking?.rentShare
  if (!r) return null
  return { text: `${percent1(r.share)} of expected revenue`, aboveThreshold: r.aboveThreshold, source: r.source }
}

export type CostRow = { label: string; value: string | null; source: string | null; note: string | null; ref: SourceDTO | null }

const costRow = (c: CandidateDTO, name: string, label: string, render: (v: ValueDTO) => string | null, missingNote: string): CostRow => {
  const f = findingOf(c, name)
  if (!f || !f.value) return { label, value: null, source: null, note: "Not calculated in this run", ref: null }
  if (f.value.kind === "missing") return { label, value: null, source: plainSource(f.source), note: missingNote, ref: f.source }
  const fromQuestionnaireTerm = f.claim.includes("no lease draft") ? "Uses the lease length from your questionnaire (no lease draft yet)" : null
  return { label, value: render(f.value), source: plainSource(f.source), note: fromQuestionnaireTerm, ref: f.source }
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
    costRow(
      c,
      "total_cost_over_term",
      termMonths ? `Total over the lease (${termMonths} months)` : "Total over the lease",
      moneyText,
      "Needs the lease length",
    ),
    exit,
    rentShareRow(c),
    costRow(
      c,
      "break_even_revenue",
      "Break-even revenue",
      (v) => (moneyText(v) ? `${moneyText(v)} per month` : null),
      "Needs your gross margin (questionnaire)",
    ),
    costRow(
      c,
      "payback_months",
      "Payback",
      (v) => (v.kind === "number" ? `${v.value} months` : v.kind === "none" ? "Never at the expected revenue" : null),
      "Needs your gross margin (questionnaire)",
    ),
  ]
}

function rentShareRow(c: CandidateDTO): CostRow {
  const label = "Rent share of revenue"
  const r = c.ranking?.rentShare
  if (!r)
    return {
      label,
      value: null,
      source: null,
      note: c.ranking ? "Needs the rent and your expected monthly revenue (questionnaire)" : "Not calculated in this run",
      ref: null,
    }
  const limit = `${Math.round(r.threshold * 100)}%`
  return {
    label,
    value: percent1(r.share),
    source: plainSource(r.source),
    note: r.aboveThreshold ? `Above ${limit} (SuiteSpot assumption): check before signing` : `Within ${limit} (SuiteSpot assumption)`,
    ref: r.source,
  }
}

export type PointItem = { text: string; hard: boolean; source: string | null }

/** Strengths and risks; hard flags first, then points to check before signing, then the Ranker's minus reasons. */
export function strengthsAndRisks(c: CandidateDTO): { strengths: PointItem[]; risks: PointItem[] } {
  const hardFlags = [...(c.rejection ? [c.rejection] : []), ...c.laterFlags]
  const risks: PointItem[] = [
    ...hardFlags.map((f) => ({ text: `Hard flag: ${f.reason}`, hard: true, source: plainSource(f.source) })),
    ...c.findings
      .filter((f) => f.severity === "soft")
      .map((f) => ({ text: f.checkBeforeSigning ? `Check before signing: ${f.checkBeforeSigning}` : f.claim, hard: false, source: plainSource(f.source) })),
    ...c.unverified.map((u) => ({ text: `The ${u.field} could not be verified from the text`, hard: false, source: "from the listing" })),
    ...(c.ranking?.reasons.filter((r) => r.effect === "minus").map((r) => ({ text: r.text, hard: false, source: plainSource(r.source) })) ?? []),
  ]
  const strengths =
    c.ranking?.reasons.filter((r) => r.effect === "plus").map((r) => ({ text: sentence(r.text) ?? r.text, hard: false, source: plainSource(r.source) })) ?? []
  return { strengths, risks }
}

/** Questions for the owner when there is no lease draft: one per term the calculations needed and did not have. */
export const LANDLORD_QUESTIONS = [
  { term: "lease length", question: "How long is the lease, and can it be renewed?" },
  { term: "early exit", question: "Can the tenant end the lease early, and with how many months' notice?" },
  { term: "indexation", question: "Is the rent indexed each year, and by what (inflation or a fixed percentage)?" },
  { term: "deposit", question: "How large is the deposit, and when is it returned?" },
  { term: "repairs", question: "Who pays for structural repairs?" },
  { term: "permitted use", question: "Does the lease allow your business activity in this space?" },
] as const

/** Questions when the terms come only from the listing form: what the form does not cover, and the draft itself. */
export const FORM_TERMS_QUESTIONS = [
  "Can you share the lease draft? Check that it says the same as the listing form.",
  "Is there a personal guarantee or a penalty for leaving early?",
] as const

export function leaseSection(c: CandidateDTO): { hasLease: boolean; fromForm: boolean; terms: { text: string; source: string }[]; questions: string[] } {
  const terms = c.findings.filter((f) => f.aspect === "lease" && f.severity === "info").map((f) => ({ text: f.claim, source: plainSource(f.source) }))
  if (c.hasLease && terms.length > 0) return { hasLease: true, fromForm: false, terms, questions: [] }
  const fromForm = !c.hasLease && terms.length > 0 && c.findings.some((f) => f.aspect === "lease" && f.severity === "info" && f.source.form)
  if (fromForm) return { hasLease: false, fromForm: true, terms, questions: [...FORM_TERMS_QUESTIONS] }
  return { hasLease: c.hasLease, fromForm: false, terms, questions: LANDLORD_QUESTIONS.map((q) => q.question) }
}

const COMPONENT_LABEL: Record<string, string> = {
  cost: "Monthly cost against your budget",
  area: "Area against your range",
  lease: "Lease terms",
  location: "Location",
  premises: "The space itself",
  checks: "Points to check before signing",
}
const COMPONENT_MISSING: Record<string, string> = {
  cost: "the rent is not stated",
  area: "the area is not stated",
  lease: "no verified lease terms",
  location: "no OpenStreetMap area data for this address in this run",
  premises: "the listing was not read",
  checks: "not known",
}

/** What lowers the confidence and by how much (points between the worst and the best case). */
export function unknowns(c: CandidateDTO): { items: { text: string; points: number }[]; totalPoints: number } {
  const ranking = c.ranking
  const items: { text: string; points: number }[] = []
  for (const component of ranking?.components ?? []) {
    if (component.value === null)
      items.push({ text: `${COMPONENT_LABEL[component.name] ?? component.name}: ${COMPONENT_MISSING[component.name] ?? "unknown"}`, points: component.weight })
    else if (component.valueHigh !== undefined && component.valueHigh > component.value) {
      const notStated = (c.premises?.notStated ?? []).map((f) => fieldLabel(f).toLowerCase())
      items.push({
        text: `${COMPONENT_LABEL[component.name] ?? component.name}: not stated in the listing or the lease${notStated.length ? ` (${notStated.join(", ")})` : ""}`,
        points: Math.round(component.weight * (component.valueHigh - component.value)),
      })
    }
  }
  for (const u of c.unverified) items.push({ text: `The ${u.field} could not be verified from the text (${u.reason})`, points: 0 })
  const monthly = findingOf(c, "monthly_cost")
  const unknownCosts = /unknown: (.+)$/.exec(monthly?.claim ?? "")?.[1]
  if (unknownCosts && unknownCosts !== "none") items.push({ text: `Not in the monthly cost: ${unknownCosts}`, points: 0 })
  const totalPoints = ranking ? ranking.scoreHigh - ranking.score : 0
  // The scores are rounded on their own, so one rounded item can read 7 against a 91-97 range: keep them consistent.
  const scored = items.filter((i) => i.points > 0)
  if (scored.length === 1) scored[0]!.points = totalPoints
  else for (const item of scored) item.points = Math.min(item.points, totalPoints)
  return { items: items.filter((i) => i.points > 0 || !scored.includes(i)), totalPoints }
}

/** Internal field names (form, extraction, lease clauses, questionnaire) in plain words. */
export const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  kind: "Rent or sale",
  city: "City",
  address: "Address",
  rentMonthly: "Monthly rent",
  area: "Area",
  areaM2: "Area",
  deposit: "Deposit",
  serviceChargeMonthly: "Monthly costs",
  floor: "Floor",
  heating: "Heating",
  parking: "Parking",
  storefront: "Storefront",
  kitchenVentilation: "Kitchen ventilation",
  waterAndDrain: "Water and drain",
  needsRenovation: "Renovation needed",
  stepFreeAccess: "Step-free access",
  url: "Listing address (URL)",
  minimumTermMonths: "Minimum lease term",
  earlyTermination: "Ending the lease early",
  "earlyTermination.noticeMonths": "Notice period",
  indexation: "Rent increases",
  "indexation.ratePercent": "Yearly rent increase",
  permittedUses: "Permitted use",
  tenantPaysStructuralRepairs: "Who pays structural repairs",
  term: "Lease term",
  tenantMayTerminateEarly: "Ending the lease early",
  noticePeriod: "Notice period",
  earlyExitPenalty: "Early exit penalty",
  indexationKind: "Rent increases",
  indexationRatePercent: "Yearly rent increase",
  personalGuarantee: "Personal guarantee",
  permittedUse: "Permitted use",
  businessType: "Type of business",
  monthlyBudget: "Monthly budget",
  expectedMonthlyRevenue: "Expected monthly revenue",
  grossMarginRate: "Gross margin",
  areaMinM2: "Minimum area",
  areaMaxM2: "Maximum area",
  leaseMonths: "Lease length",
  fitOutBudget: "Fit-out budget",
  equipmentBudget: "Equipment budget",
}

export const fieldLabel = (name: string): string => FIELD_LABEL[name] ?? name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())

export type SourceGroup = { title: string; items: string[] }

const GROUP_ORDER = [
  "Listing form",
  "Listing text",
  "Lease draft",
  "Your questionnaire",
  "Calculation",
  "SuiteSpot assumption",
  "OpenStreetMap",
  "Estimate",
] as const

function groupOf(s: SourceDTO): (typeof GROUP_ORDER)[number] {
  if (s.kind === "listing") return s.form ? "Listing form" : "Listing text"
  if (s.kind === "lease") return "Lease draft"
  if (s.kind === "profile") return "Your questionnaire"
  if (s.kind === "assumption") return "SuiteSpot assumption"
  if (s.kind === "osm") return "OpenStreetMap"
  if (s.kind === "estimate") return "Estimate"
  return "Calculation"
}

function sourceLine(s: SourceDTO): string {
  const name = s.field ?? s.clause
  if (s.kind === "calc" || s.kind === "estimate" || s.kind === "osm") return s.ref.charAt(0).toUpperCase() + s.ref.slice(1)
  const label = name ? fieldLabel(name) : s.ref
  if (s.missing) return `${label}: not stated`
  return s.quote ? `${label}: "${s.quote}"` : label
}

/** Every source behind this candidate, once each, grouped by where it comes from, in plain words. */
export function allSources(c: CandidateDTO): SourceGroup[] {
  const groups = new Map<string, Set<string>>()
  const add = (s: SourceDTO | undefined) => {
    if (!s) return
    const group = groupOf(s)
    if (!groups.has(group)) groups.set(group, new Set())
    groups.get(group)!.add(sourceLine(s))
    for (const input of s.inputs ?? []) add(input)
  }
  for (const field of Object.values(c.fields)) add(field.source)
  for (const f of c.findings) add(f.source)
  for (const r of c.ranking?.reasons ?? []) add(r.source)
  if (c.listingUrl) add(c.listingUrl.source)
  return GROUP_ORDER.filter((g) => groups.has(g)).map((title) => ({ title, items: [...groups.get(title)!] }))
}

const LOCATION_LABEL: Record<string, string> = {
  transit: "Bus and tram stops",
  offices: "Offices",
  schools: "Schools and faculties",
  parking: "Parking areas",
  food: "Cafes, restaurants and bars",
  shops: "Shops",
  crafts: "Workshops and crafts",
}

/** The Location card: OpenStreetMap counts (code), the Location analyst's explanation, and whether it was checked. */
export function locationSection(c: CandidateDTO): {
  rows: { label: string; count: number; source: SourceDTO }[]
  explanation: string | null
  zone: string | null
  checked: boolean
} {
  const rows = Object.keys(LOCATION_LABEL).flatMap((metric) => {
    const f = c.findings.find((x) => x.id === `${c.id}:location:${metric}`)
    return f?.value?.kind === "number" ? [{ label: LOCATION_LABEL[metric]!, count: f.value.value, source: f.source }] : []
  })
  const explanation = c.findings.find((x) => x.id === `${c.id}:location:explanation`)?.claim ?? null
  const zone = c.findings.find((x) => x.id === `${c.id}:location:zone`)?.claim ?? null
  return { rows, explanation, zone, checked: rows.length > 0 }
}

/**
 * The Premises card: what the listing and the lease draft state about the space (each line quoted, judged by code
 * for this type of business; a line that does not suit it is a soft flag with what to check before signing), and
 * what they do not mention. Never a hard flag.
 */
export function premisesSection(c: CandidateDTO): {
  read: boolean
  checks: { text: string; ok: boolean; checkBeforeSigning: string | null; source: string }[]
  notStated: string[]
  heating: { text: string; source: string } | null
} {
  const own = c.findings.filter((f) => f.aspect === "premises")
  // The quote is the evidence: shown next to where it comes from, so the user can find it in the listing.
  const quoted = (s: SourceDTO) => (s.quote ? `${plainSource(s)}: "${s.quote}"` : plainSource(s))
  const soft = own.filter((f) => f.severity === "soft")
  const heatingId = `${c.id}:premises:heating`
  const checks = own
    .filter((f) => f.severity === "info" && f.id !== heatingId)
    .map((f) => {
      const concern = soft.find((x) => x.claim === f.claim)
      return { text: f.claim, ok: !concern, checkBeforeSigning: concern?.checkBeforeSigning ?? null, source: quoted(f.source) }
    })
  const heating = own.find((f) => f.id === heatingId)
  return {
    read: c.premises !== null,
    checks,
    notStated: (c.premises?.notStated ?? []).map(fieldLabel),
    heating: heating ? { text: heating.claim, source: quoted(heating.source) } : null,
  }
}

export type YearScenarios = {
  /** If the business does not work out: what leaving after 12 months costs, with its parts. */
  bad: { total: string | null; complete: boolean; parts: { label: string; value: string; source: SourceDTO }[]; source: SourceDTO | null; note: string }
  /** If the business goes as planned: months until the initial costs are earned back, and the break-even revenue. */
  good: { payback: string | null; paybackSource: SourceDTO | null; breakEven: string | null; breakEvenSource: SourceDTO | null; note: string }
}

/** "Bad year, good year" from the Finance analyst's code-computed figures only; nothing new is calculated here. */
export function yearScenarios(c: CandidateDTO): YearScenarios | null {
  const exit = findingOf(c, "exit_cost_after_12_months")
  const payback = findingOf(c, "payback_months")
  const breakEven = findingOf(c, "break_even_revenue")
  if (!exit && !payback && !breakEven) return null
  const parts = c.findings
    .filter((f) => f.id.startsWith(`${c.id}:finance:exit_cost_part_`))
    .flatMap((f) => (f.value?.kind === "money" ? [{ label: f.claim, value: formatMoney(f.value.amount, f.value.currency), source: f.source }] : []))
  const exitTotal = moneyText(exit?.value)
  const known = findingOf(c, "exit_cost_known_part")
  const paybackText =
    payback?.value?.kind === "number" ? `${payback.value.value} months` : payback?.value?.kind === "none" ? "Never at your expected revenue" : null
  return {
    bad: {
      total: exitTotal ?? moneyText(known?.value),
      complete: exitTotal !== null,
      parts,
      source: exit?.value?.kind === "money" ? exit.source : (known?.source ?? null),
      note: exitTotal
        ? "Leaving after 12 months: rent during the notice period, any early exit penalty and the fit-out you have not used up. Whether the deposit comes back is not known."
        : known
          ? "Known part only: the lease terms (notice period) are needed for the full cost of leaving."
          : "Needs the lease terms (notice period).",
    },
    good: {
      payback: paybackText,
      paybackSource: payback?.value && payback.value.kind !== "missing" ? payback.source : null,
      breakEven: breakEven?.value?.kind === "money" ? `${formatMoney(breakEven.value.amount, breakEven.value.currency)} per month` : null,
      breakEvenSource: breakEven?.value?.kind === "money" ? breakEven.source : null,
      note: paybackText
        ? "At the revenue and gross margin from your questionnaire, the money you put in before opening (without the refundable deposit) is earned back after this many months."
        : "Needs your gross margin (questionnaire).",
    },
  }
}

// ---------------------------------------------------------------- charts (calculated values only)

export type ChartBar = { label: string; amount: number; currency: string; text: string; source: SourceDTO }

const calcBar = (label: string, value: ValueDTO | undefined | null, source: SourceDTO | undefined): ChartBar | null =>
  value?.kind === "money" && source?.kind === "calc"
    ? { label, amount: value.amount, currency: value.currency, text: formatMoney(value.amount, value.currency), source }
    : null

/**
 * "What the lease can cost you": moving in, leaving after 12 months and the whole lease, each a figure SuiteSpot's
 * lease calculator computed (source kind calc). A figure that was not calculated is named in missing, never drawn.
 */
export function costChart(c: CandidateDTO): { bars: ChartBar[]; missing: string[] } {
  const termMonths = /over (\d+) months/.exec(findingOf(c, "total_cost_over_term")?.claim ?? "")?.[1]
  const wanted = [
    { name: "initial_costs", label: "Moving in" },
    { name: "exit_cost_after_12_months", label: "Leaving after 12 months" },
    { name: "total_cost_over_term", label: termMonths ? `The whole lease (${termMonths} months)` : "The whole lease" },
  ]
  const bars: ChartBar[] = []
  const missing: string[] = []
  for (const w of wanted) {
    const f = findingOf(c, w.name)
    const bar = calcBar(w.label, f?.value, f?.source)
    if (bar && (bars.length === 0 || bar.currency === bars[0]!.currency)) bars.push(bar)
    else missing.push(w.label)
  }
  return { bars, missing }
}

/** Leasing against buying a similar space over the same years: both net costs come from the calculator (calc). */
export function leaseOrBuyChart(c: CandidateDTO): ChartBar[] {
  const r = c.leaseOrBuy
  if (!r || !r.known) return []
  const bars = [
    calcBar(`Leasing, ${r.years} years`, { kind: "money", ...r.leaseCost }, r.leaseCost.source),
    calcBar(`Buying, net over ${r.years} years`, { kind: "money", ...r.buyCost }, r.buyCost.source),
  ]
  return bars.every((b) => b !== null) && bars[0]!.currency === bars[1]!.currency ? (bars as ChartBar[]) : []
}
