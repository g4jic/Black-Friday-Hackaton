import { describe, expect, it } from "vitest"
import { candidateLocation, candidateShortName, withCandidateNames } from "../web/src/candidate-label.js"
import type { CandidateDTO } from "../web/src/types.js"

const candidate = (fields: CandidateDTO["fields"]): CandidateDTO => ({
  id: "listing-01",
  synthetic: true,
  listingUrl: null,
  status: "scored",
  hasLease: false,
  fields,
  unverified: [],
  rejection: null,
  laterFlags: [],
  findings: [],
  premises: null,
  ranking: null,
})
const text = (value: string) => ({ value: { kind: "text" as const, value } })

describe("candidate labels (only from extracted fields)", () => {
  it("neighbourhood plus area, without the city", () => {
    const c = candidate({ city: text("Novi Sad"), address: text("Liman 2, ulica Narodnog fronta"), area: { value: { kind: "area", m2: 72 } } })
    expect(candidateShortName(c, 1)).toBe("Liman 2 · 72 m2")
    expect(candidateLocation(c)).toBe("Liman 2, Novi Sad")
    expect(candidateShortName(candidate({ address: text("Novi Sad, Podbara"), city: text("Novi Sad") }), 6)).toBe("Podbara · area unknown")
  })
  it("falls back to the listing number, never an invented name", () => {
    expect(candidateShortName(undefined, 3)).toBe("Listing 3")
    expect(candidateShortName(candidate({}), 4)).toBe("Listing 4")
  })
})

describe("candidate names in report text (the screen only; the audit keeps the ids)", () => {
  const names: Record<string, string> = { "listing-ns032": "Grbavica · 85 m2", "listing-ns024": "Detelinara · 69 m2" }
  const nameOf = (id: string) => names[id] ?? null

  it("replaces every known id, also when a sentence starts with a capital letter", () => {
    expect(withCandidateNames("Listing-ns032 scores 95 out of 100.", nameOf)).toBe("Grbavica · 85 m2 scores 95 out of 100.")
    expect(withCandidateNames("listing-ns024 was rejected; listing-ns032 was not.", nameOf)).toBe("Detelinara · 69 m2 was rejected; Grbavica · 85 m2 was not.")
  })

  it("leaves numbers and unknown ids as they are, so nothing is hidden", () => {
    expect(withCandidateNames("Listing-ns099 costs 920 EUR.", nameOf)).toBe("Listing-ns099 costs 920 EUR.")
    expect(withCandidateNames("820 EUR at 55% of the budget.", nameOf)).toBe("820 EUR at 55% of the budget.")
  })
})
