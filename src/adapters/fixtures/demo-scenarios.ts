import { existsSync, readFileSync } from "node:fs"
import type { Recording } from "../inference/recording-runner.js"
import { loadDemoQuestionnaire } from "./demo-questionnaire.js"

/** The three keyless demo scenarios: a locked questionnaire each, replayed from a recorded real run when one exists. */
export const DEMO_SCENARIOS = {
  "cafe-novi-sad": { title: "Cafe in Novi Sad", questionnaire: "fixtures/requirements/demo.json" },
  "office-beograd": { title: "Office in Beograd", questionnaire: "fixtures/requirements/office-beograd.json" },
  "shop-novi-sad": { title: "Shop in Novi Sad", questionnaire: "fixtures/requirements/shop-novi-sad.json" },
} as const

export type DemoScenarioId = keyof typeof DEMO_SCENARIOS
export const DEFAULT_SCENARIO: DemoScenarioId = "cafe-novi-sad"

export const isScenario = (x: unknown): x is DemoScenarioId => typeof x === "string" && x in DEMO_SCENARIOS

export const recordingFile = (id: DemoScenarioId) => `fixtures/recordings/${id}.json`

export function loadScenario(id: DemoScenarioId) {
  return loadDemoQuestionnaire(DEMO_SCENARIOS[id].questionnaire)
}

/** The recorded real run of a scenario, or null when it was not recorded yet. */
export function loadRecording(id: DemoScenarioId): Recording | null {
  const file = recordingFile(id)
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Recording) : null
}
