import { OctagonAlert, X } from "lucide-react"
import type { LoopView, Rejection, ResearchState } from "./research-state"
import { candidateLabel } from "./run/run-view-model"
import { AGENTS, Pill, agentIcon, cx } from "./ui"

const LANE_H = 28
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const LABEL_W = 200
/** About how much of the time axis one "Hard flag: <name> rejected" label covers. */
const FLAG_LABEL_SHARE = 0.3

/** Hard flag labels in rows, so two rejections close in time never cover each other (earliest first). */
function labelRows(rejections: readonly Rejection[], span: number): { rows: number; placed: { r: Rejection; row: number }[] } {
  const lastInRow: number[] = []
  const placed = [...rejections]
    .sort((a, b) => a.at - b.at)
    .map((r) => {
      const share = Math.min(r.at, span) / span
      let row = lastInRow.findIndex((last) => share - last >= FLAG_LABEL_SHARE)
      if (row < 0) row = lastInRow.length
      lastInRow[row] = share
      return { r, row }
    })
  return { rows: Math.max(1, lastInRow.length), placed }
}

/**
 * "How your research ran" (DESIGN.md 6.10): one lane per piece of work, grouped by agent. Everything is drawn from events:
 * a bar from loop.started to loop.answered, a dot per tool call (its waiting time as a darker segment), a red x
 * where loop.cancelled landed, and a dashed line where a candidate was rejected.
 */
export function Timeline({ s, now }: { s: ResearchState; now: number }) {
  // Loops of AI agents, plus the Auditor's plain-code audits (a short span each).
  const loops = [...Object.values(s.loops), ...Object.values(s.spans)]
  const end = s.done ? s.lastAt : Math.max(now, s.lastAt)
  const span = Math.max(4000, Math.ceil((end + 400) / 1000) * 1000)
  const x = (t: number) => `${(Math.min(t, span) / span) * 100}%`
  const w = (a: number, b: number) => `${(Math.max(0, Math.min(b, span) - a) / span) * 100}%`
  const ticks = Array.from({ length: Math.floor(span / 1000) + 1 }, (_, i) => i * 1000)
  const busyNow = loops.filter((l) => l.end === undefined).length
  const groups = AGENTS.map((a) => ({ agent: a.name, loops: loops.filter((l) => l.agent === a.name).sort((p, q) => p.start - q.start) })).filter((g) => g.loops.length)
  const rejections = Object.values(s.rejections)

  return (
    <section className="glass rounded-[28px] px-6 pt-5 pb-6" aria-label="How your research ran">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center title-pill rounded-full glass-strong px-3.5 py-1.5 text-lg leading-6 font-semibold">How your research ran</span>
        <Pill variant="brand" icon={false}>
          up to {s.peak} agents working at once
        </Pill>
        {!s.done && (
          <Pill icon={false}>
            {busyNow} working now
          </Pill>
        )}
        {s.done && s.metrics && <Pill icon={false}>done in {sec(s.metrics.durationMs)}</Pill>}
        {s.done && rejections.length > 0 && (
          <Pill variant="hard" icon={false}>
            {rejections.length} {rejections.length === 1 ? "space" : "spaces"} ruled out early
          </Pill>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-4 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5"><Legend kind="bar" /> an agent working on a space</span>
          <span className="inline-flex items-center gap-1.5"><Legend kind="tool" /> a calculation</span>
          <span className="inline-flex items-center gap-1.5"><Legend kind="cut" /> stopped early by a deal breaker</span>
          <span className="inline-flex items-center gap-1.5"><Legend kind="reject" /> space ruled out</span>
        </span>
      </div>

      {loops.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-2">Waiting for the first agent to start.</p>
      ) : (
        <div className="relative">
          {/* rejection labels get their own row, so they never cover the time axis */}
          <div className="relative mb-1" style={{ marginLeft: LABEL_W, height: labelRows(rejections, span).rows * 24 }}>
            {labelRows(rejections, span).placed.map(({ r, row }) => {
              const share = Math.min(r.at, span) / span
              return (
                <span
                  key={r.candidateId}
                  className={cx("absolute inline-flex items-center gap-1 rounded-full bg-hard px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-white", share > 0.7 && "-translate-x-full")}
                  style={{ left: x(r.at), top: row * 24 }}
                >
                  <OctagonAlert size={12} strokeWidth={2} aria-hidden /> Deal breaker: {candidateLabel(s, r.candidateId)} ruled out
                </span>
              )
            })}
          </div>
          {/* time axis */}
          <div className="relative mb-1 h-5" style={{ marginLeft: LABEL_W }}>
            {ticks.map((t) => (
              <span key={t} className="tnum absolute -translate-x-1/2 text-xs font-medium text-ink-3" style={{ left: x(t) }}>
                {t / 1000}s
              </span>
            ))}
          </div>
          <div className="relative">
            {/* grid lines, rejection lines and the "now" line sit behind and above the lanes */}
            <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: LABEL_W }}>
              {ticks.map((t) => (
                <span key={t} className="absolute inset-y-0 w-px bg-ink/5" style={{ left: x(t) }} />
              ))}
              {rejections.map((r) => (
                <span key={r.candidateId} className="absolute inset-y-0 z-10 border-l border-dashed border-hard" style={{ left: x(r.at) }} />
              ))}
              {!s.done && <span className="absolute inset-y-0 z-10 w-px bg-ink" style={{ left: x(now) }} aria-label="now" />}
            </div>

            {groups.map((g) => {
              const Icon = agentIcon(g.agent)
              return (
                <div key={g.agent} className="mb-3 last:mb-0">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium text-ink-2" style={{ width: LABEL_W }}>
                    <Icon size={14} strokeWidth={1.75} /> {g.agent}
                  </div>
                  {g.loops.map((l) => (
                    <Lane key={l.key} l={l} now={end} x={x} w={w} label={(id) => candidateLabel(s, id)} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function Lane({ l, now, x, w, label }: { l: LoopView; now: number; x: (t: number) => string; w: (a: number, b: number) => string; label: (candidateId: string) => string }) {
  const [, candidateId = "", attempt] = l.key.split(":")
  const candidate = label(candidateId)
  const stop = l.end ?? now
  const cut = l.cancelledAt !== undefined
  return (
    <div className="flex items-center" style={{ height: LANE_H }}>
      <div className="flex shrink-0 items-center gap-1.5 truncate pr-3 text-[13px] text-ink" style={{ width: LABEL_W }} title={candidate}>
        <span className="tnum">{candidate}</span>
        {attempt && attempt !== "1" && <span className="text-ink-3">try {attempt}</span>}
        {cut && <span className="text-xs font-medium text-hard">stopped</span>}
      </div>
      <div className="relative h-full flex-1">
        <div
          className={cx(
            "absolute top-1/2 h-4 -translate-y-1/2 rounded-full border-l-2",
            cut ? "border-hard bg-hard/25" : "border-lilac-600 bg-lilac/60",
          )}
          style={{ left: x(l.start), width: w(l.start, stop), minWidth: 8 }}
          title={`${l.agent} on ${candidate}: ${sec(l.start)} to ${l.end === undefined ? "now" : sec(l.end)}${cut ? `, stopped at ${sec(l.cancelledAt!)} by a deal breaker` : ""}`}
        />
        {l.end === undefined && (
          // still running: a small pulsing dot at the growing end of the bar
          <span className="ring-busy absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" style={{ left: x(stop) }} />
        )}
        {l.tools.map((t, i) => (
          <span key={i}>
            <span
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-brand/35"
              style={{ left: x(t.at), width: w(t.at, t.end ?? stop) }}
              title={`A calculation: ${sec(t.at)} to ${t.end === undefined ? "now" : sec(t.end)}`}
            />
            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand" style={{ left: x(t.at) }} />
          </span>
        ))}
        {cut && (
          <span
            className="absolute top-1/2 z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-hard text-white shadow-[var(--shadow-soft)]"
            style={{ left: x(l.cancelledAt!) }}
            title={`Stopped at ${sec(l.cancelledAt!)} by a deal breaker found for this space`}
          >
            <X size={12} strokeWidth={3} />
          </span>
        )}
      </div>
    </div>
  )
}

function Legend({ kind }: { kind: "bar" | "tool" | "cut" | "reject" }) {
  if (kind === "bar") return <span className="inline-block h-3 w-6 rounded-full border-l-2 border-lilac-600 bg-lilac/60" />
  if (kind === "tool") return <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" />
  if (kind === "cut")
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-hard text-white">
        <X size={10} strokeWidth={3} />
      </span>
    )
  return <span className="inline-block h-3 border-l border-dashed border-hard" />
}
