import { ChevronDown, ChevronRight, OctagonAlert } from "lucide-react"
import { useState } from "react"
import { Link, paths } from "../app/router"
import type { ResearchState } from "../research-state"
import { SourceLabel, cx } from "../ui"
import { headline, resultsList, type DisplayVerdict, type ListEntry } from "./results-model"
import { VerdictDot, VerdictLegend } from "./VerdictDot"

/** The score as one big number, with the confidence label; the tooltip explains the worst case. */
export function ScoreBlock({
  score,
  confidence,
  note,
  size = "large",
}: {
  score: number | null
  confidence: string | null
  note: string | null
  size?: "large" | "medium"
}) {
  if (score === null) return <span className="text-[13px] text-ink-3">No score</span>
  return (
    <span className="flex flex-col items-end" title={note ?? undefined}>
      <span className={cx("tnum leading-none font-semibold text-ink", size === "large" ? "text-[34px]" : "text-[28px]")}>
        {score}
        <span className="ml-0.5 text-sm font-medium text-ink-3">/100</span>
      </span>
      {confidence && (
        <span tabIndex={0} className="mt-1.5 cursor-help text-xs font-medium text-ink-2 underline decoration-dotted underline-offset-2">
          {confidence}
        </span>
      )}
    </span>
  )
}

const LEGEND_ORDER: DisplayVerdict[] = ["good", "check_before_signing", "not_recommended", "cannot_judge"]

/** List tab: one sentence that answers the question, one small colour legend, then the cards, highest score first. */
export function ResultsList({ s, researchId }: { s: ResearchState; researchId: string }) {
  const { ranked, rejected } = resultsList(s)
  // the three colours always; grey only when a candidate in this run cannot be judged
  const legend = LEGEND_ORDER.filter((v) => v !== "cannot_judge" || ranked.some((e) => e.verdict === "cannot_judge"))
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[70ch] text-lg leading-7 font-semibold text-ink">{headline(s)}</p>
      <VerdictLegend verdicts={legend} />
      {/* The ranking puts the verdict before the score (src/domain/ranking.ts), so a higher score can sit lower. */}
      <p className="-mt-2 text-[13px] text-ink-2">Sorted by verdict, then by score.</p>
      <ol className="flex flex-col gap-3" aria-label="Candidates, best verdict first, then highest score">
        {ranked.map((entry, index) => (
          <li key={entry.candidate.id}>
            <CandidateCard researchId={researchId} entry={entry} position={index + 1} />
          </li>
        ))}
      </ol>
      {rejected.length > 0 && <RejectedBlock researchId={researchId} entries={rejected} />}
    </div>
  )
}

/**
 * Phone: rank, name and score in the first row, the main reason under them, then the cost.
 * Wider: rank | name and reason | cost | score. The rank circle's colour is the verdict.
 */
const CARD_LAYOUT =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-4 gap-y-3 [grid-template-areas:'rank_name_score'_'reason_reason_reason'_'meta_meta_meta'] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-x-6 sm:gap-y-1 sm:[grid-template-areas:'rank_name_meta_score'_'rank_reason_meta_score']"

function CandidateCard({ researchId, entry, position }: { researchId: string; entry: ListEntry; position: number }) {
  return (
    <Link to={paths.candidate(researchId, entry.candidate.id)} className={cx(CARD_LAYOUT, "group items-center rounded-[24px] glass-strong p-5 hover:bg-white")}>
      <span className="self-start [grid-area:rank] sm:self-center">
        <VerdictDot verdict={entry.verdict} rank={position} />
      </span>
      <span className="min-w-0 self-end [grid-area:name]">
        <span className="block text-base leading-6 font-semibold text-ink">{entry.name}</span>
        {entry.location && <span className="block truncate text-[13px] leading-5 text-ink-2">{entry.location}</span>}
      </span>
      <span className="block max-w-[70ch] self-start text-[13px] leading-5 text-ink-2 [grid-area:reason]">
        <span className="font-medium text-ink">Main reason: </span>
        {entry.mainReason}
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-2 [grid-area:meta] sm:flex-col sm:items-end">
        <span className="text-[13px] text-ink-2">
          {entry.monthlyCost ? (
            <>
              <span className="tnum font-semibold text-ink">{entry.monthlyCost}</span> per month
            </>
          ) : (
            "Monthly cost unknown"
          )}
        </span>
        {entry.rentShare && (
          <span className={cx("text-[13px]", entry.rentShare.aboveThreshold ? "text-amber-800" : "text-ink-2")}>
            <span className="tnum font-semibold">{entry.rentShare.text.split(" ")[0]}</span> {entry.rentShare.text.split(" ").slice(1).join(" ")}
            <SourceLabel source={entry.rentShare.source} />
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 self-start [grid-area:score] sm:self-center">
        <ScoreBlock score={entry.score} confidence={entry.confidence} note={entry.scoreRangeNote} />
        <ChevronRight size={18} className="hidden text-ink-3 group-hover:text-ink sm:block" aria-hidden />
      </span>
    </Link>
  )
}

function RejectedBlock({ researchId, entries }: { researchId: string; entries: ListEntry[] }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="glass rounded-[24px] px-5 py-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <OctagonAlert size={16} className="text-hard" aria-hidden />
          Rejected by a hard flag ({entries.length})
        </span>
        <ChevronDown size={18} className={cx("text-ink-2 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="mt-3 flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.candidate.id}>
              <Link
                to={paths.candidate(researchId, entry.candidate.id)}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[16px] px-3 py-2 text-[13px] hover:bg-white/70"
              >
                <span className="font-semibold text-ink">{entry.name}</span>
                <span className="max-w-[70ch] text-hard">{entry.mainReason}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
