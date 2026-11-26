import { Check, CircleStop, OctagonAlert } from "lucide-react"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { cancelResearch, useResearch, type RunSnapshot } from "../app/research-store"
import { navigate, paths } from "../app/router"
import { ResearchMissing } from "../pages/ResearchPage"
import { agentIcon, cx } from "../ui"
import { CODE_PARTICIPANTS, ORBIT_AGENTS, agentNodes, candidateChips, runCounters, statusLine, type AgentNode, type CandidateChip, type CandidatePhase } from "./run-view-model"

/**
 * Geometry, as shares of the stage's half width. Agents sit on the outer ring (0.9); candidates on an inner band
 * (0.56 to 0.62) that their labels (at most 140 px wide) never leave, so an agent label passing by on the turning ring cannot touch a
 * chip, and chips never reach the centre disc (radius 0.3). Candidates move inward a little as they progress.
 */
const PHASE_RADIUS: Record<CandidatePhase, number> = { reading: 0.62, found: 0.6, evaluating: 0.58, done: 0.56, rejected: 1.15, failed: 1.15 }
const AGENT_RING_RADIUS = 0.9
/**
 * The first chip sits at the top. With evenly spaced slots no two chips then sit side by side near the top or the
 * bottom, where wide labels would touch.
 */
const chipTurn = (turn: number) => turn - 0.25
/** Slow and calm: one turn in 90 s while agents work. */
const DEGREES_PER_SECOND = 4

export function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)"
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setReduced(media.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])
  return reduced
}

/**
 * The research run (/research/:id/run): agents on a slowly turning orbit, candidates moving inward as they are
 * evaluated, a live status line. Everything on screen comes from the run's SSE events. When the run ends the orbit
 * settles and the page moves on to the results.
 */
export function RunView({ researchId }: { researchId: string }) {
  const snapshot = useResearch(researchId)
  const reducedMotion = usePrefersReducedMotion()
  const [leaving, setLeaving] = useState(false)
  const settledAt = useRef<number | null>(null)
  const done = snapshot.state.done

  // Opened for a run that had already finished (for example from a link): go straight to the results.
  const finishedOnArrival = useRef(done)
  useEffect(() => {
    if (finishedOnArrival.current) navigate(paths.results(researchId), { replace: true })
  }, [researchId])

  const onSettled = () => {
    if (settledAt.current !== null) return
    settledAt.current = Date.now()
    window.setTimeout(() => setLeaving(true), reducedMotion ? 900 : 500)
    window.setTimeout(() => navigate(paths.results(researchId), { replace: true }), reducedMotion ? 900 : 900)
  }

  // Reduced motion has no orbit to settle: move on shortly after the end.
  useEffect(() => {
    if (done && reducedMotion && !finishedOnArrival.current) onSettled()
  })

  if (snapshot.status === "missing") return <ResearchMissing />

  return (
    <div className={cx("flex flex-col gap-4", leaving && !reducedMotion && "run-leave")}>
      <section className="glass overflow-hidden rounded-[28px] px-4 py-6 sm:px-8" aria-label="Research run">
        {reducedMotion ? <StaticProgress snapshot={snapshot} /> : <Orbit snapshot={snapshot} onSettled={onSettled} />}
        <RunFooter snapshot={snapshot} />
      </section>
      <LeftTheOrbit chips={candidateChips(snapshot.state)} />
    </div>
  )
}

function Orbit({ snapshot, onSettled }: { snapshot: RunSnapshot; onSettled: () => void }) {
  const { state } = snapshot
  const ringRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(state.done)
  doneRef.current = state.done
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  // Rotation from requestAnimationFrame: transform only, no React render per frame. When the run ends the speed
  // eases out to zero, then the orbit reports that it has settled.
  useEffect(() => {
    let angle = 0
    let speed = DEGREES_PER_SECOND
    let last = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const seconds = Math.min(0.1, (now - last) / 1000)
      last = now
      if (doneRef.current) speed *= Math.exp(-seconds * 3.2)
      angle = (angle + speed * seconds) % 360
      ringRef.current?.style.setProperty("--orbit-angle", `${angle.toFixed(3)}deg`)
      if (doneRef.current && speed < 0.05) {
        onSettledRef.current()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const nodes = agentNodes(state)
  const chips = candidateChips(state)
  const status = statusLine(state)

  return (
    <div className="orbit-stage" role="img" aria-label={`Agents at work. ${status}`}>
      {/* static rings */}
      <div className="absolute inset-[5.5%] rounded-full border border-white/70" aria-hidden />
      <div className="absolute inset-[24%] rounded-full border border-dashed border-ink/10" aria-hidden />
      {/* turning layer: comet arc and the agents */}
      <div ref={ringRef} className="orbit-ring-layer" aria-hidden>
        <div className="orbit-comet" />
        {nodes.map((node) => (
          <OrbitNode key={node.name} node={node} done={state.done} />
        ))}
      </div>
      {/* candidates do not turn: they only move inward (or out of the orbit) */}
      {chips.map((chip) => (
        <OrbitChip key={chip.id} chip={chip} slots={chips.length} />
      ))}
      <CentreStatus status={status} done={state.done} cancelled={state.cancelled} />
      {/* on a phone the centre is too small for the sentence: it goes under the orbit */}
      <p key={status} className="status-enter absolute inset-x-0 -bottom-10 text-center text-sm font-medium text-ink sm:hidden">
        {status}
      </p>
    </div>
  )
}

function OrbitNode({ node, done }: { node: AgentNode; done: boolean }) {
  const Icon = agentIcon(node.name)
  const busy = node.running > 0 && !done
  const style = { "--turn": node.slot / ORBIT_AGENTS.length - 0.25, "--radius": AGENT_RING_RADIUS } as CSSProperties
  return (
    <div className="orbit-polar z-20" style={style}>
      <div className="orbit-upright">
        <div className="orbit-node-enter flex flex-col items-center gap-1">
          <div className="relative">
            <span className="orbit-glow" data-busy={busy} />
            {/* one-shot work (the Ranker) flashes once per event that showed it at work */}
            {node.name === "Ranker" && <span key={node.lastActiveSeq} className="orbit-flash absolute -inset-2 rounded-full bg-brand/40" />}
            <span
              className={cx(
                "relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-300",
                busy ? "border-brand bg-white text-ink" : "glass-strong border-white text-ink-2",
              )}
            >
              <Icon size={19} strokeWidth={1.75} aria-hidden />
            </span>
            {node.running > 1 && !done && (
              <span className="tnum absolute -top-1.5 -right-2 rounded-full bg-ink px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white">×{node.running}</span>
            )}
          </div>
          <span className="flex flex-col items-center max-sm:hidden">
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap text-ink">{node.name}</span>
            {CODE_PARTICIPANTS.has(node.name) && <span className="mt-0.5 text-[10px] leading-3 font-medium tracking-[0.04em] text-ink-3 uppercase">code</span>}
          </span>
        </div>
      </div>
    </div>
  )
}

const CHIP_STYLE: Record<CandidatePhase, string> = {
  reading: "border-dashed border-ink/20 bg-white/50 text-ink-2",
  found: "border-white bg-white/80 text-ink",
  evaluating: "border-brand/60 bg-white text-ink",
  done: "border-white bg-white text-ink shadow-[var(--shadow-soft)]",
  rejected: "border-hard bg-hard-50 text-hard",
  failed: "border-ink/20 bg-white/60 text-ink-2",
}

function OrbitChip({ chip, slots }: { chip: CandidateChip; slots: number }) {
  const style = { "--turn": chipTurn(chip.turn), "--radius": PHASE_RADIUS[chip.phase] } as CSSProperties
  const leaving = chip.phase === "rejected" || chip.phase === "failed"
  return (
    <div className="orbit-polar orbit-chip z-10" data-phase={chip.phase} style={style} title={chip.reason ?? `${chip.label}: ${PHASE_LABEL[chip.phase]}`}>
      <span className={cx("relative inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium whitespace-nowrap", CHIP_STYLE[chip.phase])}>
        {leaving && chip.phase === "rejected" && <span className="orbit-pulse absolute inset-0 rounded-full bg-hard" aria-hidden />}
        {chip.phase === "rejected" && <OctagonAlert size={12} aria-hidden className="relative" />}
        <span className="chip-full tnum relative max-w-[104px] truncate">{chip.label}</span>
        <span className="chip-short tnum relative">{Math.round(chip.turn * slots) + 1}</span>
        {chip.rank !== null && <span className="tnum relative rounded-full bg-ink px-1.5 text-[10px] leading-4 text-white">#{chip.rank}</span>}
      </span>
    </div>
  )
}

function CentreStatus({ status, done, cancelled }: { status: string; done: boolean; cancelled: boolean }) {
  return (
    <div className="absolute inset-[35%] flex items-center justify-center p-[5%] text-center">
      {/* calm breathing while the agents work: its own layer, so the text never scales */}
      <span className={cx("absolute inset-0 rounded-full glass-strong", !done && "orbit-breathe")} aria-hidden />
      <div aria-live="polite" className="relative flex flex-col items-center gap-2">
        <span className={cx("inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase", done ? "text-green-700" : "text-ink-2")}>
          {done ? (
            cancelled ? (
              <>
                <CircleStop size={13} aria-hidden /> Stopped
              </>
            ) : (
              <>
                <Check size={13} aria-hidden /> Done
              </>
            )
          ) : (
            <>
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand" aria-hidden /> Working
            </>
          )}
        </span>
        <p key={status} className="status-enter text-[clamp(12px,2.4cqw,15px)] leading-snug font-medium text-ink max-sm:hidden">
          {status}
        </p>
      </div>
    </div>
  )
}

function RunFooter({ snapshot }: { snapshot: RunSnapshot }) {
  const counters = runCounters(snapshot.state)
  const [cancelState, setCancelState] = useState<"idle" | "sending" | "sent" | "failed">("idle")
  const done = snapshot.state.done
  const cancel = async () => {
    setCancelState("sending")
    try {
      await cancelResearch(snapshot.researchId)
      setCancelState("sent")
    } catch {
      setCancelState("failed")
    }
  }
  return (
    <div className="mt-14 flex flex-wrap items-center justify-center gap-3 sm:mt-6">
      <Counter label="candidates evaluated" value={`${counters.evaluated} of ${counters.total}`} />
      <Counter label="rejected by a hard flag" value={String(counters.rejected)} tone={counters.rejected > 0 ? "hard" : undefined} />
      <Counter label="agents in parallel now" value={String(counters.runningNow)} detail={counters.peak > 0 ? `peak ${counters.peak}` : undefined} />
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={done || cancelState === "sending" || cancelState === "sent"}
        className="inline-flex h-10 items-center gap-2 rounded-full glass-strong px-[18px] text-sm font-medium text-ink hover:bg-white disabled:opacity-50"
      >
        <CircleStop size={16} aria-hidden />
        {cancelState === "sending" || (cancelState === "sent" && !done) ? "Stopping..." : "Cancel"}
      </button>
      {cancelState === "failed" && (
        <span role="alert" className="text-[13px] text-hard">
          Could not cancel. The run may have just finished.
        </span>
      )}
    </div>
  )
}

function Counter({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "hard" }) {
  return (
    <div className="flex min-w-[150px] flex-col items-center rounded-[20px] glass-strong px-4 py-2.5">
      <span className={cx("tnum text-xl leading-7 font-semibold", tone === "hard" ? "text-hard" : "text-ink")}>
        {value}
        {detail && <span className="ml-1.5 text-xs font-medium text-ink-3">{detail}</span>}
      </span>
      <span className="text-xs text-ink-2">{label}</span>
    </div>
  )
}

/**
 * Candidates that left the orbit, each with its one-line reason. Shown from the start with its space reserved
 * (three rows), so nothing jumps when the first hard flag arrives.
 */
function LeftTheOrbit({ chips }: { chips: CandidateChip[] }) {
  const gone = chips.filter((c) => c.phase === "rejected" || c.phase === "failed")
  return (
    <section className="glass min-h-[132px] rounded-[28px] px-6 py-4" aria-label="Candidates that left the orbit">
      <h2 className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Left the orbit</h2>
      {gone.length === 0 ? (
        <p className="text-[13px] text-ink-2">No candidate rejected so far. A hard flag takes a candidate out of the orbit and lists it here.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-[13px]">
          {gone.map((chip) => (
            <li key={chip.id} className="status-enter flex flex-wrap items-center gap-2">
              <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", chip.phase === "rejected" ? "bg-hard-50 text-hard" : "bg-white text-ink-2")}>
                {chip.phase === "rejected" && <OctagonAlert size={12} aria-hidden />}
                {chip.label}
              </span>
              <span className={chip.phase === "rejected" ? "text-hard" : "text-ink-2"}>{chip.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const PHASE_LABEL: Record<CandidatePhase, string> = { reading: "being read", found: "waiting for the evaluators", evaluating: "being evaluated", done: "evaluated", rejected: "rejected", failed: "could not be read" }

/** Reduced motion: the same facts as a static progress list. */
function StaticProgress({ snapshot }: { snapshot: RunSnapshot }) {
  const { state } = snapshot
  const nodes = agentNodes(state)
  const chips = candidateChips(state)
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <p aria-live="polite" className="text-base font-medium text-ink">
          {statusLine(state)}
        </p>
      </div>
      <div>
        <h2 className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Agents</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {nodes.map((node) => {
            const Icon = agentIcon(node.name)
            return (
              <li key={node.name} className="flex items-center gap-2">
                <Icon size={16} aria-hidden />
                <span className="font-medium text-ink">{node.name}</span>
                <span className="text-ink-2">{node.running > 0 && !state.done ? `working (${node.running})` : "done"}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <div>
        <h2 className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Candidates</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {chips.map((chip) => (
            <li key={chip.id} className="flex items-center gap-2">
              <span className="tnum font-medium text-ink">{chip.label}</span>
              <span className={chip.phase === "rejected" ? "text-hard" : "text-ink-2"}>{PHASE_LABEL[chip.phase]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
