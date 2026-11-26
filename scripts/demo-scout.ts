/**
 * Runs the Scout once and prints what happened: the event timeline, the fields extracted per candidate with their
 * source quote (or MissingData), and run metrics computed from the runtime events.
 *
 * PowerShell:
 *   npm run demo:scout                  # keyless: MockRunner over the 8 synthetic demo listings
 *   npm run demo:scout -- --live        # claude-haiku-4-5 over demo-01 and demo-03 (needs ANTHROPIC_API_KEY in .env)
 *   npm run demo:scout -- --live --ids demo-01,demo-02
 * The key is read from .env and never printed.
 */
import "dotenv/config"
import { DefaultInferenceRunner, createHuman, supportedModels, type InferenceRunner } from "@mozaik-ai/core"
import { loadDemoListings, loadScoutAnswers } from "../src/adapters/fixtures/demo-listings.js"
import { MockRunner } from "../src/adapters/inference/mock-runner.js"
import { scoutDemoScript } from "../src/adapters/inference/scripts/scout-script.js"
import { createScout, submitListings } from "../src/application/agents/scout.js"
import { createRecorder } from "../src/application/observers/recorder.js"
import { installProcessGuards } from "../src/application/resilience/process-guards.js"
import { createAppRuntime } from "../src/application/runtime.js"
import { AreaM2, LISTING_FIELDS, Money, isMissingData } from "../src/domain/index.js"

const LIVE_MODEL = "claude-haiku-4-5"
const args = process.argv.slice(2)
const live = args.includes("--live")
const idsArg = args.find((a) => a.startsWith("--ids"))?.split("=")[1] ?? (args.includes("--ids") ? args[args.indexOf("--ids") + 1] : undefined)
const ids = idsArg ? idsArg.split(",") : live ? ["demo-01", "demo-03"] : null

if (live && !process.env.ANTHROPIC_API_KEY) {
  console.error("Live mode needs ANTHROPIC_API_KEY in .env")
  process.exit(1)
}

installProcessGuards()

/** Mozaik's own runner for live mode. Its request validator is not exported, so we pass a minimal one. */
function liveRunner(): InferenceRunner {
  const validator = {
    validate(input: { structuredOutput?: unknown }, model: { name: string; supportsStructuredOutput?: boolean }) {
      if (input.structuredOutput && !model.supportsStructuredOutput) throw new Error(`Model ${model.name} has no structured output`)
    },
  }
  return new DefaultInferenceRunner(supportedModels, validator as unknown as ConstructorParameters<typeof DefaultInferenceRunner>[1])
}

const listings = loadDemoListings().filter((l) => !ids || ids.includes(l.id!))
// Mock mode: a deterministic latency per listing, so loops visibly finish at different times.
const mockLatency = (id: string) => 60 + ((Number(id.replace(/\D/g, "")) * 53) % 200)

const rt = createAppRuntime({
  runner: live ? liveRunner() : new MockRunner({ script: scoutDemoScript(loadScoutAnswers(), { latencyMs: mockLatency }) }),
  maxParallelInference: 8,
  resilience: live ? { retries: 2, baseDelayMs: 1000 } : { retries: 0 },
})
const recorder = createRecorder()
const user = createHuman({ name: "User", capabilities: [], handlers: [] })
const scout = createScout(rt, { model: live ? LIVE_MODEL : "mock" })
for (const p of [recorder.participant, user, scout]) rt.join(p)

console.log(`\nSuiteSpot Scout demo - ${live ? `LIVE model ${LIVE_MODEL}` : "MOCK (keyless)"} - ${listings.length} listing(s): ${listings.map((l) => l.id).join(", ")}`)
const started = Date.now()
submitListings(rt, listings, user.getId())

const done = () => rt.state.candidates.size + rt.state.failedListings.length >= listings.length
const timeoutMs = live ? 180_000 : 10_000
while (!done() && Date.now() - started < timeoutMs) await new Promise((r) => setTimeout(r, 25))
const totalMs = Date.now() - started

// ---- Event timeline ----
const SHOWN = new Set([
  "listings.submitted",
  "message_received.started",
  "inference.started",
  "inference.completed",
  "model.answer",
  "candidate.found",
  "listing.extraction_rejected",
  "listing.extraction_failed",
  "agent.halted",
])
type P = { candidateId?: string; listingId?: string; listingIds?: string[]; tokenUsage?: { inputTokens: number; outputTokens: number } }
const listingOf = (e: (typeof recorder.events)[number]): string => {
  const p = e.event.payload as P
  if (p.candidateId) return p.candidateId
  if (p.listingId) return p.listingId
  if (p.listingIds) return p.listingIds.join(",")
  const key = rt.loopForEvent(e.event)?.key
  return key ? key.replace(/^scout:/, "").replace(/:(\d+)$/, " (attempt $1)") : "-"
}

console.log("\n  ms  | event                         | listing")
console.log("------+-------------------------------+--------------------------")
let busy = 0
let peak = 0
let inputTokens = 0
let outputTokens = 0
for (const e of recorder.events) {
  if (e.type === "message_received.started") peak = Math.max(peak, ++busy)
  if (e.type === "model.answer") busy--
  if (e.type === "inference.completed") {
    const usage = (e.event.payload as P).tokenUsage
    inputTokens += usage?.inputTokens ?? 0
    outputTokens += usage?.outputTokens ?? 0
  }
  if (!SHOWN.has(e.type)) continue
  console.log(`${String(e.at - started).padStart(5)} | ${e.type.padEnd(29)} | ${listingOf(e)}`)
}

// ---- Extracted fields per candidate ----
const show = (v: unknown): string => (v instanceof Money ? `${v.amount} ${v.currency}` : v instanceof AreaM2 ? `${v.value} m2` : String(v))
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 3)}...` : s)
for (const c of rt.state.candidates.values()) {
  console.log(`\nCandidate ${c.id}${c.listing.synthetic ? " (SYNTHETIC DEMO DATA)" : ""}`)
  for (const f of LISTING_FIELDS) {
    const field = c.listing[f.name]
    if (isMissingData(field)) {
      console.log(`  ${f.name.padEnd(21)} MissingData`)
    } else {
      console.log(`  ${f.name.padEnd(21)} ${cut(show(field.value), 34).padEnd(34)} source: ${field.source.kind} ${field.source.ref}, quote "${cut(field.source.quote ?? "", 60)}"`)
    }
  }
}
for (const f of rt.state.failedListings) console.log(`\nFAILED ${f.listingId} after ${f.attempts} attempts: ${f.reason}`)
const halted = new Set(recorder.events.filter((e) => e.type === "agent.halted").map((e) => String((e.event.payload as { reason?: string }).reason)))
for (const reason of halted) console.log(`\nAGENT HALTED (provider error): ${cut(reason, 600)}`)

// ---- Metrics (all computed from runtime events) ----
const count = (type: string) => recorder.events.filter((e) => e.type === type).length
const rejected = count("listing.extraction_rejected")
const retries = rt.loops().filter((l) => /:(\d+)$/.exec(l.key)?.[1] !== "1").length
console.log("\nRun metrics")
console.log(`  total time                 ${totalMs} ms${done() ? "" : " (TIMED OUT)"}`)
console.log(`  loops started              ${count("message_received.started")}`)
console.log(`  peak loops in parallel     ${peak}`)
console.log(`  candidates found           ${count("candidate.found")}`)
console.log(`  extractions rejected       ${rejected}`)
console.log(`  retries                    ${retries}`)
console.log(`  failed listings            ${rt.state.failedListings.length}`)
console.log(`  agents halted              ${count("agent.halted")}`)
if (live) console.log(`  tokens                     ${inputTokens} in, ${outputTokens} out`)
process.exit(0)
