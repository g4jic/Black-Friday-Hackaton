import { describe, expect, it } from "vitest"
import { DomainError, PREMISES_CONCERN_RULES, buildPremises, evaluatePremises, validateSource, type PremisesTexts } from "../src/domain/index.js"

const texts: PremisesTexts = {
  listingRef: "listing-01",
  listingText: "Lokal u prizemlju sa izlogom ka ulici. Grejanje: centralno. Potrebno renoviranje. Ulaz bez stepenika.",
  leaseId: "lease-listing-01",
  leaseText: "Zakupac moze ugraditi ventilaciju za kuhinju o svom trosku.",
}
const notFound = { found: false }
const answer = (patch: Record<string, unknown> = {}) => ({
  floor: { found: true, value: "ground", quote: "Lokal u prizemlju" },
  storefront: { found: true, value: true, quote: "sa izlogom ka ulici" },
  parking: notFound,
  heating: { found: true, value: "centralno", quote: "Grejanje: centralno" },
  kitchenVentilation: notFound,
  waterAndDrain: notFound,
  needsRenovation: { found: true, value: true, quote: "Potrebno renoviranje" },
  stepFreeAccess: { found: true, value: true, quote: "Ulaz bez stepenika" },
  ...patch,
})

describe("Premises (domain, plain code)", () => {
  it("every stated value carries a quote from the listing or the lease draft; what is not stated is missing data", () => {
    const f = buildPremises("listing-01", texts, answer({ kitchenVentilation: { found: true, value: true, quote: "ugraditi ventilaciju za kuhinju" } }))
    expect(validateSource((f.floor as { source: unknown }).source)).toMatchObject({ kind: "listing", ref: "listing-01", field: "floor" })
    expect(validateSource((f.kitchenVentilation as { source: unknown }).source)).toMatchObject({ kind: "lease", ref: "lease-listing-01", clause: "kitchenVentilation" })
    expect("missing" in (f.parking as object)).toBe(true)
  })

  it("a quote that is not in the text is rejected (the model cannot invent a feature)", () => {
    expect(() => buildPremises("listing-01", texts, answer({ parking: { found: true, value: true, quote: "Parking za 10 automobila" } }))).toThrow(DomainError)
  })

  it("code decides what suits the business: a cafe needing renovation gets a soft flag; unknown checks widen the range", () => {
    const r = evaluatePremises(buildPremises("listing-01", texts, answer()), "cafe_food")
    expect(r.concerns.map((c) => c.rule)).toEqual(["premises_no_renovation"])
    expect(r.unknown).toEqual(["kitchenVentilation", "waterAndDrain"])
    expect(r.score).toBeLessThan(r.scoreHigh)
    expect(r.total).toBe(6)
    for (const c of r.concerns) expect(PREMISES_CONCERN_RULES).toContain(c.rule)
  })

  it("the same facts are judged per type of business (an office does not need a storefront or ventilation)", () => {
    const office = evaluatePremises(buildPremises("listing-01", texts, answer()), "office_studio")
    expect(office.total).toBe(3)
    expect(office.unknown).toEqual(["parking"])
    expect(office.parts.map((p) => p.name)).toEqual(["no_renovation", "heating_stated"])
  })
})
