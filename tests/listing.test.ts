import { describe, expect, it } from "vitest"
import { loadDemoListings, loadScoutAnswers } from "../src/adapters/fixtures/demo-listings.js"
import {
  DomainError,
  EMAIL_PLACEHOLDER,
  PHONE_PLACEHOLDER,
  buildListing,
  createListingBatch,
  isMissingData,
  numbersIn,
  redactContacts,
  validateSource,
} from "../src/domain/index.js"

function expectDomainError(fn: () => unknown, code: string, messagePart?: string) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe(code)
    if (messagePart) expect((error as DomainError).message).toContain(messagePart)
    return
  }
  throw new Error(`Expected DomainError "${code}"`)
}

const [demo01] = createListingBatch([{ id: "demo-01", text: loadDemoListings().find((l) => l.id === "demo-01")!.text, synthetic: true }])
const goodAnswer = () => structuredClone(loadScoutAnswers()["demo-01"]) as Record<string, Record<string, unknown>>

describe("contact removal (before anything else sees the text)", () => {
  it("removes Serbian-style phone numbers and emails", () => {
    const raw = [
      "Pozovite +381 64 123 4567 ili 064/765-4321, fiksni 021 456 789.",
      "Viber: +381651112222, mail: pera.peric@example.com",
      "Kancelarija: 011-222-3333",
    ].join("\n")
    const { text, phones, emails } = redactContacts(raw)
    expect(phones).toBe(5)
    expect(emails).toBe(1)
    expect(text).not.toMatch(/\d{3}[ /-]?\d{3,4}/)
    expect(text).not.toContain("@")
    expect(text).toContain(PHONE_PLACEHOLDER)
    expect(text).toContain(EMAIL_PLACEHOLDER)
  })
  it("leaves prices, areas, dates and years alone", () => {
    const raw = "Cena: 1.250 € mesečno, kirija 1 050 eur, 85 m2, 72,5 m2, slobodan od 01.12.2026, renoviran 2025. godine, depozit 2.500 EUR"
    const result = redactContacts(raw)
    expect(result).toEqual({ text: raw, phones: 0, emails: 0 })
  })
  it("the demo fixtures carry the synthetic label and contain no contacts", () => {
    const fixtures = loadDemoListings()
    expect(fixtures).toHaveLength(8)
    for (const f of fixtures) {
      expect(f.text.startsWith("SYNTHETIC DEMO DATA")).toBe(true)
      expect(redactContacts(f.text)).toMatchObject({ phones: 0, emails: 0 })
    }
  })
})

describe("listing batch (mode A takes 1 to 8 listings)", () => {
  it("rejects an empty run and more than 8 listings", () => {
    expectDomainError(() => createListingBatch([]), "invalid_listing_batch")
    expectDomainError(() => createListingBatch(Array.from({ length: 9 }, () => ({ text: "lokal" }))), "invalid_listing_batch")
  })
  it("rejects empty texts and duplicate ids, numbers pasted listings pasted-1..n", () => {
    expectDomainError(() => createListingBatch([{ text: "  " }]), "invalid_listing_batch")
    expectDomainError(() => createListingBatch([{ id: "demo-1", text: "a" }, { id: "demo-1", text: "b" }]), "invalid_listing_batch")
    expect(createListingBatch([{ text: "a" }, { text: "b" }]).map((t) => t.id)).toEqual(["pasted-1", "pasted-2"])
  })
})

describe("listing source and quotes", () => {
  it("a listing text source needs a quote; a URL source does not", () => {
    expectDomainError(() => validateSource({ kind: "listing", ref: "pasted-1", field: "rentMonthly" }), "invalid_source", "must carry a quote")
    expect(validateSource({ kind: "listing", ref: "pasted-1", field: "rentMonthly", quote: "900e" }).quote).toBe("900e")
    expect(validateSource({ kind: "listing", ref: "https://example.test/l/1" }).ref).toBe("https://example.test/l/1")
  })
  it("reads Serbian number formats from a quote", () => {
    expect(numbersIn("Cena: 1.250 € mesečno")).toContain(1250)
    expect(numbersIn("kirija 1 050 eur")).toContain(1050)
    expect(numbersIn("72,5 m2")).toContain(72.5)
    expect(numbersIn("58m2 u prizemlju")).toContain(58)
  })
})

describe("buildListing: plain code checks every value against the listing text", () => {
  it("accepts the scripted answer and keeps the quote as the source", () => {
    const listing = buildListing(demo01!, JSON.stringify(goodAnswer()))
    expect(listing.rentMonthly).toMatchObject({ source: { kind: "listing", ref: "demo-01", field: "rentMonthly", quote: "Cena: 1.250 € mesečno" } })
    expect(isMissingData(listing.rentMonthly)).toBe(false)
  })
  it("rejects a value without a source (no quote)", () => {
    const answer = goodAnswer()
    answer.rentMonthly = { found: true, amount: 1250, currency: "EUR", quote: null }
    expectDomainError(() => buildListing(demo01!, answer), "value_without_source", "rentMonthly: value has no quote")
  })
  it("rejects a quote that is not in the text (an invented source)", () => {
    const answer = goodAnswer()
    answer.deposit = { found: true, amount: 1000, currency: "EUR", quote: "Depozit: 1.000 €" }
    expectDomainError(() => buildListing(demo01!, answer), "invalid_extraction", "does not appear in the text")
  })
  it("rejects a number that does not match its own quote", () => {
    const answer = goodAnswer()
    answer.area = { found: true, value: 75, quote: "Površina: 72 m2" }
    expectDomainError(() => buildListing(demo01!, answer), "invalid_extraction", "value 75 does not appear in its quote")
  })
  it("rejects found=false with a value, and invalid JSON", () => {
    const answer = goodAnswer()
    answer.floor = { found: false, value: "prizemlje", quote: null }
    expectDomainError(() => buildListing(demo01!, answer), "invalid_extraction", "found is false but a value is given")
    expectDomainError(() => buildListing(demo01!, "Inference failed: timeout"), "invalid_extraction", "not valid JSON")
  })
  it("every scripted demo answer passes the same checks against its fixture", () => {
    const answers = loadScoutAnswers()
    for (const text of createListingBatch(loadDemoListings())) {
      expect(() => buildListing(text, answers[text.id])).not.toThrow()
    }
  })
})
