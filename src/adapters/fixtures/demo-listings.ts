import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { ListingTextInput } from "../../domain/index.js"

export const DEMO_LISTINGS_DIR = "fixtures/listings"
export const SCOUT_ANSWERS_FILE = "fixtures/mock-answers/scout.json"

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
