import { describe, expect, it } from "vitest"
import { AreaM2, Money, compareTypedWithText, missingData, sourced, type Listing, type SourceRef } from "../src/domain/index.js"

const form = (field: string): SourceRef => ({ kind: "listing", ref: "listing-outside", field, form: true })
const quote = (q: string): SourceRef => ({ kind: "listing", ref: "pasted-1", field: "x", quote: q })

const typed = {
  rentMonthly: sourced(Money.of(950, "EUR"), form("rentMonthly")),
  serviceChargeMonthly: sourced(Money.of(60, "EUR"), form("serviceChargeMonthly")),
  deposit: sourced(Money.of(1900, "EUR"), form("deposit")),
  area: sourced(AreaM2.of(58), form("areaM2")),
  city: sourced("Novi Sad", form("city")),
} as unknown as Listing

describe("typed outside listing compared with its pasted text (plain code)", () => {
  it("equal values, rounding and a missing field in the text are not mismatches", () => {
    const read = { ...typed, rentMonthly: sourced(Money.of(950.4, "EUR"), quote("950 EUR")), serviceChargeMonthly: missingData("serviceChargeMonthly"), city: sourced("Novi Sad, Liman", quote("Novi Sad, Liman")) } as unknown as Listing
    expect(compareTypedWithText(typed, read)).toEqual([])
  })

  it("every difference is reported with both sources: the typed field and the quote", () => {
    const read = { ...typed, rentMonthly: sourced(Money.of(1100, "EUR"), quote("Zakupnina 1.100 EUR")), area: sourced(AreaM2.of(52), quote("52 m2")), city: sourced("Beograd", quote("Beograd")) } as unknown as Listing
    const out = compareTypedWithText(typed, read)
    expect(out.map((m) => m.field)).toEqual(["rentMonthly", "area", "city"])
    expect(out[0]!.claim).toBe("The listing text says monthly rent 1,100 EUR, but the typed terms say 950 EUR")
    expect(out[0]!.source).toEqual({ kind: "calc", ref: "typed field compared with the pasted listing text", inputs: [form("rentMonthly"), quote("Zakupnina 1.100 EUR")] })
  })
})
