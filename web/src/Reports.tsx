import { Info, ShieldCheck } from "lucide-react"
import type { ResearchState } from "./research-state"
import type { ReportSentenceDTO } from "./types"
import { Pill, SourceLabel, cx } from "./ui"

const SECTIONS: { key: "recommendation" | "checkBeforeSigning" | "rejected" | "unknowns"; title: string }[] = [
  { key: "recommendation", title: "Recommendation" },
  { key: "checkBeforeSigning", title: "Check before signing" },
  { key: "rejected", title: "Why these were rejected" },
  { key: "unknowns", title: "What we do not know" },
]

const NOT_ADVICE = "Not financial or legal advice. SuiteSpot shows numbers with their sources; the decision is yours."

/** The audited report (DESIGN.md 6.11): every sentence with the source labels of the facts it cites. */
export function ReportsScreen({ s }: { s: ResearchState }) {
  const r = s.report
  return (
    <div className="flex flex-col gap-4">
      <p className="inline-flex items-center gap-2 self-start rounded-full glass-strong px-4 py-2 text-[13px] text-ink-2">
        <Info size={16} className="text-ink" aria-hidden /> {NOT_ADVICE}
      </p>
      {!s.id ? (
        <Card title="Report">Run a research under New research; the report appears here when the agents are done.</Card>
      ) : !r ? (
        <Card title="Report">
          {Object.values(s.loops).some((l) => l.agent === "Report writer") ? "The Report writer is writing; the Auditor checks every number before it is shown." : "The report is written when every candidate has been ranked."}
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-2 rounded-full bg-ink px-3.5 text-[13px] font-medium text-white">
              <ShieldCheck size={16} aria-hidden /> Audited: {r.audit.checked} claims checked, {r.audit.corrected} corrected
              {r.audit.removed > 0 ? `, ${r.audit.removed} removed` : ""}
            </span>
            <Pill icon={false} title="The Auditor is plain code: it checks every number and candidate against the facts each sentence cites">
              checked by code, not by a model
            </Pill>
            {r.recommended.map((id, i) => {
              const c = s.candidates[id]
              return (
                <Pill key={id} variant="brand" icon={false} title="Recommended to look at first (from the ranking)">
                  {i + 1}. {id}
                  {c?.ranking ? ` · ${c.ranking.scoreHigh > c.ranking.score ? `${c.ranking.score}-${c.ranking.scoreHigh}` : c.ranking.score}` : ""}
                </Pill>
              )
            })}
          </div>
          {r.failed && <Card title="Report">{r.failed}</Card>}
          <div className="grid gap-4 lg:grid-cols-2">
            {SECTIONS.map(({ key, title }) => (
              <Card key={key} title={title}>
                {r.sections[key].length === 0 ? (
                  <p className="text-ink-3">Nothing here.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {r.sections[key].map((sentence, i) => (
                      <Sentence key={i} sentence={sentence} />
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Sentence({ sentence }: { sentence: ReportSentenceDTO }) {
  const removed = sentence.status === "removed"
  return (
    <li className={cx("leading-6", removed ? "text-ink-3" : "text-ink")}>
      <span className={cx(removed && "line-through")}>{sentence.text}</span>
      {sentence.facts.map((f) => (
        <SourceLabel key={f.id} source={{ ...f.source, ref: `${f.source.ref}\nfact ${f.id}: ${f.text}` }} />
      ))}
      {removed && (
        <div className="mt-1">
          <Pill variant="soft" title={sentence.note}>
            {sentence.note}
          </Pill>
        </div>
      )}
    </li>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-[28px] p-6 text-sm text-ink-2">
      <h2 className="title-pill mb-4 inline-flex rounded-full glass-strong px-3.5 py-1.5 text-lg leading-6 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}
