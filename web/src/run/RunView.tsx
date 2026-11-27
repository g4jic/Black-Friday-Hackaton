import { Check, CircleStop, OctagonAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cancelResearch, useResearch, type RunSnapshot } from "../app/research-store"
import { navigate, paths } from "../app/router"
import { ResearchMissing } from "../pages/ResearchPage"
import { agentIcon, cx } from "../ui"
import { ORBIT_AGENTS, agentNodes, candidateChips, runCounters, statusLine, type CandidateChip, type CandidatePhase, type OrbitAgentName } from "./run-view-model"

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

/**
 * How each agent moves on the path: its own speed, how far it drifts in and out, how fast it breathes. All agents are
 * on the path from the start; an agent at work moves at full speed and glows, an idle one drifts slowly and fades.
 */
type Character = { speed: number; drift: number; driftHz: number; pulse: number; pulseHz: number }
const CHARACTER: Record<OrbitAgentName, Character> = {
  Scout: { speed: 1.5, drift: 0.035, driftHz: 0.9, pulse: 0.04, pulseHz: 1.6 }, // quick and restless
  "Finance analyst": { speed: 0.9, drift: 0.01, driftHz: 0.25, pulse: 0.03, pulseHz: 0.6 }, // steady
  "Lease reader": { speed: 0.6, drift: 0.015, driftHz: 0.2, pulse: 0.02, pulseHz: 0.4 }, // slow and careful
  "Location analyst": { speed: 1.1, drift: 0.05, driftHz: 0.35, pulse: 0.03, pulseHz: 0.8 }, // wanders
  "Premises inspector": { speed: 0.8, drift: 0.03, driftHz: 1.3, pulse: 0.05, pulseHz: 1.3 }, // small hops
  Ranker: { speed: 1.0, drift: 0.0, driftHz: 0, pulse: 0.08, pulseHz: 2 }, // ticks in place
  Auditor: { speed: 0.7, drift: 0.02, driftHz: 0.6, pulse: 0.03, pulseHz: 0.9 }, // even, watchful
  "Report writer": { speed: 0.5, drift: 0.02, driftHz: 0.3, pulse: 0.02, pulseHz: 0.5 }, // slow drift
}
/** Degrees per second for speed 1 while working; idle agents move at IDLE_SHARE of it. */
const BASE_DEGREES_PER_SECOND = 14
const IDLE_SHARE = 0.18
/** The path, as a share of the stage half width. */
const PATH_RADIUS = 0.82
/** The centre sentence changes at most this often, so it can be read. */
const STATUS_HOLD_MS = 1500

/** Shows the newest value, but changes at most once per holdMs (the last value always arrives). */
export function useHeldValue<T>(value: T, holdMs: number): T {
  const [shown, setShown] = useState(value)
  const lastChange = useRef(0)
  useEffect(() => {
    if (Object.is(value, shown)) return
    const wait = Math.max(0, lastChange.current + holdMs - Date.now())
    const timer = window.setTimeout(() => {
      lastChange.current = Date.now()
      setShown(value)
    }, wait)
    return () => window.clearTimeout(timer)
  }, [value, shown, holdMs])
  return shown
}

function Orbit({ snapshot, onSettled }: { snapshot: RunSnapshot; onSettled: () => void }) {
  const { state } = snapshot
  const stageRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<HTMLDivElement>(null)
  const ballRefs = useRef<(HTMLDivElement | null)[]>([])
  const nodes = agentNodes(state)
  const busy = ORBIT_AGENTS.map((name) => (nodes.find((n) => n.name === name)?.running ?? 0) > 0 && !state.done)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const doneRef = useRef(state.done)
  doneRef.current = state.done
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled
  const busyCount = busy.filter(Boolean).length

  // Every frame: transform and opacity only, set on the elements directly (no React render per frame).
  useEffect(() => {
    const angles = ORBIT_AGENTS.map((_, i) => (i / ORBIT_AGENTS.length) * 360 - 90)
    const speeds = ORBIT_AGENTS.map(() => IDLE_SHARE)
    // the path is a spring: it stretches when more agents start working and settles back (elastic)
    let stretch = 0
    let stretchVelocity = 0
    let lastBusy = 0
    let doneFade = 1
    let last = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const t = now / 1000
      const half = (stageRef.current?.clientWidth ?? 600) / 2
      const busyNow = busyRef.current.filter(Boolean).length
      if (busyNow > lastBusy) stretchVelocity += 0.05 * (busyNow - lastBusy)
      lastBusy = busyNow
      stretchVelocity += (-60 * stretch - 4 * stretchVelocity) * dt
      stretch += stretchVelocity * dt
      if (doneRef.current) doneFade *= Math.exp(-dt * 3)
      const breathe = 0.006 * Math.sin(t * 1.1) + 0.004 * Math.sin(t * 2.7)
      pathRef.current?.style.setProperty("transform", `scale(${(1 + (stretch + breathe) * doneFade).toFixed(4)}) rotate(${((t * 12) % 360).toFixed(2)}deg)`)
      ORBIT_AGENTS.forEach((name, i) => {
        const c = CHARACTER[name]
        const working = busyRef.current[i]!
        const target = doneRef.current ? 0 : working ? 1 : IDLE_SHARE
        speeds[i]! += (target - speeds[i]!) * Math.min(1, dt * 2.5)
        angles[i] = (angles[i]! + BASE_DEGREES_PER_SECOND * c.speed * speeds[i]! * dt) % 360
        const radius = half * PATH_RADIUS * (1 + stretch * doneFade + c.drift * doneFade * Math.sin(t * c.driftHz * 2 * Math.PI + i))
        const a = (angles[i]! * Math.PI) / 180
        const scale = 1 + (working ? c.pulse * Math.sin(t * c.pulseHz * 2 * Math.PI + i) : 0)
        const el = ballRefs.current[i]
        if (el) {
          el.style.transform = `translate(${(Math.cos(a) * radius).toFixed(1)}px, ${(Math.sin(a) * radius).toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
          el.style.opacity = working || doneRef.current ? "1" : "0.55"
        }
      })
      if (doneRef.current && Math.max(...speeds) < 0.01 && Math.abs(stretch) < 0.001) {
        onSettledRef.current()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const status = useHeldValue(statusLine(state), STATUS_HOLD_MS)

  return (
    <div ref={stageRef} className="orbit-stage" role="img" aria-label={`Agents at work. ${status}`}>
      {/* the path: a gradient outline that breathes and stretches like a spring */}
      <div ref={pathRef} className="orbit-path" style={{ inset: `${(1 - PATH_RADIUS) * 50}%` }} aria-hidden />
      {ORBIT_AGENTS.map((name, i) => (
        <AgentBall key={name} name={name} working={busy[i]!} count={nodes.find((n) => n.name === name)?.running ?? 0} done={state.done} ballRef={(el) => (ballRefs.current[i] = el)} />
      ))}
      <CentreStatus status={status} done={state.done} cancelled={state.cancelled} busyCount={busyCount} />
      {/* on a phone the centre is too small for the sentence: it goes under the orbit */}
      <p key={status} className="status-enter absolute inset-x-0 -bottom-10 text-center text-sm font-medium text-ink sm:hidden">
        {status}
      </p>
    </div>
  )
}

function AgentBall({ name, working, count, done, ballRef }: { name: OrbitAgentName; working: boolean; count: number; done: boolean; ballRef: (el: HTMLDivElement | null) => void }) {
  const Icon = agentIcon(name)
  return (
    <div ref={ballRef} className="orbit-ball" title={name}>
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <span className="orbit-glow" data-busy={working} />
          <span
            className={cx(
              "relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-300",
              working ? "border-brand bg-white text-ink" : done ? "border-white bg-white/90 text-ink" : "glass-strong border-white text-ink-2",
            )}
          >
            <Icon size={19} strokeWidth={1.75} aria-hidden />
          </span>
          {count > 1 && working && <span className="tnum absolute -top-1.5 -right-2 rounded-full bg-ink px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white">×{count}</span>}
        </div>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap text-ink max-sm:hidden">{name}</span>
      </div>
    </div>
  )
}

function CentreStatus({ status, done, cancelled, busyCount }: { status: string; done: boolean; cancelled: boolean; busyCount: number }) {
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
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand" aria-hidden /> {busyCount > 0 ? `${busyCount} at work` : "Working"}
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
      <Counter label="spaces evaluated" value={`${counters.evaluated} of ${counters.total}`} />
      <Counter label="ruled out by a deal breaker" value={String(counters.rejected)} tone={counters.rejected > 0 ? "hard" : undefined} />
      <Counter label="agent tasks running now" value={String(counters.runningNow)} detail={counters.peak > 0 ? `up to ${counters.peak}` : undefined} />
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
 * Spaces ruled out, each with its one-line reason. Shown from the start with its space reserved
 * (three rows), so nothing jumps when the first hard flag arrives.
 */
function LeftTheOrbit({ chips }: { chips: CandidateChip[] }) {
  const gone = chips.filter((c) => c.phase === "rejected" || c.phase === "failed")
  return (
    <section className="glass min-h-[132px] rounded-[28px] px-6 py-4" aria-label="Spaces ruled out">
      <h2 className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Ruled out</h2>
      {gone.length === 0 ? (
        <p className="text-[13px] text-ink-2">No space ruled out so far. A deal breaker stops the work on a space and lists it here.</p>
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

const PHASE_LABEL: Record<CandidatePhase, string> = { reading: "being read", found: "waiting for the agents", evaluating: "being evaluated", done: "evaluated", rejected: "ruled out", failed: "could not be read" }

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
        <h2 className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Spaces</h2>
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
