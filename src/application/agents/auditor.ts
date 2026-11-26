import { SemanticEvent, SituationSpecification, createHuman, type Participant, type SituationContext } from "@mozaik-ai/core"
import { REPORT_SECTIONS, auditReport, type AuditProblem } from "../../domain/index.js"
import { safeHandler } from "../resilience/safe-handler.js"
import type { AppRuntime } from "../runtime.js"
import type { FinalReport, FinalSentence } from "../state.js"
import { REPORT_MAX_ATTEMPTS } from "./report-writer.js"

export const AUDITOR_NAME = "Auditor"

class WhenReportDrafted extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "report.drafted"
  }
}

/**
 * Auditor (plain code, no model). Decision, 26 Nov: no AI part. The report is written only from facts that code wrote
 * from the checked state, and every sentence must cite them; code can then check each number, each candidate and the
 * "never recommend a rejected candidate" rule exactly. A model check of wording would add cost and a new way to be
 * wrong without catching more invented numbers; the cited facts' source labels are shown next to every sentence, so a
 * reader can check the wording. On problems it sends them back once (report.audit_failed); on the second draft it
 * removes the failing sentences and marks them.
 */
export function createAuditor(rt: AppRuntime): Participant {
  let self: Participant
  let correctedOnFirst = 0

  const audit = (attempt: number) => {
    const id = self.getId()
    rt.sendEvent(SemanticEvent.create("audit.started", id, { attempt }), id)
    const state = rt.state
    const entry = state.reportDrafts.find((d) => d.attempt === attempt)!
    const ranked = [...state.rankings.values()].sort((a, b) => a.rank - b.rank).map((r) => r.candidateId)
    const rejected = [...state.candidates.values()].filter((c) => c.isRejected()).map((c) => c.id)
    const result = entry.draft
      ? auditReport(entry.draft, state.reportFacts, ranked, rejected)
      : { checked: 0, problems: [{ section: "recommendation", index: -1, message: entry.error ?? "no report" } as AuditProblem] }
    rt.sendEvent(SemanticEvent.create("audit.done", id, { attempt, checked: result.checked, problems: result.problems.length }), id)

    const last = attempt >= REPORT_MAX_ATTEMPTS || entry.providerError
    if (result.problems.length > 0 && !last) {
      correctedOnFirst = result.problems.length
      rt.sendEvent(SemanticEvent.create("report.audit_failed", id, { attempt, problems: result.problems }), id)
      return
    }
    // Final: keep what passed, remove and mark what did not.
    const draft = entry.draft
    const failing = (section: string, index: number) => result.problems.filter((p) => p.section === section && p.index === index)
    const sections = Object.fromEntries(
      REPORT_SECTIONS.map((section) => [
        section,
        (draft?.[section] ?? []).map((s, index): FinalSentence => {
          const bad = failing(section, index)
          return bad.length ? { text: s.text, facts: s.facts, status: "removed", note: `Removed by the Auditor: ${bad.map((b) => b.message).join("; ")}` } : { text: s.text, facts: s.facts, status: "ok" }
        }),
      ]),
    ) as unknown as FinalReport["sections"]
    const recommended = (draft?.recommended ?? []).filter((_, i) => failing("recommended", i).length === 0)
    const removed = Object.values(sections).flat().filter((s) => s.status === "removed").length + ((draft?.recommended.length ?? 0) - recommended.length)
    const report: FinalReport = {
      recommended,
      sections,
      audit: { checked: result.checked, corrected: correctedOnFirst, removed, attempts: attempt },
      ...(draft ? {} : { failed: `The report could not be written: ${entry.error ?? "no answer"}` }),
    }
    state.report = report
    rt.sendEvent(SemanticEvent.create("report.ready", id, { audit: report.audit, recommended, failed: report.failed ?? null }), id)
  }

  self = createHuman({
    name: AUDITOR_NAME,
    capabilities: ["audit"],
    handlers: [
      safeHandler({
        specification: new WhenReportDrafted(),
        processor: {
          apply({ event }) {
            if (rt.state.report) return
            audit((event.payload as { attempt: number }).attempt)
          },
        },
      }),
    ],
  })
  return self
}
