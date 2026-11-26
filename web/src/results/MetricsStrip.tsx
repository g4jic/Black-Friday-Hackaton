import type { ResearchState } from "../research-state"
import { Pill } from "../ui"

/** "Under the hood": run metrics computed from runtime events (Timeline tab). */
export function MetricsStrip({ s }: { s: ResearchState }) {
  const m = s.metrics
  if (!m) return null
  const items = [
    `done in ${(m.durationMs / 1000).toFixed(1)} s`,
    `${m.loops} loops`,
    `peak ${m.peakParallel} in parallel`,
    `${m.toolCalls} calculator calls`,
    `${m.rejected} rejected`,
    `${m.loopsCancelled} loop${m.loopsCancelled === 1 ? "" : "s"} cancelled`,
    `${m.softFlags} soft flag${m.softFlags === 1 ? "" : "s"}`,
    ...(m.costUsd !== null ? [`${m.tokens.input + m.tokens.output} tokens`, `$${m.costUsd.toFixed(4)}`] : ["keyless, $0"]),
  ]
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Run metrics, computed from runtime events">
      {items.map((t) => (
        <Pill key={t} icon={false}>
          {t}
        </Pill>
      ))}
    </div>
  )
}
