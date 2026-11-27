import { Check, CircleStop, OctagonAlert } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { cancelResearch, useResearch, type RunSnapshot } from "../app/research-store"
import { navigate, paths } from "../app/router"
import { ResearchMissing } from "../pages/ResearchPage"
import { agentIcon, cx } from "../ui"
import { isFresh, orbitModel, type FlagCue } from "./orbit-model"
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
 * The research run (/research/:id/run): the agents start on the big circle; an agent with running loops moves into
 * the white field, every running loop is a small dot circling its agent, and the agents meet when one hands work to
 * another. What is drawn comes from the run's SSE events (orbit-model.ts). When the run ends the page moves on to
 * the results.
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
 * Geometry, as shares of the stage's half width. The agents start on the big circle; an agent with running loops
 * leaves the circle and moves through the white field around the centre, which says how many loops are at work.
 */
const AGENT_RADIUS = 0.82
/** where a busy agent wanders (it breathes a little in and out around this radius) */
const WORK_RADIUS = 0.56
const CENTRE_RADIUS = 0.3
/** How long each encounter plays, in ms. */
const LIFE = { flag: 1800, handoff: 1300, auditReturn: 1700, ranked: 1400, bounce: 650, fadeIn: 220, fadeOut: 420 }
/** The least time an agent spends in the field once it starts working, so a single quick step is still seen. */
const MIN_WORK_MS = 2600
/** The whole team turns slowly around the centre while the run lasts (degrees a second). */
const DRIFT = 5
/** The agents that run loops on single candidates: a thin link joins two of them while both work on the same space. */
const LINKED: OrbitAgentName[] = ["Scout", "Finance analyst", "Lease reader", "Location analyst", "Premises inspector"]
const PAIRS = LINKED.flatMap((a, i) => LINKED.slice(i + 1).map((b) => [a, b] as const))
const pairKey = (a: string, b: string) => `${a}|${b}`

const rad = (deg: number) => (deg * Math.PI) / 180
const agentAngle = (name: OrbitAgentName) => -90 + ORBIT_AGENTS.indexOf(name) * (360 / ORBIT_AGENTS.length)
const polar = (deg: number, r: number): [number, number] => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r]
const angleOf = (p: [number, number]) => (Math.atan2(p[1], p[0]) * 180) / Math.PI
/** the shortest turn from one angle to another, in degrees (-180..180) */
const turn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180
/** 0 -> 1 -> 0 over a cue's life: quick rise, hold, slow fade. */
const envelope = (t: number, life: number) =>
  t < 0 || t > life ? 0 : t < life * 0.15 ? t / (life * 0.15) : t > life * 0.6 ? 1 - (t - life * 0.6) / (life * 0.4) : 1
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const mix = (a: [number, number], b: [number, number], e: number): [number, number] => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]

type Body = { x: number; y: number; vx: number; vy: number }
/** One step of a springy follow: stiff for the loop dots, soft and floating for the agents. */
function follow(b: Body, tx: number, ty: number, dt: number, k = 95, c = 16) {
  b.vx += (k * (tx - b.x) - c * b.vx) * dt
  b.vy += (k * (ty - b.y) - c * b.vy) * dt
  b.x += b.vx * dt
  b.y += b.vy * dt
}
type AgentAnim = Body & { angle: number }
/**
 * A loop dot lives in polar coordinates around its agent, so the dots always form a true circle centred on it:
 * `slot` is its angle on that circle (it eases to an even share when loops come and go), `r` its distance.
 */
type DotAnim = { slot: number; r: number; vr: number; o: number; cancelAt: number | null; hidden: boolean }
/** Writes a glow's opacity and scale, and nothing at all while it stays off. */
function setGlow(el: HTMLElement, opacity: number, scale: number) {
  if (opacity <= 0) {
    if (el.style.opacity !== "0") el.style.opacity = "0"
    return
  }
  el.style.opacity = opacity.toFixed(3)
  el.style.transform = `scale(${scale.toFixed(3)})`
}
type Pt = [number, number]
/**
 * The control point of a curve from a to b that never crosses the centre (where the status sentence is): a straight
 * line when it already stays clear, otherwise a bend whose middle passes just outside the keep-out circle.
 */
function bend(a: Pt, b: Pt, keepOut: number): Pt {
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const t = clamp01(-(a[0] * dx + a[1] * dy) / (len * len))
  if (Math.hypot(a[0] + dx * t, a[1] + dy * t) >= keepOut) return mid
  const away = Math.hypot(mid[0], mid[1])
  const u: Pt = away > 1 ? [mid[0] / away, mid[1] / away] : [-dy / len, dx / len]
  // a quadratic curve passes through (mid + control) / 2 at its middle: put that point just outside the circle
  const apex: Pt = [u[0] * keepOut * 1.12, u[1] * keepOut * 1.12]
  return [2 * apex[0] - mid[0], 2 * apex[1] - mid[1]]
}
const onCurve = (a: Pt, c: Pt, b: Pt, t: number): Pt => [
  (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
]
/** Draws a link (an SVG path with pathLength 1) from a to b around the centre; `drawn` reveals it from a. */
function setCurve(el: SVGPathElement, a: Pt, c: Pt, b: Pt, opacity: number, drawn = 1) {
  if (opacity <= 0.005) {
    if (el.style.opacity !== "0") el.style.opacity = "0"
    return
  }
  const f = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  el.setAttribute("d", `M${f(a)}Q${f(c)} ${f(b)}`)
  el.style.opacity = opacity.toFixed(3)
  el.style.strokeDashoffset = (1 - drawn).toFixed(3)
}
/** A point moved away from the centre, so a tag never covers the status sentence. */
function outward(p: Pt, by: number): Pt {
  const r = Math.hypot(p[0], p[1]) || 1
  return [p[0] + (p[0] / r) * by, p[1] + (p[1] / r) * by]
}
function place(el: HTMLElement, p: [number, number], extra = "") {
  el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -50%)${extra}`
}

/**
 * The orbit. React renders the elements from the event model (orbit-model.ts); one animation frame loop moves them
 * with transform and opacity only, written straight to the elements (no React render per frame).
 *
 * What is drawn comes from the bus: a dot is one running loop and circles the agent that runs it, an agent leaves the
 * big circle while it has loops, a link joins two agents while both have loops on the same space, and every
 * encounter (a deal breaker, lease terms handed to Finance, a draft sent back, the ranking) is a cue. Only the paths
 * are free: the agents drift, wander and keep out of each other's way so the room stays alive, but where an agent
 * stands means nothing.
 */
function Orbit({ snapshot, onSettled }: { snapshot: RunSnapshot; onSettled: () => void }) {
  const { state } = snapshot
  const model = useMemo(() => orbitModel(state), [state])
  const stageRef = useRef<HTMLDivElement>(null)
  const els = useRef({
    agents: new Map<string, HTMLDivElement>(),
    dots: new Map<string, HTMLDivElement>(),
    agentFlags: new Map<string, HTMLSpanElement>(),
    rankGlow: null as HTMLSpanElement | null,
    links: new Map<string, SVGPathElement>(),
    lines: new Map<string, SVGPathElement>(),
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
    const agents = new Map<string, AgentAnim>()
    const dots = new Map<string, DotAnim>()
    const linkOpacity = new Map<string, number>()
    /** when each cue started playing (performance.now), or null when it arrived too late to be played */
    const started = new Map<string, number | null>()
    let drift = 0
    /** where the busy agents' shared formation has turned to (degrees) */
    let formation = -90
    /** until when each agent stays in the field at the least (performance.now) */
    const heldUntil = new Map<string, number>()
    const wasBusy = new Set<string>()
    let last = performance.now()
    let frame = 0
    let settled = false
    const tick = (now: number) => {
      let animatingHold = false
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      const sec = now / 1000
      const { model: m, state: s, half: h } = live.current
      const unit = clamp01(h / 340) * 0.4 + 0.6 // sizes shrink a little on a small stage
      /** links bend around this circle, so they never cross the status sentence in the centre */
      const keepOut = h * CENTRE_RADIUS + 26 * unit
      /** the radius of an agent's ring of loop dots (it widens a little for a crowd) */
      const dotRing = (n: number) => (32 + Math.max(0, n - 8) * 2) * unit
      if (!s.done) drift += DRIFT * dt

      const fresh = new Set<string>()
      for (const cue of m.cues)
        if (!started.has(cue.key)) {
          const play = isFresh(cue, s)
          started.set(cue.key, play ? now : null)
          if (play) fresh.add(cue.key)
        }
      const age = (key: string) => {
        const at = started.get(key)
        return at == null ? Infinity : now - at
      }

      // the loops at work, per agent (in start order) and per candidate
      const alive = m.dots.filter((d) => d.endSeq === null && d.cancelSeq === null)
      const byAgent = new Map<string, string[]>()
      const onCandidate = new Map<string, Set<string>>()
      for (const d of alive) {
        byAgent.set(d.agent, [...(byAgent.get(d.agent) ?? []), d.loopKey])
        if (d.candidateId) onCandidate.set(d.candidateId, (onCandidate.get(d.candidateId) ?? new Set<string>()).add(d.agent))
      }

      // 0. who is working: an agent with running loops, or one whose single step just arrived (the Ranker's ranking,
      //    the Auditor sending a draft back). Every agent stays in the field at least MIN_WORK_MS from the moment it
      //    starts, so short work is still seen.
      const busy = new Set<string>()
      for (const name of ORBIT_AGENTS) {
        const step = m.cues.some(
          (c) => fresh.has(c.key) && ((c.kind === "ranked" && name === "Ranker") || (c.kind === "auditReturn" && name === "Auditor")),
        )
        const active = (!s.done && byAgent.has(name)) || step
        if (active && !wasBusy.has(name)) heldUntil.set(name, now + MIN_WORK_MS)
        if (active || now < (heldUntil.get(name) ?? 0)) busy.add(name)
        if (now < (heldUntil.get(name) ?? 0)) animatingHold = true
      }
      wasBusy.clear()
      for (const name of busy) wasBusy.add(name)

      // 1. where each agent would like to be: on the big circle while idle, wandering in the field while busy
      const target = new Map<string, [number, number]>()
      const busyNames = ORBIT_AGENTS.filter((name) => busy.has(name))
      if (!s.done) formation += 18 * dt
      ORBIT_AGENTS.forEach((name, i) => {
        const slot = agentAngle(name) + drift
        let a = agents.get(name)
        if (!a) {
          const [x, y] = polar(slot, h * AGENT_RADIUS)
          a = { x, y, vx: 0, vy: 0, angle: slot }
          agents.set(name, a)
        }
        let r: number
        let angle: number
        const share = busyNames.indexOf(name)
        if (share >= 0) {
          // the busy agents share the field evenly and turn together, each wandering a little around its share
          a.angle += turn(a.angle, formation + (share * 360) / busyNames.length) * Math.min(1, 1.8 * dt)
          angle = a.angle + 10 * Math.sin(sec * 0.55 + i * 2.1)
          r = h * (WORK_RADIUS + 0.07 * Math.sin(sec * 0.9 + i * 1.3))
        } else {
          a.angle += turn(a.angle, slot) * Math.min(1, 2.5 * dt) // back to its place on the circle
          angle = a.angle
          r = h * AGENT_RADIUS + 3 * unit * Math.sin(sec * 1.2 + i)
        }
        target.set(name, polar(angle, r))
      })
      const at = (name: string): [number, number] => {
        const a = agents.get(name)!
        return [a.x, a.y]
      }

      // 2. encounters pull agents together (or push them apart) while they play
      const dotBoost = new Map<string, number>()
      const agentGlow = new Map<string, number>()
      let rankGlow: [number, number] = [0, 0]
      let animating = false
      const meet = (a: OrbitAgentName, b: OrbitAgentName, e: number) => {
        const pa = at(a)
        const pb = at(b)
        const mid: [number, number] = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2]
        const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) || 1
        const gap = 36 * unit
        const ux = (pa[0] - pb[0]) / d
        const uy = (pa[1] - pb[1]) / d
        target.set(a, mix(target.get(a)!, [mid[0] + ux * gap, mid[1] + uy * gap], e * 0.85))
        target.set(b, mix(target.get(b)!, [mid[0] - ux * gap, mid[1] - uy * gap], e * 0.85))
      }
      for (const cue of m.cues) {
        const t = age(cue.key)
        if (cue.kind === "flag") {
          const e = envelope(t, LIFE.flag)
          const tag = els.current.tags.get(cue.key)
          if (e <= 0) {
            if (tag && tag.style.opacity !== "0") tag.style.opacity = "0"
            continue
          }
          animating = true
          if (!cue.agent) continue
          agentGlow.set(cue.agent, Math.max(agentGlow.get(cue.agent) ?? 0, e))
          // the agent that raised the deal breaker steps in towards the centre ...
          const p = at(cue.agent)
          target.set(cue.agent, mix(target.get(cue.agent)!, polar(angleOf(p), h * (CENTRE_RADIUS + 0.13)), e))
          // ... and the agents whose loops it cancelled recoil, once
          if (fresh.has(cue.key)) {
            const owners = new Set(m.dots.filter((d) => cue.cancelledLoopKeys.includes(d.loopKey)).map((d) => d.agent))
            for (const owner of owners) {
              if (owner === cue.agent) continue
              const o = agents.get(owner)!
              const n = Math.hypot(o.x - p[0], o.y - p[1]) || 1
              o.vx += ((o.x - p[0]) / n) * 260
              o.vy += ((o.y - p[1]) / n) * 260
            }
          }
          if (tag) {
            tag.style.opacity = e.toFixed(3)
            place(tag, outward(p, 70 * unit), ` scale(${(0.9 + 0.1 * e).toFixed(3)})`)
          }
        } else if (cue.kind === "ranked") {
          const e = envelope(t, LIFE.ranked)
          if (e <= 0) continue
          animating = true
          rankGlow = [e, clamp01(t / LIFE.ranked)]
          target.set("Ranker", mix(target.get("Ranker")!, polar(angleOf(at("Ranker")), h * 0.46), e))
        } else {
          const e = envelope(t, cue.kind === "handoff" ? LIFE.handoff : LIFE.auditReturn)
          if (e <= 0) continue
          animating = true
          if (cue.kind === "handoff") {
            meet("Lease reader", "Finance analyst", e)
            dotBoost.set(cue.toLoopKey, e)
          } else meet("Auditor", "Report writer", e)
        }
      }

      // 3. move the agents: a soft spring to the target, and they keep out of each other's way
      for (const name of ORBIT_AGENTS) {
        const [tx, ty] = target.get(name)!
        follow(agents.get(name)!, tx, ty, dt, 26, 7.5)
      }
      const minGap = 84 * unit // room for the names under the discs
      for (let i = 0; i < ORBIT_AGENTS.length; i++)
        for (let j = i + 1; j < ORBIT_AGENTS.length; j++) {
          const a = agents.get(ORBIT_AGENTS[i]!)!
          const b = agents.get(ORBIT_AGENTS[j]!)!
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.hypot(dx, dy) || 0.01
          if (d >= minGap) continue
          const push = (minGap - d) * 55 * dt
          a.vx += (dx / d) * push
          a.vy += (dy / d) * push
          b.vx -= (dx / d) * push
          b.vy -= (dy / d) * push
        }
      for (const name of ORBIT_AGENTS) {
        const a = agents.get(name)!
        const r = Math.hypot(a.x, a.y) || 0.01
        const inner = h * CENTRE_RADIUS + 44 * unit // the agent and its ring of dots never cover the centre's sentence
        const outer = h * AGENT_RADIUS + 8 * unit
        const k = r < inner ? inner / r : r > outer ? outer / r : 1
        a.x *= k
        a.y *= k
        const el = els.current.agents.get(name)
        if (el) {
          place(el, [a.x, a.y])
          const state = String(busy.has(name))
          if (el.dataset.busy !== state) el.dataset.busy = state
        }
      }

      // 4. glows, links and encounter lines, drawn between where the agents are now
      for (const [agent, glow] of els.current.agentFlags) {
        const e = agentGlow.get(agent) ?? 0
        setGlow(glow, e, 0.9 + 0.3 * e)
      }
      if (els.current.rankGlow) setGlow(els.current.rankGlow, rankGlow[0], 0.9 + 0.4 * rankGlow[1])
      for (const [a, b] of PAIRS) {
        const key = pairKey(a, b)
        let shared = 0
        for (const set of onCandidate.values()) if (set.has(a) && set.has(b)) shared++
        const goal = shared > 0 && !s.done ? Math.min(0.42, 0.14 + 0.06 * shared) : 0
        const was = linkOpacity.get(key) ?? 0
        const o = was + (goal - was) * Math.min(1, 6 * dt)
        linkOpacity.set(key, o)
        const el = els.current.links.get(key)
        if (el) setCurve(el, at(a), bend(at(a), at(b), keepOut), at(b), o)
      }
      for (const cue of m.cues) {
        if (cue.kind !== "handoff" && cue.kind !== "auditReturn") continue
        const t = age(cue.key)
        const e = envelope(t, cue.kind === "handoff" ? LIFE.handoff : LIFE.auditReturn)
        const line = els.current.lines.get(cue.key)
        const tag = els.current.tags.get(cue.key)
        const pulse = els.current.pulses.get(cue.key)
        const from = at(cue.kind === "handoff" ? "Lease reader" : "Auditor")
        const to = at(cue.kind === "handoff" ? "Finance analyst" : "Report writer")
        const c = bend(from, to, keepOut)
        if (line) setCurve(line, from, c, to, e, clamp01(t / 320))
        if (pulse) {
          const p = clamp01(t / 700)
          pulse.style.opacity = e > 0 && p < 1 ? "1" : "0"
          if (e > 0) place(pulse, onCurve(from, c, to, p))
        }
        if (tag) {
          tag.style.opacity = e.toFixed(3)
          const middle = onCurve(from, c, to, 0.5)
          if (e > 0) place(tag, outward(middle, 40 * unit), ` scale(${(0.9 + 0.1 * e).toFixed(3)})`)
        }
      }

      // 5. dots: one per loop, on a circle centred on the agent that runs it, evenly spaced and turning together; a
      //    dot shrinks into its agent when the loop answers and flies off in red when a deal breaker cancels it
      for (const d of m.dots) {
        const el = els.current.dots.get(d.loopKey)
        const owner = at(d.agent)
        const mine = byAgent.get(d.agent) ?? []
        const even = mine.includes(d.loopKey) ? (mine.indexOf(d.loopKey) * 360) / mine.length : null
        let a = dots.get(d.loopKey)
        if (!a) {
          // a loop that ended (or was cancelled) before this page saw it is not shown at all
          a = { slot: even ?? 0, r: 0, vr: 0, o: 0, cancelAt: null, hidden: d.endSeq !== null || d.cancelSeq !== null }
          dots.set(d.loopKey, a)
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
            a.vr = 380
          }
          const t = now - a.cancelAt
          a.vr *= Math.exp(-6 * dt)
          a.r += a.vr * dt
          a.o = 1 - clamp01(t / LIFE.bounce)
          scale = 1 + 0.4 * Math.sin(Math.min(1, t / 260) * Math.PI) - 0.5 * clamp01((t - 260) / (LIFE.bounce - 260))
          if (t >= LIFE.bounce) a.hidden = true
        } else if (d.endSeq !== null) {
          a.r += (0 - a.r) * Math.min(1, 9 * dt)
          a.o -= dt / (LIFE.fadeOut / 1000)
          scale = 0.6 + 0.4 * clamp01(a.o)
          if (a.o <= 0) a.hidden = true
        } else {
          if (even !== null) a.slot += turn(a.slot, even) * Math.min(1, 7 * dt)
          a.r += (dotRing(mine.length) - a.r) * Math.min(1, 9 * dt)
          a.o = Math.min(1, a.o + dt / (LIFE.fadeIn / 1000))
          scale = 1 + 0.45 * (dotBoost.get(d.loopKey) ?? 0)
        }
        if (el) {
          const spin = sec * 64 + ORBIT_AGENTS.indexOf(d.agent) * 45
          const [ox, oy] = polar(spin + a.slot, a.r)
          el.style.opacity = clamp01(a.o).toFixed(3)
          place(el, [owner[0] + ox, owner[1] + oy], ` scale(${Math.max(0.01, scale).toFixed(3)})`)
        }
      }

      if (s.done && !animating && !animatingHold && !settled) {
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
  const lineCues = model.cues.filter((c) => c.kind === "handoff" || c.kind === "auditReturn")
  const flagCues = model.cues.filter((c): c is FlagCue => c.kind === "flag")

  return (
    <div ref={stageRef} className="orbit-stage" data-done={state.done} role="img" aria-label={`${model.atWork} agent loop${model.atWork === 1 ? "" : "s"} at work. ${status}`}>
      <div className="orbit-field" style={{ inset: `${(1 - AGENT_RADIUS) * 50}%` }} aria-hidden />
      <div className="orbit-path" style={{ inset: `${(1 - AGENT_RADIUS) * 50}%` }} aria-hidden />
      <CentreStatus status={status} done={state.done} cancelled={state.cancelled} atWork={model.atWork} />

      {/* links between agents working on the same space, and the encounter lines: under the agents, bent around the centre */}
      <svg className="orbit-links" viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`} aria-hidden>
        {PAIRS.map(([a, b]) => (
          <path
            key={pairKey(a, b)}
            ref={(el) => void (el ? els.current.links.set(pairKey(a, b), el) : els.current.links.delete(pairKey(a, b)))}
            className="orbit-link"
            pathLength={1}
          />
        ))}
        {lineCues.map((cue) => (
          <path
            key={cue.key}
            ref={(el) => void (el ? els.current.lines.set(cue.key, el) : els.current.lines.delete(cue.key))}
            className={cx("orbit-cue-line", cue.kind === "auditReturn" && "is-return")}
            pathLength={1}
          />
        ))}
      </svg>

      {ORBIT_AGENTS.map((name) => {
        const Icon = agentIcon(name)
        return (
          <div
            key={name}
            ref={(el) => void (el ? els.current.agents.set(name, el) : els.current.agents.delete(name))}
            className="orbit-agent"
            style={{ width: 44 * unit, height: 44 * unit }}
            title={name}
          >
            {/* the frame loop sets data-busy on the agent (it holds short work on screen for MIN_WORK_MS) */}
            <span className="orbit-glow" />
            {/* dark red when this agent raises a deal breaker (a flag cue names it) */}
            <span
              ref={(el) => void (el ? els.current.agentFlags.set(name, el) : els.current.agentFlags.delete(name))}
              className="orbit-agent-flag"
              aria-hidden
            />
            {name === "Ranker" && <span ref={(el) => void (els.current.rankGlow = el)} className="orbit-agent-rank" aria-hidden />}
            <span className="orbit-agent-disc">
              <Icon size={19 * unit} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="orbit-agent-name max-sm:hidden">{name}</span>
          </div>
        )
      })}

      {model.dots.map((d) => (
        <div
          key={d.loopKey}
          ref={(el) => void (el ? els.current.dots.set(d.loopKey, el) : els.current.dots.delete(d.loopKey))}
          className="orbit-dot"
          data-cancelled={d.cancelSeq !== null}
          style={{ width: 11 * unit, height: 11 * unit }}
          aria-hidden
        />
      ))}

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
      {lineCues.map((cue) => (
        <span
          key={`${cue.key}:pulse`}
          ref={(el) => void (el ? els.current.pulses.set(cue.key, el) : els.current.pulses.delete(cue.key))}
          className={cx("orbit-return-pulse", cue.kind === "handoff" && "is-handoff")}
          aria-hidden
        />
      ))}
      {flagCues.map((cue) => (
        <span
          key={`${cue.key}:tag`}
          ref={(el) => void (el ? els.current.tags.set(cue.key, el) : els.current.tags.delete(cue.key))}
          className="orbit-tag is-return max-sm:hidden"
          aria-hidden
        >
          Deal breaker: {candidateLabel(state, cue.candidateId)}
        </span>
      ))}

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
    <div className="pointer-events-none absolute flex items-center justify-center p-[5%] text-center" style={{ inset: `${(1 - CENTRE_RADIUS) * 50}%` }}>
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
        <p className="text-[13px] text-ink-2">No space ruled out so far.</p>
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
