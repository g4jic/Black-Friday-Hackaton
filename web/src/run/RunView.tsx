import { Check, CircleStop, OctagonAlert } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { cancelResearch, useResearch, type RunSnapshot } from "../app/research-store"
import { navigate, paths } from "../app/router"
import { ResearchMissing } from "../pages/ResearchPage"
import { agentIcon, cx } from "../ui"
import { isFresh, orbitModel } from "./orbit-model"
import {
  ORBIT_AGENTS,
  agentNodes,
  candidateChips,
  candidateLabel,
  runCounters,
  statusLine,
  type CandidateChip,
  type CandidatePhase,
  type OrbitAgentName,
} from "./run-view-model"

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
 * The research run (/research/:id/run): every agent has its home on the big circle, every candidate is a small
 * circle inside it, and every running loop is a dot that travels from its agent to its candidate. Everything on
 * screen comes from the run's SSE events (orbit-model.ts). When the run ends the page moves on to the results.
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
      <section className="glass run-card overflow-hidden rounded-[28px] px-4 py-6 sm:px-8" aria-label="Research run">
        {reducedMotion ? <StaticProgress snapshot={snapshot} /> : <Orbit snapshot={snapshot} onSettled={onSettled} />}
        <RunFooter snapshot={snapshot} />
      </section>
      <LeftTheOrbit chips={candidateChips(snapshot.state)} />
    </div>
  )
}

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

/*
 * Geometry, as shares of the stage's half width. The big circle holds one home per agent (fixed, clockwise from the
 * top); the candidates are small circles on an inner ring; the centre disc says how many loops are at work.
 */
const AGENT_RADIUS = 0.82
const CANDIDATE_RADIUS = 0.53
const CENTRE_RADIUS = 0.3
/** Where an agent's dot sits around a candidate's circle (one place per agent, so the dots never stack). */
const SATELLITE: Partial<Record<OrbitAgentName, number>> = { Scout: 0, "Finance analyst": 1, "Lease reader": 2, "Location analyst": 3, "Premises inspector": 4 }
/** How long each encounter plays, in ms. */
const LIFE = { flag: 1800, handoff: 1500, auditReturn: 1700, ranked: 1300, bounce: 650, fadeIn: 220, fadeOut: 420 }

const rad = (deg: number) => (deg * Math.PI) / 180
const agentAngle = (name: OrbitAgentName) => -90 + ORBIT_AGENTS.indexOf(name) * (360 / ORBIT_AGENTS.length)
const candidateAngle = (slot: number) => -90 + slot * 360 + 22.5
const polar = (deg: number, r: number): [number, number] => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r]
/** 0 -> 1 -> 0 over a cue's life: quick rise, hold, slow fade. */
const envelope = (t: number, life: number) =>
  t < 0 || t > life ? 0 : t < life * 0.15 ? t / (life * 0.15) : t > life * 0.6 ? 1 - (t - life * 0.6) / (life * 0.4) : 1
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** The place of an agent's dot on a candidate's circle (c = the candidate's centre, from the stage centre). */
function satellite(agent: OrbitAgentName, c: [number, number], unit: number): [number, number] {
  const angle = Math.atan2(c[1], c[0]) + rad((SATELLITE[agent] ?? 0) * 72)
  return [c[0] + Math.cos(angle) * 31 * unit, c[1] + Math.sin(angle) * 31 * unit]
}

type Body = { x: number; y: number; vx: number; vy: number }
/** One step of a slightly springy follow (a little overshoot, then rest). */
function follow(b: Body, tx: number, ty: number, dt: number) {
  const k = 95
  const c = 16
  b.vx += (k * (tx - b.x) - c * b.vx) * dt
  b.vy += (k * (ty - b.y) - c * b.vy) * dt
  b.x += b.vx * dt
  b.y += b.vy * dt
}
type DotAnim = Body & { o: number; cancelAt: number | null; hidden: boolean }
/** Writes a glow's opacity and scale, and nothing at all while it stays off. */
function setGlow(el: HTMLElement, opacity: number, scale: number) {
  if (opacity <= 0) {
    if (el.style.opacity !== "0") el.style.opacity = "0"
    return
  }
  el.style.opacity = opacity.toFixed(3)
  el.style.transform = `scale(${scale.toFixed(3)})`
}

/**
 * The orbit. React renders the elements from the event model (orbit-model.ts); one animation frame loop moves them
 * with transform and opacity only, written straight to the elements (no React render per frame). Every motion starts
 * from an object that names its wire event: a dot is a loop, an encounter is a cue.
 */
function Orbit({ snapshot, onSettled }: { snapshot: RunSnapshot; onSettled: () => void }) {
  const { state } = snapshot
  const model = useMemo(() => orbitModel(state), [state])
  const stageRef = useRef<HTMLDivElement>(null)
  const els = useRef({
    dots: new Map<string, HTMLDivElement>(),
    candidates: new Map<string, HTMLDivElement>(),
    candidateFlags: new Map<string, HTMLSpanElement>(),
    agentFlags: new Map<string, HTMLSpanElement>(),
    rankGlow: null as HTMLSpanElement | null,
    lines: new Map<string, HTMLDivElement>(),
    tags: new Map<string, HTMLSpanElement>(),
    pulses: new Map<string, HTMLSpanElement>(),
  })
  const [half, setHalf] = useState(320)
  const live = useRef({ model, state, half, onSettled })
  live.current = { model, state, half, onSettled }

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(() => setHalf(stage.clientWidth / 2))
    observer.observe(stage)
    setHalf(stage.clientWidth / 2)
    return () => observer.disconnect()
  }, [])

  // The frame loop: reads the latest model from a ref, writes transform and opacity only.
  useEffect(() => {
    const dots = new Map<string, DotAnim>()
    /** candidates move along the ring (angle in degrees, radius in px), never across the centre */
    const candidates = new Map<string, Body>()
    /** when each cue started playing (performance.now), or null when it arrived too late to be played */
    const started = new Map<string, number | null>()
    let last = performance.now()
    let frame = 0
    let settled = false
    const tick = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      const { model: m, state: s, half: h } = live.current
      const unit = clamp01(h / 340) * 0.4 + 0.6 // dot and circle sizes shrink a little on a small stage
      const home = (name: OrbitAgentName) => polar(agentAngle(name), h * AGENT_RADIUS)

      for (const cue of m.cues) if (!started.has(cue.key)) started.set(cue.key, isFresh(cue, s) ? now : null)
      const age = (key: string) => {
        const at = started.get(key)
        return at == null ? Infinity : now - at
      }

      // candidates: follow their slot (the slot changes once, when the Ranker orders them)
      const candPos = new Map<string, [number, number]>()
      for (const c of m.candidates) {
        const angle = candidateAngle(c.slot)
        let b = candidates.get(c.id)
        if (!b) candidates.set(c.id, (b = { x: angle, y: h * CANDIDATE_RADIUS, vx: 0, vy: 0 }))
        follow(b, b.x + ((((angle - b.x) % 360) + 540) % 360) - 180, h * CANDIDATE_RADIUS, dt)
        const [x, y] = polar(b.x, b.y)
        candPos.set(c.id, [x, y])
        const el = els.current.candidates.get(c.id)
        if (el) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
      }
      const alive = new Set(m.dots.filter((d) => d.endSeq === null && d.cancelSeq === null).map((d) => d.loopKey))

      // encounters: how strongly each element glows right now (the glow elements are always there, so a cue
      // never inserts DOM in the middle of the animation)
      const dotBoost = new Map<string, number>()
      const agentGlow = new Map<string, number>()
      const candidateRing = new Map<string, [number, number]>()
      let rankGlow: [number, number] = [0, 0]
      let animating = false
      for (const cue of m.cues) {
        const t = age(cue.key)
        if (cue.kind === "flag") {
          const e = envelope(t, LIFE.flag)
          if (e > 0) animating = true
          candidateRing.set(cue.candidateId, [e, clamp01(t / LIFE.flag)])
          if (cue.agent) agentGlow.set(cue.agent, Math.max(agentGlow.get(cue.agent) ?? 0, e))
        } else if (cue.kind === "ranked") {
          const e = envelope(t, LIFE.ranked)
          if (e > 0) animating = true
          rankGlow = [e, clamp01(t / LIFE.ranked)]
        } else {
          const life = cue.kind === "handoff" ? LIFE.handoff : LIFE.auditReturn
          const e = envelope(t, life)
          const line = els.current.lines.get(cue.key)
          const tag = els.current.tags.get(cue.key)
          const pulse = els.current.pulses.get(cue.key)
          if (e <= 0) {
            if (line && line.style.opacity !== "0") line.style.opacity = "0"
            if (tag && tag.style.opacity !== "0") tag.style.opacity = "0"
            if (pulse && pulse.style.opacity !== "0") pulse.style.opacity = "0"
            continue
          }
          animating = true
          let from: [number, number]
          let to: [number, number]
          let tagAt: [number, number]
          if (cue.kind === "handoff") {
            // from where the Lease reader read this lease (its loop has just answered) to the Finance dot waiting for the terms
            const c = candPos.get(cue.candidateId) ?? home("Finance analyst")
            const toDot = dots.get(cue.toLoopKey)
            from = satellite("Lease reader", c, unit)
            to = toDot && alive.has(cue.toLoopKey) ? [toDot.x, toDot.y] : satellite("Finance analyst", c, unit)
            const out = Math.hypot(c[0], c[1]) || 1
            tagAt = [c[0] + (c[0] / out) * 46 * unit, c[1] + (c[1] / out) * 46 * unit]
            dotBoost.set(cue.toLoopKey, e)
          } else {
            from = home("Auditor")
            to = home("Report writer")
            tagAt = [((from[0] + to[0]) / 2) * 0.86, ((from[1] + to[1]) / 2) * 0.86]
          }
          const dx = to[0] - from[0]
          const dy = to[1] - from[1]
          const len = Math.hypot(dx, dy)
          const drawn = clamp01(t / 320)
          if (line) {
            line.style.opacity = e.toFixed(3)
            line.style.transform = `translate(${from[0].toFixed(1)}px, ${from[1].toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${(len * drawn).toFixed(1)})`
          }
          if (pulse) {
            const p = clamp01(t / 700)
            pulse.style.opacity = (p < 1 ? 1 : 0).toString()
            pulse.style.transform = `translate(${(from[0] + dx * p).toFixed(1)}px, ${(from[1] + dy * p).toFixed(1)}px) translate(-50%, -50%)`
          }
          if (tag) {
            tag.style.opacity = e.toFixed(3)
            tag.style.transform = `translate(${tagAt[0].toFixed(1)}px, ${tagAt[1].toFixed(1)}px) translate(-50%, -50%) scale(${(0.9 + 0.1 * e).toFixed(3)})`
          }
        }
      }

      for (const [id, ring] of els.current.candidateFlags) {
        const [e, p] = candidateRing.get(id) ?? [0, 0]
        setGlow(ring, e, 1 + 0.35 * p)
      }
      for (const [agent, glow] of els.current.agentFlags) {
        const e = agentGlow.get(agent) ?? 0
        setGlow(glow, e, 0.9 + 0.3 * e)
      }
      if (els.current.rankGlow) setGlow(els.current.rankGlow, rankGlow[0], 0.9 + 0.4 * rankGlow[1])

      // dots: one per loop; born at the agent's home, they travel to their candidate and leave when the loop ends
      for (const d of m.dots) {
        const el = els.current.dots.get(d.loopKey)
        let a = dots.get(d.loopKey)
        if (!a) {
          const [hx, hy] = home(d.agent)
          a = { x: hx, y: hy, vx: 0, vy: 0, o: 0, cancelAt: null, hidden: d.endSeq !== null }
          dots.set(d.loopKey, a)
          // a loop that was cancelled before this page saw it does not bounce now
          if (d.cancelSeq !== null) a.hidden = true
        }
        if (a.hidden) {
          if (el && el.style.opacity !== "0") el.style.opacity = "0"
          continue
        }
        animating = true
        let scale = 1
        if (d.cancelSeq !== null) {
          if (a.cancelAt === null) {
            a.cancelAt = now
            const c = d.candidateId ? candPos.get(d.candidateId) : undefined
            const ox = c ? a.x - c[0] : a.x
            const oy = c ? a.y - c[1] : a.y
            const n = Math.hypot(ox, oy) || 1
            a.vx = (ox / n) * 360
            a.vy = (oy / n) * 360
          }
          const t = now - a.cancelAt
          a.vx *= Math.exp(-7 * dt)
          a.vy *= Math.exp(-7 * dt)
          a.x += a.vx * dt
          a.y += a.vy * dt
          a.o = 1 - clamp01(t / LIFE.bounce)
          scale = 1 + 0.35 * Math.sin(Math.min(1, t / 260) * Math.PI) - 0.5 * clamp01((t - 260) / (LIFE.bounce - 260))
          if (t >= LIFE.bounce) a.hidden = true
        } else if (d.endSeq !== null) {
          const [hx, hy] = home(d.agent)
          follow(a, hx, hy, dt)
          a.o -= dt / (LIFE.fadeOut / 1000)
          scale = 0.7 + 0.3 * clamp01(a.o)
          if (a.o <= 0) a.hidden = true
        } else {
          const c = d.candidateId ? candPos.get(d.candidateId) : undefined
          let tx: number
          let ty: number
          if (c) {
            ;[tx, ty] = satellite(d.agent, c, unit)
          } else {
            ;[tx, ty] = polar(agentAngle(d.agent), h * CENTRE_RADIUS + 16 * unit)
          }
          follow(a, tx, ty, dt)
          a.o = Math.min(1, a.o + dt / (LIFE.fadeIn / 1000))
          scale = 1 + 0.3 * (dotBoost.get(d.loopKey) ?? 0)
        }
        if (el) {
          el.style.opacity = clamp01(a.o).toFixed(3)
          el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) translate(-50%, -50%) scale(${Math.max(0.01, scale).toFixed(3)})`
        }
      }

      if (s.done && !animating && !settled) {
        settled = true
        live.current.onSettled()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // A hidden tab pauses animation frames: the page still moves on after the run.
  useEffect(() => {
    if (!state.done) return
    const timer = window.setTimeout(() => live.current.onSettled(), 4000)
    return () => window.clearTimeout(timer)
  }, [state.done])

  const status = useHeldValue(statusLine(state), STATUS_HOLD_MS)
  const unit = clamp01(half / 340) * 0.4 + 0.6
  const working = new Set(model.dots.filter((d) => d.endSeq === null).map((d) => d.agent))
  const numbers = new Map([...new Set([...state.submitted, ...state.order])].map((id, i) => [id, i + 1]))
  const lineCues = model.cues.filter((c) => c.kind === "handoff" || c.kind === "auditReturn")

  return (
    <div ref={stageRef} className="orbit-stage" data-done={state.done} role="img" aria-label={`${model.atWork} agent loop${model.atWork === 1 ? "" : "s"} at work. ${status}`}>
      <div className="orbit-path" style={{ inset: `${(1 - AGENT_RADIUS) * 50}%` }} aria-hidden />
      <div className="orbit-inner-ring" style={{ inset: `${(1 - CANDIDATE_RADIUS) * 50}%` }} aria-hidden />

      {/* handoff and audit lines: above the candidate circles, under the dots */}
      {lineCues.map((cue) => (
        <div
          key={cue.key}
          ref={(el) => void (el ? els.current.lines.set(cue.key, el) : els.current.lines.delete(cue.key))}
          className={cx("orbit-line", cue.kind === "auditReturn" && "is-return")}
          aria-hidden
        />
      ))}

      {model.candidates.map((c) => {
        return (
          <div
            key={c.id}
            ref={(el) => void (el ? els.current.candidates.set(c.id, el) : els.current.candidates.delete(c.id))}
            className="orbit-candidate"
            data-phase={c.phase}
            title={`${c.label}: ${CANDIDATE_PHASE[c.phase]}`}
            style={{ width: 36 * unit, height: 36 * unit }}
          >
            <span
              ref={(el) => void (el ? els.current.candidateFlags.set(c.id, el) : els.current.candidateFlags.delete(c.id))}
              className="orbit-flag-ring"
              aria-hidden
            />
            <span className="orbit-candidate-disc tnum">
              {c.phase === "rejected" ? <OctagonAlert size={15 * unit} aria-hidden /> : c.rank !== null ? `#${c.rank}` : numbers.get(c.id)}
            </span>
          </div>
        )
      })}

      {ORBIT_AGENTS.map((name, i) => {
        const Icon = agentIcon(name)
        return (
          <div
            key={name}
            className="orbit-polar orbit-agent"
            style={{ "--turn": i / ORBIT_AGENTS.length - 0.25, "--radius": AGENT_RADIUS } as CSSProperties}
            data-busy={working.has(name)}
            title={name}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <span className="orbit-glow" data-busy={working.has(name) && !state.done} />
                {/* dark red when this agent raises a deal breaker (a flag cue names it) */}
                <span
                  ref={(el) => void (el ? els.current.agentFlags.set(name, el) : els.current.agentFlags.delete(name))}
                  className="orbit-agent-flag"
                  aria-hidden
                />
                {name === "Ranker" && <span ref={(el) => void (els.current.rankGlow = el)} className="orbit-agent-rank" aria-hidden />}
                <span className="orbit-agent-disc">
                  <Icon size={19} strokeWidth={1.75} aria-hidden />
                </span>
              </div>
              <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap text-ink max-sm:hidden">{name}</span>
            </div>
          </div>
        )
      })}

      {model.dots.map((d) => {
        const Icon = agentIcon(d.agent)
        return (
          <div
            key={d.loopKey}
            ref={(el) => void (el ? els.current.dots.set(d.loopKey, el) : els.current.dots.delete(d.loopKey))}
            className="orbit-dot"
            data-cancelled={d.cancelSeq !== null}
            style={{ width: 22 * unit, height: 22 * unit }}
            title={`${d.agent}${d.candidateId ? ` on ${candidateLabel(state, d.candidateId)}` : ""}`}
            aria-hidden
          >
            <Icon size={12 * unit} strokeWidth={2} />
          </div>
        )
      })}

      {lineCues.map((cue) => (
        <span
          key={`${cue.key}:tag`}
          ref={(el) => void (el ? els.current.tags.set(cue.key, el) : els.current.tags.delete(cue.key))}
          className={cx("orbit-tag", cue.kind === "auditReturn" && "is-return")}
          aria-hidden
        >
          {cue.kind === "handoff" ? "Lease terms" : "Sent back"}
        </span>
      ))}
      {lineCues
        .filter((c) => c.kind === "auditReturn")
        .map((cue) => (
          <span
            key={`${cue.key}:pulse`}
            ref={(el) => void (el ? els.current.pulses.set(cue.key, el) : els.current.pulses.delete(cue.key))}
            className="orbit-return-pulse"
            aria-hidden
          />
        ))}

      <CentreStatus status={status} done={state.done} cancelled={state.cancelled} atWork={model.atWork} />
      {/* on a phone the centre is too small for the sentence: it goes under the orbit */}
      <p key={status} className="status-enter absolute inset-x-0 -bottom-10 text-center text-sm font-medium text-ink sm:hidden">
        {status}
      </p>
    </div>
  )
}

const CANDIDATE_PHASE: Record<CandidatePhase, string> = {
  reading: "being read",
  found: "waiting for the agents",
  evaluating: "being evaluated",
  done: "evaluated",
  rejected: "ruled out by a deal breaker",
  failed: "could not be read",
}

function CentreStatus({ status, done, cancelled, atWork }: { status: string; done: boolean; cancelled: boolean; atWork: number }) {
  return (
    <div className="absolute flex items-center justify-center p-[5%] text-center" style={{ inset: `${(1 - CENTRE_RADIUS) * 50}%` }}>
      <span className="orbit-centre-disc" aria-hidden />
      <div aria-live="polite" className="relative flex flex-col items-center gap-1.5">
        {done ? (
          <span
            className={cx(
              "inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase",
              cancelled ? "text-ink-2" : "text-green-700",
            )}
          >
            {cancelled ? <CircleStop size={13} aria-hidden /> : <Check size={13} aria-hidden />}
            {cancelled ? "Stopped" : "Done"}
          </span>
        ) : (
          <>
            <span className="tnum text-[clamp(26px,6cqw,40px)] leading-none font-bold text-ink">{atWork}</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-2 uppercase">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand" aria-hidden /> at work
            </span>
          </>
        )}
        <p key={status} className="status-enter text-[clamp(11px,2.1cqw,14px)] leading-snug font-medium text-ink max-sm:hidden">
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
    <div className="mt-14 grid grid-cols-2 items-stretch gap-3 sm:mt-6 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
      <Counter label="spaces evaluated" value={`${counters.evaluated} of ${counters.total}`} />
      <Counter label="ruled out by a deal breaker" value={String(counters.rejected)} tone={counters.rejected > 0 ? "hard" : undefined} />
      <Counter label="agent tasks running now" value={String(counters.runningNow)} detail={counters.peak > 0 ? `up to ${counters.peak}` : undefined} />
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={done || cancelState === "sending" || cancelState === "sent"}
        className="inline-flex min-h-10 items-center justify-center gap-2 self-center justify-self-center rounded-full glass-strong px-[18px] text-sm font-medium text-ink hover:bg-white disabled:opacity-50 sm:h-10"
      >
        <CircleStop size={16} aria-hidden />
        {cancelState === "sending" || (cancelState === "sent" && !done) ? "Stopping..." : "Cancel"}
      </button>
      {cancelState === "failed" && (
        <span role="alert" className="col-span-2 text-center text-[13px] text-hard">
          Could not cancel. The run may have just finished.
        </span>
      )}
    </div>
  )
}

function Counter({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "hard" }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-[20px] glass-strong px-3 py-2.5 text-center sm:min-w-[150px] sm:px-4">
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
    <section className="glass run-card min-h-[132px] rounded-[28px] px-6 py-4" aria-label="Spaces ruled out">
      <h2 className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Ruled out</h2>
      {gone.length === 0 ? (
        <p className="text-[13px] text-ink-2">No space ruled out so far. A deal breaker stops the work on a space and lists it here.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-[13px]">
          {gone.map((chip) => (
            <li key={chip.id} className="status-enter flex flex-wrap items-center gap-2">
              <span
                className={cx(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  chip.phase === "rejected" ? "bg-hard-50 text-hard" : "bg-white text-ink-2",
                )}
              >
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

/** Reduced motion: the same facts as a static progress list. */
function StaticProgress({ snapshot }: { snapshot: RunSnapshot }) {
  const { state } = snapshot
  const nodes = agentNodes(state)
  const chips = candidateChips(state)
  const model = orbitModel(state)
  const count = (kind: string) => model.cues.filter((c) => c.kind === kind).length
  const n = (value: number, one: string, many: string) => ({ value, label: value === 1 ? one : many })
  const encounters = [
    n(model.atWork, "agent loop at work", "agent loops at work"),
    n(count("flag"), "deal breaker raised", "deal breakers raised"),
    n(count("handoff"), "lease handed to Finance", "leases handed to Finance"),
    n(count("auditReturn"), "draft sent back by the Auditor", "drafts sent back by the Auditor"),
  ]
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <p aria-live="polite" className="text-base font-medium text-ink">
          {statusLine(state)}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="What the agents did so far">
          {encounters.map((e) => (
            <li key={e.label} className="inline-flex items-baseline gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[13px] text-ink-2">
              <span className="tnum font-semibold text-ink">{e.value}</span> {e.label}
            </li>
          ))}
        </ul>
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
              <span className={chip.phase === "rejected" ? "text-hard" : "text-ink-2"}>{CANDIDATE_PHASE[chip.phase]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
