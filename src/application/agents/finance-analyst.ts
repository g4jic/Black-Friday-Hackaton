import {
  Agent,
  SemanticEvent,
  SituationSpecification,
  createAgent,
  type SituationContext,
  type StructuredOutputFormat,
  type Tool,
} from "@mozaik-ai/core"
import {
  AreaM2,
  Money,
  breakEvenRevenue,
  budgetExceeded,
  calc,
  costShareOfRevenue,
  exitCostAfter,
  initialCosts,
  isExitCostIncomplete,
  isMissingData,
  leaseTermsFor,
  monthlyCost,
  paybackMonths,
  rentPerM2,
  totalCostOverTerm,
  unsourcedNumbers,
  type CostBreakdown,
  type LeaseClauses,
  type SourceRef,
  type Sourced,
} from "../../domain/index.js"
import { CandidateCancellation, STOPPED_PREFIX, cancellableTool, cancellationReporter, rejectCandidate } from "../cancellation/candidate-cancellation.js"
import { INFERENCE_FAILED_PREFIX } from "../resilience/resilient-runner.js"
import { safeHandler } from "../resilience/safe-handler.js"
import type { AppRuntime } from "../runtime.js"
import { strictObject } from "./quoted-schema.js"

export const FINANCE_NAME = "Finance analyst"
export const FINANCE_MAX_ATTEMPTS = 2

const FIRST_STEP = ["monthly_cost", "initial_costs", "rent_per_m2"] as const
const LEASE_STEP = ["total_cost_over_term", "exit_cost_after_12_months", "cost_share_of_revenue", "break_even_revenue", "payback_months"] as const
export const CALCULATIONS = [...FIRST_STEP, ...LEASE_STEP] as const
export type CalculationName = (typeof CALCULATIONS)[number]
const NEEDS_LEASE = new Set<string>(LEASE_STEP)

export const FINANCE_INSTRUCTION = [
  "You are the Finance analyst of SuiteSpot. For one candidate space you answer: is this lease a good financial decision for this business?",
  "You never compute numbers yourself: the calculate tool runs SuiteSpot's lease cost calculator in code and returns every figure with its source.",
  "Call at most one tool per turn. Wait for its result before the next call.",
  `Step 1: call calculate with ${FIRST_STEP.join(", ")}.`,
  `Step 2: call calculate with ${LEASE_STEP.join(", ")} (these wait for the lease terms when there is a lease draft).`,
  "Then answer with a short explanation (at most 120 words) for the business owner: the monthly cost, the cost over the term, the exit cost,",
  "the share of expected revenue, and what is missing. Use only numbers the tool returned, written exactly as returned.",
  "Write 'missing data' where the tool says so. This is not financial or legal advice: never say whether to sign.",
].join(" ")

/** The calculate tool's parameters, also checked by the schema rules test like any structured output. */
export const CALCULATE_TOOL_SCHEMA: StructuredOutputFormat = {
  name: "calculate_parameters",
  strict: true,
  schema: strictObject({ calculations: { type: "array", description: "the calculations to run", items: { type: "string", enum: [...CALCULATIONS] } } }),
}

export const FINANCE_EXPLANATION_SCHEMA: StructuredOutputFormat = {
  name: "finance_explanation",
  strict: true,
  schema: strictObject({ explanation: { type: "string", description: "short explanation using only numbers the calculate tool returned" } }),
}

const money = (m: Money) => `${m.amount.toFixed(2)} ${m.currency}`
const formula = (s: SourceRef) => `[${s.kind}: ${s.ref}]`

class WhenCandidateFound extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "candidate.found"
  }
}

class WhenOwnLoopEvent extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.producerId === participant.getId() && event.type === "model.answer"
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("aborted"))
  return new Promise<T>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
    promise.then(resolve, reject)
  })
}

export type FinanceOptions = { model: string }

/**
 * Finance analyst: one AI loop per candidate. The model only picks which calculations to run and explains them;
 * every number comes from the domain calculator through the calculate tool, enters state as a sourced finding, and
 * the explanation is rejected if it contains a number the tool never returned. The term-level calculations wait
 * for the Lease reader (shared state), so when the lease turns out to be a deal breaker this loop is still running
 * and gets cut at its breakpoint.
 */
export function createFinanceAnalyst(rt: AppRuntime, options: FinanceOptions): Agent {
  /** Numbers this agent was given per candidate (tool results, listing, profile, lease): the only ones it may write. */
  const allowed = new Map<string, Set<number>>()
  const allow = (candidateId: string, ...values: (number | null | undefined)[]) => {
    const set = allowed.get(candidateId) ?? new Set<number>()
    for (const v of values) if (typeof v === "number" && Number.isFinite(v)) set.add(v)
    allowed.set(candidateId, set)
  }
  const allowBreakdown = (candidateId: string, b: CostBreakdown) => allow(candidateId, b.total.value.amount, ...b.lines.map((l) => l.amount.value.amount))

  /** note: set for term-level figures that could not use verified lease terms (they carry questionnaire sources). */
  const record = (candidateId: string, name: string, claim: string, value: unknown, source: SourceRef, note: string | null) =>
    rt.state.addFinding({
      id: `${candidateId}:finance:${name}`,
      candidateId,
      aspect: "finance",
      severity: "info",
      claim: note ? `${claim} (${note})` : claim,
      value,
      source,
      author: FINANCE_NAME,
      ...(note ? { checkBeforeSigning: "the lease term, notice, indexation and deposit: these figures do not use verified lease terms" } : {}),
    })

  async function runCalculations(agentId: string, candidateId: string, names: readonly CalculationName[], signal: AbortSignal): Promise<string> {
    const profile = rt.state.requireProfile()
    const candidate = rt.state.candidate(candidateId)
    let lease: LeaseClauses | null = rt.state.leaseClauses.get(candidateId) ?? null
    if (!lease && names.some((n) => NEEDS_LEASE.has(n)) && rt.state.hasLease(candidateId)) {
      lease = await abortable(rt.state.waitForLease(candidateId), signal) // waits for the Lease reader
    }
    // The user cancelled the run (possibly while this call waited for the lease): record nothing.
    if (rt.state.runStop) return `Not executed: ${rt.state.runStop.reason}`
    const terms = leaseTermsFor(candidate.listing, profile, lease)
    if (isMissingData(terms)) return "missing data: the listing does not state the rent, so nothing can be computed"
    // Never let a questionnaire value look like a lease term: say where the term came from.
    const leaseNote = !lease
      ? rt.state.hasLease(candidateId)
        ? "lease not verified: term from the questionnaire"
        : "no lease draft: term from the questionnaire"
      : isMissingData(lease.term)
          ? "lease term not verified: term from the questionnaire"
          : null
    const rec = (name: CalculationName, claim: string, value: unknown, source: SourceRef) =>
      record(candidateId, name, claim, value, source, NEEDS_LEASE.has(name) ? leaseNote : null)

    allow(candidateId, ...Object.values(profile.input).filter((v): v is number => typeof v === "number"), terms.termMonths.value, terms.noticeMonths?.value, terms.indexationRatePerYear?.value)
    const lines: string[] = []
    const monthly = monthlyCost(terms)
    const revenue = profile.money("expectedMonthlyRevenue")
    const margin = profile.grossMarginRate()
    for (const name of names) {
      switch (name) {
        case "monthly_cost": {
          allowBreakdown(candidateId, monthly)
          rec(name, `Monthly cost ${monthly.total.value}${monthly.unknowns.length ? `; unknown: ${monthly.unknowns.join(", ")}` : ""}`, monthly.total, monthly.total.source)
          lines.push(`monthly_cost = ${money(monthly.total.value)} ${formula(monthly.total.source)} = ${monthly.lines.map((l) => `${l.label} ${money(l.amount.value)}`).join(" + ")}; unknown: ${monthly.unknowns.join(", ") || "none"}`)
          const flag = budgetExceeded(monthly.total, profile.money("monthlyBudget"), FINANCE_NAME)
          if (flag) {
            rejectCandidate(rt, candidateId, flag, agentId)
            lines.push(`HARD FLAG (decided by code): ${flag.reason}`)
          }
          break
        }
        case "initial_costs": {
          const b = initialCosts(terms)
          allowBreakdown(candidateId, b)
          rec(name, `Initial costs ${b.total.value}`, b.total, b.total.source)
          lines.push(`initial_costs = ${money(b.total.value)} ${formula(b.total.source)} = ${b.lines.map((l) => `${l.label} ${money(l.amount.value)}`).join(" + ")}; unknown: ${b.unknowns.join(", ") || "none"}`)
          break
        }
        case "rent_per_m2": {
          const area = candidate.listing.area
          if (isMissingData(area)) {
            lines.push("rent_per_m2 = missing data (the listing does not state the area)")
            break
          }
          const r = rentPerM2(terms.rentMonthly, area as Sourced<AreaM2>)
          allow(candidateId, r.value, area.value.value)
          rec(name, `Rent per m2 ${r.value} ${terms.currency}`, r, r.source)
          lines.push(`rent_per_m2 = ${r.value} ${terms.currency}/m2 ${formula(r.source)}`)
          break
        }
        case "total_cost_over_term": {
          const b = totalCostOverTerm(terms)
          allowBreakdown(candidateId, b)
          rec(name, `Total cost over ${terms.termMonths.value} months ${b.total.value}`, b.total, b.total.source)
          lines.push(`total_cost_over_term = ${money(b.total.value)} over ${terms.termMonths.value} months ${formula(b.total.source)}; unknown: ${b.unknowns.join(", ") || "none"}`)
          break
        }
        case "exit_cost_after_12_months": {
          const b = exitCostAfter(terms, 12)
          if (isExitCostIncomplete(b)) {
            // No notice period: the known part (unrecovered fit-out) is never shown as the whole exit cost.
            const known = b.knownPart
            allowBreakdown(candidateId, known)
            rec(name, "Exit cost after 12 months: needs lease terms (notice period unknown)", b, known.total.source)
            known.lines.forEach((l, i) => record(candidateId, `exit_cost_part_${i + 1}`, l.label, l.amount, l.amount.source, null))
            record(candidateId, "exit_cost_known_part", `Known part of the exit cost after 12 months ${known.total.value} (${known.lines.map((l) => l.label.toLowerCase()).join(" + ")})`, known.total, known.total.source, null)
            lines.push(`exit_cost_after_12_months = needs lease terms (notice period unknown); known part ${money(known.total.value)} = ${known.lines.map((l) => `${l.label} ${money(l.amount.value)}`).join(" + ")}`)
            break
          }
          allowBreakdown(candidateId, b)
          rec(name, `Exit cost after 12 months ${b.total.value}`, b.total, b.total.source)
          // The parts of the exit cost, for the "bad year" scenario on the candidate page (state only, not sent to the model).
          b.lines.forEach((l, i) => record(candidateId, `exit_cost_part_${i + 1}`, l.label, l.amount, l.amount.source, null))
          lines.push(`exit_cost_after_12_months = ${money(b.total.value)} ${formula(b.total.source)} = ${b.lines.map((l) => `${l.label} ${money(l.amount.value)}`).join(" + ")}; unknown: ${b.unknowns.join(", ") || "none"}`)
          break
        }
        case "cost_share_of_revenue": {
          const share = costShareOfRevenue(monthly.total, revenue)
          const pct = Math.round(share.value * 1000) / 10
          allow(candidateId, share.value, pct)
          rec(name, `Space costs ${pct}% of expected revenue`, share, share.source)
          lines.push(`cost_share_of_revenue = ${pct}% ${formula(share.source)}`)
          break
        }
        case "break_even_revenue": {
          const be = breakEvenRevenue(monthly.total, margin)
          if (isMissingData(be)) {
            rec(name, "Break-even revenue: missing data (gross margin not given)", be, { kind: "profile", ref: "questionnaire", field: "grossMarginRate" })
            lines.push("break_even_revenue = missing data (the gross margin was not given in the questionnaire)")
            break
          }
          allow(candidateId, be.value.amount)
          rec(name, `Break-even revenue ${be.value}`, be, be.source)
          lines.push(`break_even_revenue = ${money(be.value)} per month ${formula(be.source)}`)
          break
        }
        case "payback_months": {
          const initial = initialCosts(terms).total
          const nonRefundable = terms.deposit ? calc(initial.value.subtract(terms.deposit.value), "initial costs - refundable deposit", [initial, terms.deposit]) : initial
          const p = paybackMonths(nonRefundable, revenue, margin, monthly.total)
          if (isMissingData(p)) {
            rec(name, "Payback: missing data (gross margin not given)", p, { kind: "profile", ref: "questionnaire", field: "grossMarginRate" })
            lines.push("payback_months = missing data (the gross margin was not given in the questionnaire)")
            break
          }
          allow(candidateId, p.value)
          rec(name, p.value === null ? "Never pays back at the expected revenue" : `Pays back in ${p.value} months`, p, p.source)
          lines.push(`payback_months = ${p.value ?? "never"} ${formula(p.source)}`)
          break
        }
      }
    }
    const noteLine = names.some((n) => NEEDS_LEASE.has(n)) && leaseNote ? [`NOTE: ${leaseNote}`] : []
    return [...noteLine, ...lines].join("\n")
  }

  const startAnalysis = (agent: Agent, candidateId: string, attempt: number, feedback?: string) => {
    const candidate = rt.state.candidate(candidateId)
    const key = `finance:${candidateId}:${attempt}`
    const onStop = cancellationReporter(rt, candidateId, key, agent.getId(), FINANCE_NAME)
    const calculate: Tool = cancellableTool(
      {
        type: "function",
        name: "calculate",
        description: `Runs SuiteSpot's lease cost calculator (code) for this candidate. Allowed: ${CALCULATIONS.join(", ")}.`,
        parameters: CALCULATE_TOOL_SCHEMA.schema,
        strict: true,
      },
      candidate,
      FINANCE_NAME,
      async (args: { calculations?: string[] }, signal) => {
        const names = (args.calculations ?? []).filter((n): n is CalculationName => (CALCULATIONS as readonly string[]).includes(n))
        if (names.length === 0) throw new Error(`Name at least one calculation: ${CALCULATIONS.join(", ")}`)
        return runCalculations(agent.getId(), candidateId, names, signal)
      },
      onStop,
    )
    const message = [
      `Candidate id: ${candidateId}`,
      `Listing: ${candidate.listing.ref}${rt.state.hasLease(candidateId) ? " (a lease draft exists; the Lease reader is reading it)" : rt.state.leaseClauses.has(candidateId) ? " (no lease draft; the lease terms come from the listing form)" : " (no lease draft)"}`,
      ...(feedback ? ["", `Your previous explanation was rejected: ${feedback}`, "Use only numbers the tool returned, exactly as returned."] : []),
    ].join("\n")
    rt.startLoop({
      agent,
      key,
      candidateId,
      message,
      model: options.model,
      tools: [calculate],
      structuredOutput: FINANCE_EXPLANATION_SCHEMA,
      maxOutputTokens: 1024,
      interception: new CandidateCancellation(candidate, FINANCE_NAME, onStop),
    })
  }

  const onAnswer = (agent: Agent, candidateId: string, attempt: number, text: string) => {
    const agentId = agent.getId()
    if (text.startsWith(STOPPED_PREFIX)) return // cancelled: the result never arrives, by design
    if (text.startsWith(INFERENCE_FAILED_PREFIX)) {
      rt.sendEvent(SemanticEvent.create("finance.failed", agentId, { candidateId, reason: text }), agentId)
      return
    }
    let explanation = ""
    try {
      explanation = String((JSON.parse(text) as { explanation?: unknown }).explanation ?? "").trim()
    } catch {
      explanation = ""
    }
    const unsourced = explanation ? unsourcedNumbers(explanation, [...(allowed.get(candidateId) ?? [])]) : []
    const problem = !explanation ? "the answer is not the JSON object {explanation}" : unsourced.length ? `numbers without a source: ${unsourced.join(", ")}` : null
    if (problem) {
      if (attempt < FINANCE_MAX_ATTEMPTS && !rt.state.candidate(candidateId).isRejected()) {
        rt.sendEvent(SemanticEvent.create("finance.explanation_rejected", agentId, { candidateId, attempt, reason: problem }), agentId)
        startAnalysis(agent, candidateId, attempt + 1, problem)
      } else rt.sendEvent(SemanticEvent.create("finance.failed", agentId, { candidateId, reason: problem }), agentId)
      return
    }
    const inputs = rt.state.findings.filter((f) => f.candidateId === candidateId && f.author === FINANCE_NAME).map((f) => f.source)
    rt.state.addFinding({
      id: `${candidateId}:finance:explanation`,
      candidateId,
      aspect: "finance",
      severity: "info",
      claim: explanation,
      source: { kind: "calc", ref: "Finance analyst explanation of the calculator results", inputs: inputs.length ? inputs : [{ kind: "profile", ref: "questionnaire", field: "monthlyBudget" }] },
      author: FINANCE_NAME,
    })
    rt.sendEvent(SemanticEvent.create("finance.explained", agentId, { candidateId, explanation }), agentId)
  }

  return createAgent({
    name: FINANCE_NAME,
    capabilities: ["inference"],
    instruction: FINANCE_INSTRUCTION,
    tools: [],
    handlers: [
      safeHandler({
        specification: new WhenCandidateFound(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const { candidateId } = event.payload as { candidateId: string }
            const candidate = rt.state.candidate(candidateId)
            if (candidate.isRejected()) return
            if (candidate.status === "pending") candidate.startEvaluation()
            const listing = candidate.listing
            allow(candidateId, ...[listing.rentMonthly, listing.deposit, listing.serviceChargeMonthly].map((f) => (isMissingData(f) ? null : f.value.amount)), isMissingData(listing.area) ? null : listing.area.value.value)
            startAnalysis(participant, candidateId, 1) // fire and forget: runs next to the Lease reader
          },
        },
      }),
      safeHandler({
        specification: new WhenOwnLoopEvent(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const loop = rt.loopForEvent(event)
            const m = loop ? /^finance:(.+):(\d+)$/.exec(loop.key) : null
            if (!m) return
            const { answer } = event.payload as { answer: { content: { text: string } } }
            onAnswer(participant, m[1]!, Number(m[2]), answer.content.text)
          },
        },
      }),
    ],
  })
}
