import { DomainError } from "./errors.js"
import { unsourcedNumbers } from "./number-check.js"
import { validateSource, type SourceRef } from "./source.js"

/**
 * The report is written by an AI agent from FACTS that code takes from the shared state. Each fact is one short
 * sentence written by code, with its source. The Report writer may only cite facts; the Auditor (plain code) checks
 * every sentence against the facts it cites. Nothing in the report is computed by the model.
 */
export type FactKind = "rank" | "reason" | "figure" | "check" | "rejected" | "unknown"

export type Fact = {
  readonly id: string
  readonly kind: FactKind
  readonly candidateId: string
  readonly text: string
  readonly source: SourceRef
}

export const REPORT_SECTIONS = ["recommendation", "checkBeforeSigning", "rejected", "unknowns"] as const
export type ReportSection = (typeof REPORT_SECTIONS)[number]

export type DraftSentence = { readonly text: string; readonly facts: readonly string[] }
export type ReportDraft = { readonly recommended: readonly string[] } & Record<ReportSection, readonly DraftSentence[]>

export type AuditProblem = { readonly section: ReportSection | "recommended"; readonly index: number; readonly message: string }

export type AuditResult = { readonly checked: number; readonly problems: readonly AuditProblem[] }

export function createFact(fact: Fact): Fact {
  if (!fact.id.trim() || !fact.text.trim()) throw new DomainError("invalid_input", "A fact needs an id and a text")
  return Object.freeze({ ...fact, source: validateSource(fact.source) })
}

/** Parses the Report writer's structured answer. Throws DomainError when it is not the expected shape. */
export function parseReportDraft(answer: unknown): ReportDraft {
  let raw: unknown = answer
  if (typeof answer === "string") {
    try {
      raw = JSON.parse(answer)
    } catch {
      throw new DomainError("invalid_extraction", "The report is not valid JSON")
    }
  }
  const r = raw as Record<string, unknown> | null
  if (!r || typeof r !== "object") throw new DomainError("invalid_extraction", "The report must be a JSON object")
  const sentences = (key: string): DraftSentence[] => {
    const v = r[key]
    if (!Array.isArray(v)) throw new DomainError("invalid_extraction", `The report needs a "${key}" list`)
    return v.map((s) => {
      const o = s as { text?: unknown; facts?: unknown }
      return { text: typeof o.text === "string" ? o.text.trim() : "", facts: Array.isArray(o.facts) ? o.facts.filter((f): f is string => typeof f === "string") : [] }
    })
  }
  const recommended = Array.isArray(r.recommended) ? r.recommended.filter((x): x is string => typeof x === "string") : []
  return {
    recommended,
    recommendation: sentences("recommendation"),
    checkBeforeSigning: sentences("checkBeforeSigning"),
    rejected: sentences("rejected"),
    unknowns: sentences("unknowns"),
  }
}

const CANDIDATE_ID = /\b(?:demo|pasted)-[a-z0-9]+\b/g

/**
 * The Auditor's rules (plain code):
 * - every cited fact exists;
 * - a sentence with a number or a candidate id cites at least one fact;
 * - every number in a sentence appears in the facts it cites (formatting and rounding allowed, small counts allowed);
 * - every candidate id in a sentence exists, and the recommendation never names a rejected candidate;
 * - the recommended list holds only ranked candidates from the top 3.
 */
export function auditReport(draft: ReportDraft, facts: readonly Fact[], ranked: readonly string[], rejected: readonly string[]): AuditResult {
  const byId = new Map(facts.map((f) => [f.id, f]))
  const known = new Set([...ranked, ...rejected])
  const top = new Set(ranked.slice(0, 3))
  const problems: AuditProblem[] = []
  let checked = 0

  draft.recommended.forEach((id, i) => {
    if (rejected.includes(id)) problems.push({ section: "recommended", index: i, message: `${id} was rejected by a hard flag and can never be recommended` })
    else if (!top.has(id)) problems.push({ section: "recommended", index: i, message: `${id} is not in the top 3 of the ranking` })
  })

  for (const section of REPORT_SECTIONS) {
    draft[section].forEach((s, index) => {
      checked++
      const fail = (message: string) => problems.push({ section, index, message })
      if (!s.text) return fail("the sentence is empty")
      const cited = s.facts.map((id) => byId.get(id))
      const missing = s.facts.filter((id, k) => !cited[k])
      if (missing.length) return fail(`cites facts that do not exist: ${missing.join(", ")}`)
      const ids = s.text.match(CANDIDATE_ID) ?? []
      const hasNumber = /\d/.test(s.text.replace(CANDIDATE_ID, ""))
      if ((hasNumber || ids.length) && s.facts.length === 0) return fail("states a number or names a candidate without citing a fact")
      const unknownIds = ids.filter((id) => !known.has(id))
      if (unknownIds.length) return fail(`names candidates that do not exist: ${unknownIds.join(", ")}`)
      if (section === "recommendation") {
        const bad = ids.filter((id) => rejected.includes(id))
        if (bad.length) return fail(`recommends ${bad.join(", ")}, which was rejected by a hard flag`)
      }
      const allowed = cited.flatMap((f) => (f ? numbersOf(f.text) : []))
      const invented = unsourcedNumbers(s.text.replace(CANDIDATE_ID, ""), allowed)
      if (invented.length) fail(`numbers not in the cited facts: ${invented.join(", ")}`)
    })
  }
  return { checked, problems }
}

/** Every number written in a fact (facts are written by code from sourced values). */
export function numbersOf(text: string): number[] {
  const out: number[] = []
  for (const m of text.replace(CANDIDATE_ID, "").matchAll(/\d+(?:[.,]\d+)*/g)) {
    const token = m[0]
    const asThousands = Number(token.replace(/[.,]/g, ""))
    const lastSep = Math.max(token.lastIndexOf("."), token.lastIndexOf(","))
    out.push(asThousands)
    if (lastSep > 0) out.push(Number(`${token.slice(0, lastSep).replace(/[.,]/g, "")}.${token.slice(lastSep + 1)}`))
  }
  return out.filter(Number.isFinite)
}
