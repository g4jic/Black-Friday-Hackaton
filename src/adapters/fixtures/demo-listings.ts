import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
  BusinessProfile,
  createLeaseText,
  createRequirement,
  type BusinessProfileInput,
  type LeaseText,
  type ListingTextInput,
  type Requirement,
} from "../../domain/index.js"

export const DEMO_LISTINGS_DIR = "fixtures/listings"
export const DEMO_LEASES_DIR = "fixtures/leases"
export const DEMO_QUESTIONNAIRE_FILE = "fixtures/requirements/demo.json"
export const SCOUT_ANSWERS_FILE = "fixtures/mock-answers/scout.json"
export const LEASE_ANSWERS_FILE = "fixtures/mock-answers/lease-reader.json"

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

/** The synthetic lease drafts (fixtures/leases/lease-<listing id>.txt). */
export function loadDemoLeases(dir = DEMO_LEASES_DIR): LeaseText[] {
  return readdirSync(dir)
    .filter((f) => /^lease-demo-[a-z0-9-]+\.txt$/.test(f))
    .sort()
    .map((f) => createLeaseText(f.replace(/^lease-/, "").replace(/\.txt$/, ""), readFileSync(join(dir, f), "utf8"), true))
}

export function loadLeaseAnswers(file = LEASE_ANSWERS_FILE): Record<string, unknown> {
  return (JSON.parse(readFileSync(file, "utf8")) as { answers: Record<string, unknown> }).answers
}

/** The synthetic demo listings (fixtures/listings/demo-*.txt), as raw text inputs, the same shape as a user paste. */
export function loadDemoListings(dir = DEMO_LISTINGS_DIR): ListingTextInput[] {
  return readdirSync(dir)
    .filter((f) => /^demo-[a-z0-9-]+\.txt$/.test(f))
    .sort()
    .map((f) => ({ id: f.replace(/\.txt$/, ""), text: readFileSync(join(dir, f), "utf8"), synthetic: true }))
}

/** Scripted Scout answers for demo mode, keyed by listing id. */
export function loadScoutAnswers(file = SCOUT_ANSWERS_FILE): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { answers: Record<string, unknown> }
  return parsed.answers
}
