import { readFileSync } from "node:fs"
import { BusinessProfile, createRequirement, type BusinessProfileInput, type Requirement } from "../../domain/index.js"

export const DEMO_QUESTIONNAIRE_FILE = "fixtures/requirements/demo.json"

/** The fixed demo questionnaire (instead of an Interviewer agent for now), validated by the domain. */
export function loadDemoQuestionnaire(file = DEMO_QUESTIONNAIRE_FILE): { profile: BusinessProfile; requirements: Requirement[] } {
  const raw = JSON.parse(readFileSync(file, "utf8")) as {
    profile: BusinessProfileInput
    requirements: { id: string; text: string; hard: boolean; aspect: Requirement["aspect"]; field: string }[]
  }
  return {
    profile: BusinessProfile.create(raw.profile),
    requirements: raw.requirements.map((r) => createRequirement({ id: r.id, text: r.text, hard: r.hard, aspect: r.aspect, source: { kind: "profile", ref: "questionnaire", field: r.field } })),
  }
}
