/**
 * Runs Scout + Finance analyst + Lease reader on demo listings that have a lease draft and prints the timeline
 * (who started, who called the calculator, who was cut and where), the findings with sources, and run metrics
 * computed from runtime events.
 *
 * PowerShell:
 *   npm run demo:evaluate                       # keyless: MockRunner over demo-01, demo-04, demo-07
 *   npm run demo:evaluate -- --live             # claude-haiku-4-5 over demo-07 (the hard flag), key from .env
 *   npm run demo:evaluate -- --live --ids demo-01,demo-07
 * The key is read from .env and never printed.
 */
import "dotenv/config"
import { createHuman } from "@mozaik-ai/core"
import { loadDemoLeases, loadDemoListings, loadDemoQuestionnaire, loadLeaseAnswers, loadScoutAnswers } from "../src/adapters/fixtures/demo-listings.js"
import { createLiveRunner } from "../src/adapters/inference/live-runner.js"
import { MockRunner } from "../src/adapters/inference/mock-runner.js"
import { demoRoomScript } from "../src/adapters/inference/scripts/demo-script.js"
import { createFinanceAnalyst } from "../src/application/agents/finance-analyst.js"
import { createLeaseReader } from "../src/application/agents/lease-reader.js"
import { createScout, submitListings } from "../src/application/agents/scout.js"
import { createRecorder } from "../src/application/observers/recorder.js"
import { installProcessGuards } from "../src/application/resilience/process-guards.js"
import { createAppRuntime } from "../src/application/runtime.js"

const LIVE_MODEL = "claude-haiku-4-5"
/** USD per million tokens for claude-haiku-4-5 (Anthropic price list, cached 3 Nov 2026 in the claude-api reference). */
const PRICE = { input: 1, output: 5 }

const args = process.argv.slice(2)
const live = args.includes("--live")
const idsArg = args.find((a) => a.startsWith("--ids="))?.split("=")[1] ?? (args.includes("--ids") ? args[args.indexOf("--ids") + 1] : undefined)
const ids = idsArg ? idsArg.split(",") : live ? ["demo-07"] : ["demo-01", "demo-04", "demo-07"]
if (live && !process.env.ANTHROPIC_API_KEY) {
  console.error("Live mode needs ANTHROPIC_API_KEY in .env")
  process.exit(1)
}
installProcessGuards()

const model = live ? LIVE_MODEL : "mock"
const rt = createAppRuntime({
  runner: live
    ? createLiveRunner()
    : new MockRunner({ script: demoRoomScript({ scout: loadScoutAnswers(), lease: loadLeaseAnswers() }, { scout: () => 10, leaseReader: 100, financeStep: 30 }) }),
  maxParallelInference: 8,
  resilience: live ? { retries: 2, baseDelayMs: 1000 } : { retries: 0 },
})
const recorder = createRecorder()
const user = createHuman({ name: "User", capabilities: [], handlers: [] })
const agents = [createScout(rt, { model }), createFinanceAnalyst(rt, { model }), createLeaseReader(rt, { model })]
for (const p of [recorder.participant, user, ...agents]) rt.join(p)

const q = loadDemoQuestionnaire()
rt.state.setQuestionnaire(q.profile, q.requirements)
rt.state.submitLeases(loadDemoLeases().filter((l) => ids.includes(l.listingId)))
const listings = loadDemoListings().filter((l) => ids.includes(l.id!))

console.log(`\nSuiteSpot evaluation demo - ${live ? `LIVE ${LIVE_MODEL}` : "MOCK (keyless)"} - ${listings.map((l) => l.id).join(", ")}`)
const started = Date.now()
submitListings(rt, listings, user.getId())

const done = () => rt.state.candidates.size + rt.state.failedListings.length >= listings.length && rt.loops().length > 0 && rt.loops().every((l) => l.status === "done")
const timeoutMs = live ? 240_000 : 10_000
let stableSince = 0
while (Date.now() - started < timeoutMs) {
  if (done()) {
    stableSince ||= Date.now()
    if (Date.now() - stableSince > 100) break
  } else stableSince = 0
  await new Promise((r) => setTimeout(r, 20))
}
const totalMs = Date.now() - started

// ---- Timeline ----
const SHOWN = new Set([
  "listings.submitted",
  "candidate.found",
  "message_received.started",
  "function_call.started",
  "function_call.completed",
  "model.answer",
  "lease.read",
  "candidate.rejected",
  "candidate.flag_recorded",
  "loop.cancelled",
  "finance.explained",
  "finance.explanation_rejected",
  "finance.failed",
  "lease.extraction_rejected",
  "lease.failed",
  "listing.extraction_rejected",
  "listing.extraction_failed",
  "agent.halted",
])
const names = new Map(rt.service ? [...[user, ...agents, recorder.participant].map((p) => [p.getId(), p.getManifest().name] as const)] : [])
type P = { candidateId?: string; listingIds?: string[]; call?: { name?: string }; name?: string; where?: string; flag?: { rule: string }; cancelledLoops?: { loopKey: string }[]; answer?: { content?: { text?: string } } }
const detail = (e: (typeof recorder.events)[number]): string => {
  const p = e.event.payload as P
  const loop = rt.loopForEvent(e.event)
  switch (e.type) {
    case "listings.submitted":
      return p.listingIds?.join(", ") ?? ""
    case "function_call.started":
      return `${loop?.key ?? ""} calls ${p.call?.name ?? "tool"}`
    case "function_call.completed":
      return `${loop?.key ?? ""} tool result`
    case "model.answer":
      return `${loop?.key ?? ""} ${(p.answer?.content?.text ?? "").startsWith("stopped:") ? "STOPPED (answer replaced)" : "answered"}`
    case "candidate.rejected":
      return `${p.candidateId} rule=${p.flag?.rule} cancels [${(p.cancelledLoops ?? []).map((l) => l.loopKey).join(", ")}]`
    case "loop.cancelled":
      return `${(p as { loopKey?: string }).loopKey} stopped ${p.where}`
    default: {
      const reason = (p as { reason?: string }).reason
      return `${loop?.key ?? p.candidateId ?? ""}${reason ? ` REASON: ${reason}` : ""}`
    }
  }
}
console.log("\n   ms  | agent            | event                        | detail")
console.log("-------+------------------+------------------------------+-------------------------------------------")
let busy = 0
let peak = 0
const tokens = new Map<string, { input: number; output: number }>()
for (const e of recorder.events) {
  if (e.type === "message_received.started") peak = Math.max(peak, ++busy)
  if (e.type === "model.answer") busy--
  if (e.type === "inference.completed") {
    const u = (e.event.payload as { tokenUsage?: { inputTokens: number; outputTokens: number } }).tokenUsage
    const agent = names.get(e.producerId) ?? "?"
    const t = tokens.get(agent) ?? { input: 0, output: 0 }
    tokens.set(agent, { input: t.input + (u?.inputTokens ?? 0), output: t.output + (u?.outputTokens ?? 0) })
  }
  if (!SHOWN.has(e.type)) continue
  console.log(`${String(e.at - started).padStart(6)} | ${(names.get(e.producerId) ?? "?").padEnd(16)} | ${e.type.padEnd(28)} | ${detail(e)}`)
}

// ---- Findings per candidate ----
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 3)}...` : s)
const src = (s: { kind: string; ref: string; clause?: string; field?: string; quote?: string }) =>
  s.quote ? `${s.kind} ${s.ref}${s.clause ? `#${s.clause}` : ""} "${cut(s.quote, 50)}"` : `${s.kind}: ${cut(s.ref, 50)}${s.field ? ` (${s.field})` : ""}`
for (const c of rt.state.candidates.values()) {
  console.log(`\nCandidate ${c.id} - status ${c.status.toUpperCase()}${c.listing.synthetic ? " (SYNTHETIC DEMO DATA)" : ""}`)
  if (c.rejection) console.log(`  HARD FLAG by ${c.rejection.raisedBy}: ${c.rejection.reason}\n    source: ${src(c.rejection.source)}`)
  for (const f of c.laterFlags) console.log(`  also hard (recorded): ${f.reason}`)
  for (const f of rt.state.findings.filter((x) => x.candidateId === c.id)) {
    console.log(`  [${f.severity.padEnd(4)}] ${f.author.padEnd(15)} ${cut(f.claim, 90)}`)
    console.log(`         source: ${src(f.source)}${f.checkBeforeSigning ? ` | check before signing: ${f.checkBeforeSigning}` : ""}`)
  }
}

// ---- Metrics ----
const count = (type: string) => recorder.events.filter((e) => e.type === type).length
console.log("\nRun metrics (from runtime events)")
console.log(`  total time                 ${totalMs} ms${done() ? "" : " (TIMED OUT)"}`)
console.log(`  loops started              ${count("message_received.started")}`)
console.log(`  peak loops in parallel     ${peak}`)
console.log(`  tool calls                 ${count("function_call.started")}`)
console.log(`  candidates rejected        ${count("candidate.rejected")}`)
console.log(`  loops cancelled            ${count("loop.cancelled")}`)
console.log(`  soft flags                 ${rt.state.findings.filter((f) => f.severity === "soft").length}`)
console.log(`  rejected extractions       ${count("listing.extraction_rejected") + count("lease.extraction_rejected") + count("finance.explanation_rejected")}`)
console.log(`  agents halted              ${count("agent.halted")}`)
for (const e of recorder.events.filter((x) => x.type === "loop.cancelled")) {
  const key = (e.event.payload as { loopKey: string }).loopKey
  const start = recorder.events.find((x) => x.type === "message_received.started" && rt.loopForEvent(x.event)?.key === key)
  const ran = start ? e.at - start.at : NaN
  console.log(`  ${key} ran ${ran} ms before it was cut (${(e.event.payload as { where: string }).where})`)
}
for (const c of rt.state.candidates.values()) console.log(`  hard flag on ${c.id}             ${c.rejection ? `YES (${c.rejection.rule})` : "no"}`)
if (live) {
  let total = 0
  for (const [agent, t] of tokens) {
    const usd = (t.input * PRICE.input + t.output * PRICE.output) / 1_000_000
    total += usd
    console.log(`  tokens ${agent.padEnd(19)} ${t.input} in, ${t.output} out, $${usd.toFixed(4)}`)
  }
  console.log(`  cost (estimate)            $${total.toFixed(4)} at $${PRICE.input}/$${PRICE.output} per MTok`)
}
process.exit(0)
