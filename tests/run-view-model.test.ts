import { describe, expect, it } from "vitest"
import { applyEvent, initialResearch, type ResearchState } from "../web/src/research-state.js"
import { agentNodes, candidateChips, runCounters, statusLine } from "../web/src/run/run-view-model.js"
import type { CandidateDTO, WireEvent } from "../web/src/types.js"

let seq = 0
const ev = (type: string, fields: Partial<WireEvent> = {}): WireEvent => ({ seq: ++seq, at: seq * 10, type, ...fields })
const play = (events: WireEvent[]): ResearchState => events.reduce(applyEvent, initialResearch("r1"))
const candidate = (id: string, patch: Partial<CandidateDTO> = {}): CandidateDTO => ({
  id,
  synthetic: true,
  listingUrl: null,
  status: "evaluating",
  hasLease: false,
  fields: {},
  unverified: [],
  rejection: null,
  laterFlags: [],
  findings: [],
  ranking: null,
  ...patch,
})

describe("run view model (driven only by events)", () => {
  it("agents appear on the orbit only when they really start working", () => {
    seq = 0
    const s = play([ev("listings.submitted", { data: { listingIds: ["d1", "d2"] } }), ev("loop.started", { agent: "Scout", loopKey: "scout:d1:1" }), ev("loop.started", { agent: "Scout", loopKey: "scout:d2:1" })])
    const nodes = agentNodes(s)
    expect(nodes.map((n) => n.name)).toEqual(["Scout"])
    expect(nodes[0]).toMatchObject({ running: 2, total: 2 })
  })

  it("candidates move from reading to evaluating to done; a hard flag takes them out with the reason", () => {
    seq = 0
    const s0 = play([ev("listings.submitted", { data: { listingIds: ["d1", "d2", "d3"] } })])
    expect(candidateChips(s0).map((c) => c.phase)).toEqual(["reading", "reading", "reading"])
    const s1 = [
      ev("candidate.snapshot", { candidateId: "d1", data: { candidate: candidate("d1") } }),
      ev("loop.started", { agent: "Finance analyst", loopKey: "finance:d1:1", candidateId: "d1" }),
      ev("candidate.snapshot", { candidateId: "d2", data: { candidate: candidate("d2", { status: "rejected", rejection: { rule: "budget", reason: "over budget", raisedBy: "Finance analyst", aspect: "finance", source: { kind: "calc", ref: "x" } } }) } }),
      ev("listing.extraction_failed", { data: { listingId: "d3", reason: "not a listing" } }),
    ].reduce(applyEvent, s0)
    const chips = candidateChips(s1)
    expect(chips.map((c) => c.phase)).toEqual(["evaluating", "rejected", "failed"])
    expect(chips[1]!.reason).toBe("Hard flag: over budget")
    const s2 = applyEvent(s1, ev("loop.answered", { agent: "Finance analyst", loopKey: "finance:d1:1", candidateId: "d1" }))
    expect(candidateChips(s2)[0]!.phase).toBe("done")
    expect(runCounters(s2)).toMatchObject({ total: 3, evaluated: 3, rejected: 1, runningNow: 0 })
  })

  it("the status line follows the latest meaningful event", () => {
    seq = 0
    let s = play([ev("loop.started", { agent: "Finance analyst", loopKey: "finance:d4:1", candidateId: "d4" })])
    expect(statusLine(s)).toBe("Finance analyst is checking the costs of d4")
    s = applyEvent(s, ev("candidate.rejected", { agent: "Lease reader", candidateId: "d7" }))
    expect(statusLine(s)).toBe("Hard flag: d7 rejected by Lease reader")
    s = applyEvent(s, ev("research.done", { data: { cancelled: true } }))
    expect(statusLine(s)).toBe("Research cancelled. Every agent stopped at its next step.")
  })
})
