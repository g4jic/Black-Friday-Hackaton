import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { DEMO_SCENARIOS, type DemoScenarioId } from "../src/adapters/fixtures/demo-scenarios.js"
import { buildServer } from "../src/adapters/server/server.js"
import { applyEvent, initialResearch, type ResearchState } from "../web/src/research-state.js"
import { CUE_EVENT, orbitModel } from "../web/src/run/orbit-model.js"
import { runCounters } from "../web/src/run/run-view-model.js"
import type { WireEvent } from "../web/src/types.js"

const parse = (body: string): WireEvent[] =>
  body
    .split("\n\n")
    .map((part) => part.split("\n").find((l) => l.startsWith("data:")))
    .filter((l): l is string => Boolean(l))
    .map((l) => JSON.parse(l.slice(5)) as WireEvent)

async function recordedRun(scenario: DemoScenarioId): Promise<WireEvent[]> {
  delete process.env.ANTHROPIC_API_KEY
  const app = await buildServer({ replaySpeed: 0 })
  const post = await app.inject({ method: "POST", url: "/api/research", payload: { source: "demo", scenario } })
  const { id } = post.json() as { id: string }
  const events = parse((await app.inject({ method: "GET", url: `/api/research/${id}/events` })).body)
  await app.close()
  return events
}

/** Checks one orbit model against the events it was built from: every dot and every cue names its real event. */
function expectTiedToEvents(s: ResearchState) {
  const bySeq = new Map(s.events.map((e) => [e.seq, e]))
  const m = orbitModel(s)
  for (const d of m.dots) {
    const start = bySeq.get(d.startSeq)!
    expect(start.type).toBe(d.agent === "Auditor" ? "audit.started" : "loop.started")
    if (start.type === "loop.started") expect([start.loopKey, start.agent, start.candidateId ?? null]).toEqual([d.loopKey, d.agent, d.candidateId])
    if (d.endSeq !== null) expect(bySeq.get(d.endSeq)!.type).toBe(d.agent === "Auditor" ? "audit.done" : "loop.answered")
    if (d.cancelSeq !== null) {
      const rejected = bySeq.get(d.cancelSeq)!
      expect(rejected.type).toBe("candidate.rejected")
      expect((rejected.data?.cancelledLoops as { loopKey: string }[]).map((l) => l.loopKey)).toContain(d.loopKey)
    }
  }
  for (const cue of m.cues) {
    const e = bySeq.get(cue.seq)!
    expect(e.type).toBe(CUE_EVENT[cue.kind])
    expect(cue.at).toBe(e.at)
    if (cue.kind === "flag") {
      expect(cue.candidateId).toBe(e.candidateId)
      expect(cue.raisedBy).toBe((e.data?.flag as { raisedBy?: string } | undefined)?.raisedBy ?? null)
    }
    if (cue.kind === "handoff") {
      expect(e.candidateId).toBe(cue.candidateId)
      expect(e.data?.hardFlags).toEqual([])
      // the Finance loop that receives the terms was running on that candidate when lease.read arrived
      const finance = m.dots.find((d) => d.loopKey === cue.toLoopKey)!
      expect(finance).toMatchObject({ agent: "Finance analyst", candidateId: cue.candidateId })
      expect(finance.startSeq).toBeLessThan(cue.seq)
      expect(finance.endSeq === null || finance.endSeq > cue.seq).toBe(true)
      // the line starts where the Lease reader read this lease
      if (cue.fromLoopKey) {
        const reader = m.dots.find((d) => d.loopKey === cue.fromLoopKey)!
        expect(reader).toMatchObject({ agent: "Lease reader", candidateId: cue.candidateId })
        expect(reader.startSeq).toBeLessThan(cue.seq)
      }
    }
  }
  // the centre number is the number of dots on screen, and it is the real number of running loops
  expect(m.atWork).toBe(m.dots.filter((d) => d.endSeq === null).length)
  expect(m.atWork).toBe(runCounters(s).runningNow)
  return m
}

describe("orbit model: every animation comes from a real bus event", () => {
  for (const scenario of Object.keys(DEMO_SCENARIOS) as DemoScenarioId[]) {
    it(`${scenario}: dots, deal breakers, handoffs and the ranking all point to their wire events`, async () => {
      const events = await recordedRun(scenario)
      let s = initialResearch("r1")
      let maxLoopDots = 0
      for (const e of events) {
        s = applyEvent(s, e)
        const m = expectTiedToEvents(s)
        maxLoopDots = Math.max(maxLoopDots, m.dots.filter((d) => d.endSeq === null && d.agent !== "Auditor").length)
      }
      const m = orbitModel(s)
      // at the peak the screen shows exactly as many dots as loops ran at once
      expect(maxLoopDots).toBe(s.peak)
      expect(s.peak).toBeGreaterThan(20)
      // the recorded runs have real deal breakers and real handoffs; each cancelled loop bounces off
      const flags = m.cues.filter((c) => c.kind === "flag")
      expect(flags.length).toBe(events.filter((e) => e.type === "candidate.rejected").length)
      expect(flags.length).toBeGreaterThan(0)
      expect(m.cues.some((c) => c.kind === "handoff")).toBe(true)
      expect(m.dots.filter((d) => d.cancelSeq !== null).length).toBe(flags.reduce((n, f) => n + f.cancelledLoopKeys.length, 0))
      // after ranking.done the candidates stand in the Ranker's order
      const ranked = m.cues.find((c) => c.kind === "ranked")!
      expect(ranked).toBeDefined()
      const bySlot = [...m.candidates].sort((a, b) => a.slot - b.slot).map((c) => c.id)
      expect(bySlot.slice(0, ranked.order.length)).toEqual(ranked.order.filter((id) => m.candidates.some((c) => c.id === id)))
      // when the run is over nothing is at work
      expect(m.atWork).toBe(0)
    }, 60_000)
  }

  let seq = 0
  const ev = (type: string, fields: Partial<WireEvent> = {}): WireEvent => ({ seq: ++seq, at: seq * 10, type, ...fields })
  const play = (events: WireEvent[]) => events.reduce(applyEvent, initialResearch("r1"))

  it("the Auditor sending a draft back is one cue on report.audit_failed, and only then", () => {
    seq = 0
    const s = play([
      ev("loop.started", { agent: "Report writer", loopKey: "report:1" }),
      ev("report.drafted", { agent: "Report writer", data: { attempt: 1, ok: true } }),
      ev("audit.started", { agent: "Auditor", data: { attempt: 1 } }),
      ev("audit.done", { agent: "Auditor", data: { attempt: 1, checked: 12, problems: [{}, {}] } }),
      ev("report.audit_failed", { agent: "Auditor", data: { attempt: 1, problems: [{}, {}] } }),
    ])
    const m = expectTiedToEvents(s)
    expect(m.cues).toEqual([{ kind: "auditReturn", key: "audit-return:5", seq: 5, at: 50, attempt: 1, problems: 2 }])
    expect(m.dots.map((d) => [d.agent, d.endSeq])).toEqual([
      ["Report writer", null],
      ["Auditor", 4],
    ])
  })

  it("no handoff line when the lease is a deal breaker or Finance has already finished", () => {
    seq = 0
    const s = play([
      ev("loop.started", { agent: "Finance analyst", loopKey: "finance:a:1", candidateId: "a" }),
      ev("loop.started", { agent: "Lease reader", loopKey: "lease:a:1", candidateId: "a" }),
      ev("lease.read", { agent: "Lease reader", candidateId: "a", data: { hardFlags: ["locked_in_without_exit"] } }),
      ev("loop.started", { agent: "Finance analyst", loopKey: "finance:b:1", candidateId: "b" }),
      ev("loop.answered", { agent: "Finance analyst", loopKey: "finance:b:1", candidateId: "b" }),
      ev("lease.read", { agent: "Lease reader", candidateId: "b", data: { hardFlags: [] } }),
      ev("loop.started", { agent: "Finance analyst", loopKey: "finance:c:1", candidateId: "c" }),
      ev("lease.read", { agent: "Lease reader", candidateId: "c", data: { hardFlags: [] } }),
    ])
    const m = expectTiedToEvents(s)
    expect(m.cues.map((c) => c.kind === "handoff" && [c.candidateId, c.toLoopKey, c.fromLoopKey])).toEqual([["c", "finance:c:1", null]])
  })

  it("the run view draws nothing that is not in the model: no random motion, no timer-made events", () => {
    const source = readFileSync("web/src/run/RunView.tsx", "utf8")
    expect(source).not.toMatch(/Math\.random/)
    expect(source).not.toMatch(/setInterval/)
    // every dot, line, tag and glow is rendered from model.dots or a cue (the agents only move between them)
    for (const kind of ["model.dots.map", "lineCues.map", "flagCues.map", "m.cues"]) expect(source).toContain(kind)
  })
})
