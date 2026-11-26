/**
 * Records the three keyless demo scenarios with the real model (needs ANTHROPIC_API_KEY in .env).
 * Usage: `npm run record:demo` (all three) or `npm run record:demo -- office-beograd`.
 * Each run goes through the same route as the replay (locked questionnaire, same SuiteSpot listings), with a
 * RecordingRunner around the live runner. The result is fixtures/recordings/<scenario>.json, replayed without a key
 * and labelled "Recorded run". Costs about $0.10 per scenario.
 */
import "dotenv/config"
import { mkdirSync, writeFileSync } from "node:fs"
import { DEMO_SCENARIOS, recordingFile, type DemoScenarioId } from "../src/adapters/fixtures/demo-scenarios.js"
import { createLiveRunner } from "../src/adapters/inference/live-runner.js"
import { RecordingRunner } from "../src/adapters/inference/recording-runner.js"
import { LIVE_MODEL } from "../src/adapters/server/research-routes.js"
import { buildServer } from "../src/adapters/server/server.js"

if (!process.env.ANTHROPIC_API_KEY?.trim()) {
  console.error("ANTHROPIC_API_KEY is not set: recording needs the real model.")
  process.exit(1)
}

const wanted = process.argv.slice(2).filter((a) => a in DEMO_SCENARIOS) as DemoScenarioId[]
const scenarios = wanted.length ? wanted : (Object.keys(DEMO_SCENARIOS) as DemoScenarioId[])
mkdirSync("fixtures/recordings", { recursive: true })

for (const scenario of scenarios) {
  const recorder = new RecordingRunner(createLiveRunner())
  const app = await buildServer({ liveRunner: () => recorder, loadRecording: () => null })
  const headers = process.env.SUITESPOT_ACCESS_CODE ? { "x-access-code": process.env.SUITESPOT_ACCESS_CODE } : {}
  const started = await app.inject({ method: "POST", url: "/api/research", headers, payload: { mode: "live", source: "demo", scenario } })
  if (started.statusCode !== 201) throw new Error(`${scenario}: ${started.body}`)
  const { id } = started.json() as { id: string }
  const t0 = Date.now()
  for (;;) {
    const state = (await app.inject({ method: "GET", url: `/api/research/${id}` })).json() as { status: string; metrics?: { costUsd?: number } }
    if (state.status === "done") break
    if (Date.now() - t0 > 360_000) throw new Error(`${scenario}: the run did not finish in 6 minutes`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  const recording = recorder.recording(scenario, LIVE_MODEL)
  writeFileSync(recordingFile(scenario), JSON.stringify(recording, null, 1) + "\n")
  const calls = Object.values(recording.calls).reduce((a, l) => a + l.length, 0)
  console.log(`${scenario}: ${calls} model calls recorded in ${Math.round((Date.now() - t0) / 1000)} s -> ${recordingFile(scenario)}`)
  await app.close()
}
