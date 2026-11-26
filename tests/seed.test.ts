import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { generateSeed } from "../src/adapters/seed/generate-listings.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"

const seed = generateSeed()
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16)

describe("synthetic seed (100 listings, 100 demo landlords)", () => {
  it("is deterministic and frozen: the same fingerprint on every run", () => {
    expect(fingerprint(generateSeed())).toBe(fingerprint(seed))
    // Pinned. If this changes, the catalogue changed: the seed is frozen after approval.
    expect(fingerprint(seed)).toBe("4257c4ac88fbeb0c")
  })

  it("50 Novi Sad + 50 Beograd, unique ids, every listing passes the same rules as the form", () => {
    const { listings, contacts } = seedCatalogue(seed)
    expect(listings).toHaveLength(100)
    expect(listings.filter((l) => l.props.city === "Novi Sad")).toHaveLength(50)
    expect(new Set(listings.map((l) => l.id)).size).toBe(100)
    expect(listings.every((l) => l.props.isDemo && l.props.published)).toBe(true)
    expect(contacts).toHaveLength(100)
    for (const l of listings) expect(l.props.areaM2).toBeGreaterThanOrEqual(20), expect(l.props.areaM2).toBeLessThanOrEqual(300)
  })

  it("prices per m2 sit on the approved targets: median about 10 EUR in Novi Sad and 16 to 17 EUR in Beograd", () => {
    const median = (city: string) => {
      const xs = seed.listings.filter((l) => l.input.city === city).map((l) => l.input.rentMonthly / l.input.areaM2).sort((a, b) => a - b)
      return (xs[24]! + xs[25]!) / 2
    }
    expect(median("Novi Sad")).toBeGreaterThan(9.5)
    expect(median("Novi Sad")).toBeLessThan(10.5)
    expect(median("Beograd")).toBeGreaterThan(15.5)
    expect(median("Beograd")).toBeLessThan(17.5)
  })

  it("about 70% have a lease draft, and bad terms and missing data are in there on purpose", () => {
    const withDraft = seed.listings.filter((l) => l.input.leaseDraft).length
    expect(withDraft).toBeGreaterThanOrEqual(60)
    expect(withDraft).toBeLessThanOrEqual(80)
    const count = (trait: string) => seed.listings.filter((l) => l.traits.includes(trait as never)).length
    for (const trait of ["locked_in_without_exit", "unlimited_rent_increase", "tenant_pays_structural_repairs", "long_notice", "draft_missing_clauses", "draft_differs_from_form", "no_description"]) {
      expect(count(trait), trait).toBeGreaterThan(0)
    }
  })

  it("every lease quote is in its draft, and every draft is labelled synthetic", () => {
    for (const l of seed.listings) {
      if (!l.input.leaseDraft) {
        expect(l.leaseQuotes).toBeNull()
        continue
      }
      expect(l.input.leaseDraft.startsWith("SYNTHETIC DEMO DATA")).toBe(true)
      for (const quote of Object.values(l.leaseQuotes!)) expect(l.input.leaseDraft).toContain(quote)
    }
  })

  it("demo landlords: unique example.com emails, phones in +381 6x format, no house numbers", () => {
    expect(seed.owners).toHaveLength(100)
    expect(new Set(seed.owners.map((o) => o.email)).size).toBe(100)
    expect(seed.owners.every((o) => /^[a-z]+\.[a-z]+\d*@example\.com$/.test(o.email))).toBe(true)
    for (const l of seed.listings) {
      if (l.contact.phone) expect(l.contact.phone).toMatch(/^\+381 6\d \d{3} \d{2} \d{2}$/)
      expect(l.contact.phone || l.contact.email).toBeTruthy()
      expect(l.input.street).not.toMatch(/\d/)
    }
  })
})
