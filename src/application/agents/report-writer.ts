import { Agent, SemanticEvent, SituationSpecification, createAgent, type SituationContext, type StructuredOutputFormat } from "@mozaik-ai/core"
import { createFact, parseReportDraft, isMissingData, type Fact, type FactKind, type Money, type SourceRef, type Sourced } from "../../domain/index.js"
import { INFERENCE_FAILED_PREFIX } from "../resilience/resilient-runner.js"
import { safeHandler } from "../resilience/safe-handler.js"
import type { AppRuntime } from "../runtime.js"
import type { SuiteSpotState } from "../state.js"
import { strictObject } from "./quoted-schema.js"

export const REPORT_WRITER_NAME = "Report writer"
export const REPORT_MAX_ATTEMPTS = 2

const sentenceList = (what: string) => ({
  type: "array",
  description: what,
  items: strictObject({ text: { type: "string", description: "one sentence" }, facts: { type: "array", description: "ids of the facts this sentence is based on", items: { type: "string" } } }),
})

/** The Report writer's structured output. No unions, no optional fields (schema-rules.ts). */
export const REPORT_SCHEMA: StructuredOutputFormat = {
  name: "lease_report",
  strict: true,
  schema: strictObject({
    recommended: { type: "array", description: "candidate ids you recommend looking at first, at most 3, best first", items: { type: "string" } },
    recommendation: sentenceList("the top 3 candidates with their reasons"),
    checkBeforeSigning: sentenceList("what to check before signing"),
    rejected: sentenceList("why each rejected candidate was rejected"),
    unknowns: sentenceList("what SuiteSpot does not know"),
  }),
}

export const REPORT_WRITER_INSTRUCTION = [
  "You are the Report writer of SuiteSpot. You write a short report for a small business owner who is choosing a commercial space to rent.",
  "You get a numbered list of FACTS written by SuiteSpot's code from its checked data. Use only these facts.",
  "Every sentence lists the ids of the facts it is based on. Copy every number exactly as it is written in those facts; never compute, round or convert.",
  "Sections: recommended (up to 3 candidate ids, in rank order, never a rejected one), recommendation (one or two sentences per recommended candidate with its main reasons),",
  "checkBeforeSigning (the most important points to check), rejected (why each rejected candidate was rejected), unknowns (what is not known and lowers the confidence).",
  "Plain English, no advice to sign or not: the decision is the owner's. Keep it short. You have no tools. Answer only with the JSON object.",
].join(" ")

const fmtMoney = (m: Money) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(m.amount)} ${m.currency}`

/** Writes the facts the Report writer may use: short sentences from the shared state, each with its source. */
export function buildFacts(state: SuiteSpotState): Fact[] {
  const facts: Fact[] = []
  const add = (kind: FactKind, candidateId: string, text: string, source: SourceRef) => facts.push(createFact({ id: `F${facts.length + 1}`, kind, candidateId, text, source }))
  const ranked = [...state.rankings.values()].sort((a, b) => a.rank - b.rank)
  const titleOf = (id: string) => {
    const t = state.candidate(id).listing.title
    return isMissingData(t) ? id : `"${String(t.value)}"`
  }
  for (const r of ranked) {
    const id = r.candidateId
    const range = r.scoreHigh > r.score ? `${r.score}-${r.scoreHigh}` : `${r.score}`
    const inputs = r.reasons.map((x) => x.source)
    add("rank", id, `${id} (${titleOf(id)}) is ranked #${r.rank} of ${ranked.length} with a score of ${range} out of 100, confidence ${r.confidence}.`, { kind: "calc", ref: "Ranker score (RANKING_ASSUMPTIONS)", inputs })
    for (const reason of r.reasons) add(reason.effect === "confidence" || reason.effect === "order" ? "unknown" : "reason", id, `${id}: ${reason.text}.`, reason.source)
    const finding = (name: string) => state.findings.find((f) => f.id === `${id}:finance:${name}`)
    const monthly = finding("monthly_cost")
    if (monthly?.value && !isMissingData(monthly.value)) add("figure", id, `${id}: monthly cost ${fmtMoney((monthly.value as Sourced<Money>).value)}.`, monthly.source)
    const share = finding("cost_share_of_revenue")
    if (share?.value && !isMissingData(share.value)) add("figure", id, `${id}: the space costs ${Math.round((share.value as Sourced<number>).value * 1000) / 10}% of the expected monthly revenue.`, share.source)
    const exit = finding("exit_cost_after_12_months")
    if (exit?.value && !isMissingData(exit.value)) add("figure", id, `${id}: leaving after 12 months costs ${fmtMoney((exit.value as Sourced<Money>).value)}${exit.claim.includes("(") ? ` ${exit.claim.slice(exit.claim.indexOf("("))}` : ""}.`, exit.source)
    for (const f of state.findings.filter((x) => x.candidateId === id && x.severity === "soft")) {
      add("check", id, `${id}: ${f.claim}${f.checkBeforeSigning ? `; check ${f.checkBeforeSigning}` : ""}.`, f.source)
    }
    for (const u of state.candidate(id).listing.unverified) {
      add("unknown", id, `${id}: the ${u.field} could not be verified from the listing text.`, { kind: "listing", ref: state.candidate(id).listing.ref, field: u.field, missing: true })
    }
  }
  for (const c of [...state.candidates.values()].filter((x) => x.isRejected())) {
    const flag = c.rejection!
    add("rejected", c.id, `${c.id} (${titleOf(c.id)}) was rejected by a hard flag: ${flag.reason} (raised by ${flag.raisedBy}).`, flag.source)
    for (const later of c.laterFlags) add("rejected", c.id, `${c.id}: also a hard flag: ${later.reason}.`, later.source)
  }
  return facts
}

export function reportMessage(state: SuiteSpotState, facts: readonly Fact[], feedback?: string): string {
  const ranked = [...state.rankings.values()].sort((a, b) => a.rank - b.rank).map((r) => r.candidateId)
  const rejected = [...state.candidates.values()].filter((c) => c.isRejected()).map((c) => c.id)
  const lines = [
    `Ranking (best first): ${ranked.join(", ") || "none"}. Rejected (never recommend): ${rejected.join(", ") || "none"}.`,
    "FACTS:",
    ...facts.map((f) => `${f.id} [${f.kind}] ${f.text}`),
  ]
  if (feedback) lines.push("", `The Auditor rejected parts of your previous report: ${feedback}`, "Fix every problem: cite the right facts and copy their numbers exactly.")
  return lines.join("\n")
}

class WhenRankingDone extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === "ranking.done" && event.producerId !== participant.getId()
  }
}
class WhenAuditFailed extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === "report.audit_failed" && event.producerId !== participant.getId()
  }
}
class WhenOwnAnswer extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === "model.answer" && event.producerId === participant.getId()
  }
}

export type ReportWriterOptions = { model: string }

/**
 * Report writer (AI): wakes on ranking.done, writes the report from the facts as structured output, and rewrites it
 * once when the Auditor sends problems back (report.audit_failed). It never computes a number.
 */
export function createReportWriter(rt: AppRuntime, options: ReportWriterOptions): Agent {
  const start = (agent: Agent, attempt: number, feedback?: string) => {
    rt.startLoop({
      agent,
      key: `report:all:${attempt}`,
      message: reportMessage(rt.state, rt.state.reportFacts, feedback),
      model: options.model,
      tools: [],
      structuredOutput: REPORT_SCHEMA,
      maxOutputTokens: 2500,
    })
  }
  return createAgent({
    name: REPORT_WRITER_NAME,
    capabilities: ["inference"],
    instruction: REPORT_WRITER_INSTRUCTION,
    tools: [],
    handlers: [
      safeHandler({
        specification: new WhenRankingDone(),
        processor: {
          apply({ participant }) {
            if (!(participant instanceof Agent) || rt.state.reportFacts.length > 0 || rt.state.report) return
            rt.state.reportFacts = buildFacts(rt.state)
            start(participant, 1)
          },
        },
      }),
      safeHandler({
        specification: new WhenAuditFailed(),
        processor: {
          apply({ event, participant }) {
            if (!(participant instanceof Agent)) return
            const { attempt, problems } = event.payload as { attempt: number; problems: { section: string; index: number; message: string }[] }
            if (attempt >= REPORT_MAX_ATTEMPTS) return
            start(participant, attempt + 1, problems.map((p) => `${p.section}${p.index >= 0 ? ` #${p.index + 1}` : ""}: ${p.message}`).join("; "))
          },
        },
      }),
      safeHandler({
        specification: new WhenOwnAnswer(),
        processor: {
          apply({ event, participant }) {
            const loop = rt.loopForEvent(event)
            const m = loop ? /^report:all:(\d+)$/.exec(loop.key) : null
            if (!m) return
            const attempt = Number(m[1])
            const text = (event.payload as { answer: { content: { text: string } } }).answer.content.text
            if (text.startsWith(INFERENCE_FAILED_PREFIX)) {
              rt.state.reportDrafts.push({ attempt, draft: null, error: `Provider error: ${text.slice(INFERENCE_FAILED_PREFIX.length).trim()}`, providerError: true })
            } else {
              try {
                rt.state.reportDrafts.push({ attempt, draft: parseReportDraft(text) })
              } catch (error) {
                rt.state.reportDrafts.push({ attempt, draft: null, error: (error as Error).message })
              }
            }
            const id = participant.getId()
            rt.sendEvent(SemanticEvent.create("report.drafted", id, { attempt, ok: rt.state.reportDrafts.at(-1)!.draft !== null }), id)
          },
        },
      }),
    ],
  })
}
