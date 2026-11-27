import { OctagonAlert } from "lucide-react"
import { cx } from "../ui"
import { VERDICT_LABEL, VERDICT_MEANING, VERDICT_TONE, type DisplayVerdict, type VerdictTone } from "./results-model"

const TONE: Record<VerdictTone, string> = {
  good: "bg-green-700 text-white",
  check: "bg-amber-400 text-ink",
  bad: "bg-hard text-white",
  unknown: "bg-est-border text-white",
}

/**
 * The rank circle, coloured by the verdict (green good, yellow check before signing, red not recommended, grey
 * cannot judge). The colour is never the only signal: the tooltip and the accessible name say the verdict, and a
 * candidate stopped by a deal breaker keeps its icon instead of a number.
 */
export function VerdictDot({
  verdict,
  rank,
  rejected = false,
  size = "md",
}: {
  verdict: DisplayVerdict
  rank: number | null
  rejected?: boolean
  size?: "sm" | "md" | "lg"
}) {
  const label = `${rejected ? "Rejected by a deal breaker" : rank !== null ? `Rank ${rank}` : "Not ranked"}: ${VERDICT_LABEL[verdict]}`
  const box = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-sm"
  return (
    <span
      role="img"
      aria-label={label}
      title={`${label}. ${VERDICT_MEANING[verdict]}.`}
      className={cx(
        "tnum inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        box,
        rejected ? "bg-hard-50 text-hard" : TONE[VERDICT_TONE[verdict]],
      )}
    >
      {rejected ? <OctagonAlert size={size === "lg" ? 22 : 18} aria-hidden /> : rank}
    </span>
  )
}

/** The one small legend above the list (and on How it works): what each colour of the rank circle means. */
export function VerdictLegend({ verdicts, className }: { verdicts: DisplayVerdict[]; className?: string }) {
  return (
    <ul className={cx("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2", className)} aria-label="What the colour of the rank circle means">
      {verdicts.map((v) => (
        <li key={v} className="inline-flex items-center gap-1.5" title={VERDICT_MEANING[v]}>
          <span className={cx("h-2.5 w-2.5 rounded-full", TONE[VERDICT_TONE[v]])} aria-hidden />
          {VERDICT_LABEL[v]}
        </li>
      ))}
    </ul>
  )
}
