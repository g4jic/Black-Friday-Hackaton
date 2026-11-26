import { X } from "lucide-react"
import type { LoopView, ResearchState } from "./research-state"
import { AGENTS, Pill, agentIcon, cx } from "./ui"

const LANE_H = 28
const LABEL_W = 200

/**
 * Agent lanes over time (DESIGN.md 6.10). One lane per loop, grouped by agent. Everything is drawn from events:
 * a bar from loop.started to loop.answered, a dot per tool call (its waiting time as a darker segment), a red x
 * where loop.cancelled landed, and a dashed line where a candidate was rejected.
 */
export function Timeline({ s, now }: { s: ResearchState; now: number }) {
  const loops = Object.values(s.loops)
  const end = s.done ? s.lastAt : Math.max(now, s.lastAt)
  const span = Math.max(4000, Math.ceil((end + 400) / 1000) * 1000)
  const x = (t: number) => `${(Math.min(t, span) / span) * 100}%`
  const w = (a: number, b: number) => `${(Math.max(0, Math.min(b, span) - a) / span) * 100}%`
  const ticks = Array.from({ length: Math.floor(span / 1000) + 1 }, (_, i) => i * 1000)
  const busyNow = loops.filter((l) => l.end === undefined).length
  const groups = AGENTS.map((a) => ({ agent: a.name, loops: loops.filter((l) => l.agent === a.name).sort((p, q) => p.start - q.start) })).filter((g) => g.loops.length)
  const rejections = Object.values(s.rejections)

  return (
    <section className="surface rounded-[24px] px-6 pt-5 pb-6" aria-label="Timeline: agent loops over time">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-white px-3.5 py-1.5 text-lg leading-6 font-semibold shadow-[var(--shadow-soft)]">Agent loops over time</span>
        <Pill variant="brand" icon={false}>
          peak {s.peak} loops in parallel
        </Pill>
        {!s.done && (
          <Pill icon={false}>
            {busyNow} busy now
          </Pill>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-4 text-xs text-ink-2">
          <Legend kind="bar" /> loop running
          <Legend kind="tool" /> calculator call
          <Legend kind="cut" /> cancelled by a hard flag
          <Legend kind="reject" /> candidate rejected
        </span>
      </div>

      {loops.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-2">Waiting for the first agent to start.</p>
      ) : (
        <div className="relative">
          {/* rejection labels get their own row, so they never cover the time axis */}
          <div className="relative mb-1 h-6" style={{ marginLeft: LABEL_W }}>
            {rejections.map((r) => (
              <span key={r.candidateId} className="absolute top-0 -translate-x-1/2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-white" style={{ left: x(r.at) }}>
                {r.candidateId} rejected
              </span>
            ))}
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
                <span key={r.candidateId} className="absolute inset-y-0 z-10 border-l border-dashed border-red-600" style={{ left: x(r.at) }} />
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
                    <Lane key={l.key} l={l} now={end} x={x} w={w} />
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

function Lane({ l, now, x, w }: { l: LoopView; now: number; x: (t: number) => string; w: (a: number, b: number) => string }) {
  const [, candidate, attempt] = l.key.split(":")
  const stop = l.end ?? now
  const cut = l.cancelledAt !== undefined
  return (
    <div className="flex items-center" style={{ height: LANE_H }}>
      <div className="flex shrink-0 items-center gap-1.5 truncate pr-3 text-[13px] text-ink" style={{ width: LABEL_W }} title={l.key}>
        <span className="tnum">{candidate}</span>
        {attempt && attempt !== "1" && <span className="text-ink-3">try {attempt}</span>}
        {cut && <span className="text-xs font-medium text-red-700">cut</span>}
      </div>
      <div className="relative h-full flex-1">
        <div
          className={cx(
            "absolute top-1/2 h-4 -translate-y-1/2 rounded-full border-l-2",
            cut ? "border-red-600 bg-red-50" : "border-purple-600 bg-purple-100",
          )}
          style={{ left: x(l.start), width: w(l.start, stop) }}
          title={`${l.agent} on ${candidate}: ${l.start} ms to ${l.end ?? "now"}${cut ? `, cancelled ${l.cancelWhere} at ${l.cancelledAt} ms` : ""}`}
        />
        {l.end === undefined && (
          // still running: a small pulsing dot at the growing end of the bar
          <span className="ring-busy absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600" style={{ left: x(stop) }} />
        )}
        {l.tools.map((t, i) => (
          <span key={i}>
            <span
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-purple-600/30"
              style={{ left: x(t.at), width: w(t.at, t.end ?? stop) }}
              title={`${t.name}: ${t.at} ms to ${t.end ?? "now"}`}
            />
            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-purple-600" style={{ left: x(t.at) }} />
          </span>
        ))}
        {cut && (
          <span
            className="absolute top-1/2 z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-white shadow-[var(--shadow-soft)]"
            style={{ left: x(l.cancelledAt!) }}
            title={`Cancelled ${l.cancelWhere} at ${l.cancelledAt} ms`}
          >
            <X size={12} strokeWidth={3} />
          </span>
        )}
      </div>
    </div>
  )
}

function Legend({ kind }: { kind: "bar" | "tool" | "cut" | "reject" }) {
  if (kind === "bar") return <span className="inline-block h-3 w-6 rounded-full border-l-2 border-purple-600 bg-purple-100" />
  if (kind === "tool") return <span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-600" />
  if (kind === "cut")
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white">
        <X size={10} strokeWidth={3} />
      </span>
    )
  return <span className="inline-block h-3 border-l border-dashed border-red-600" />
}
