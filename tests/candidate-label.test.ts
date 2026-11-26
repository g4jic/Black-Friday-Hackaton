import { describe, expect, it } from "vitest"
import { candidateLocation, candidateShortName } from "../web/src/candidate-label.js"
import type { CandidateDTO } from "../web/src/types.js"

const candidate = (fields: CandidateDTO["fields"]): CandidateDTO => ({
  id: "demo-01",
  synthetic: true,
  listingUrl: null,
  status: "scored",
  hasLease: false,
  fields,
  unverified: [],
  rejection: null,
  laterFlags: [],
  findings: [],
  ranking: null,
})
const text = (value: string) => ({ value: { kind: "text" as const, value } })

describe("candidate labels (only from extracted fields)", () => {
  it("neighbourhood plus area, without the city", () => {
    const c = candidate({ city: text("Novi Sad"), address: text("Liman 2, ulica Narodnog fronta"), area: { value: { kind: "area", m2: 72 } } })
    expect(candidateShortName(c, 1)).toBe("Liman 2 · 72 m2")
    expect(candidateLocation(c)).toBe("Liman 2, Novi Sad")
    expect(candidateShortName(candidate({ address: text("Novi Sad, Podbara"), city: text("Novi Sad") }), 6)).toBe("Podbara")
  })
  it("falls back to the listing number, never an invented name", () => {
    expect(candidateShortName(undefined, 3)).toBe("Listing 3")
    expect(candidateShortName(candidate({}), 4)).toBe("Listing 4")
  })
})
