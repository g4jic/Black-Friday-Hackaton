import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { LOCAL_LANDLORD, LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import type { ListingActor } from "../src/application/listings/listing-store.js"
import {
  DomainError,
  ListingValidationError,
  SpaceListing,
  createListingContact,
  floorLabel,
  maskPhone,
  validateListingInput,
  type SpaceListingInput,
} from "../src/domain/index.js"

const input = (patch: Partial<SpaceListingInput> = {}): SpaceListingInput => ({
  title: "Lokal 60 m2 na Limanu",
  city: "Novi Sad",
  district: "Liman 3",
  street: "Bulevar despota Stefana",
  areaM2: 60,
  floor: 0,
  rentMonthly: 900,
  serviceChargeMonthly: 50,
  deposit: 1800,
  minimumTermMonths: 24,
  earlyTermination: { allowed: true, noticeMonths: 3 },
  indexation: { kind: "cpi" },
  permittedUses: ["cafe_food", "retail"],
  tenantPaysStructuralRepairs: false,
  ...patch,
})
const contact = { phone: "+381 64 123 45 67", email: "Pera@Example.com", consentToPublish: true }
const problemsOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(ListingValidationError)
    return (e as ListingValidationError).problems.map((p) => p.field)
  }
  throw new Error("expected a ListingValidationError")
}

describe("SpaceListing (domain rules)", () => {
  it("accepts a complete listing and trims the text fields", () => {
    const clean = validateListingInput(input({ title: "  Lokal 60 m2 na Limanu  ", description: "   " }))
    expect(clean.title).toBe("Lokal 60 m2 na Limanu")
    expect(clean.description).toBeNull()
  })
  it("names every missing or wrong field at once", () => {
    const fields = problemsOf(() =>
      validateListingInput({ ...input(), title: "", city: "Niš", areaM2: 0, rentMonthly: Number.NaN, floor: 1.5, permittedUses: [], earlyTermination: { allowed: true, noticeMonths: -1 } }),
    )
    expect(fields).toEqual(["title", "city", "areaM2", "floor", "rentMonthly", "earlyTermination.noticeMonths", "permittedUses"])
  })
  it("a fixed indexation needs its rate; a locked lease needs no notice", () => {
    expect(problemsOf(() => validateListingInput(input({ indexation: { kind: "fixed_rate" } as never })))).toEqual(["indexation.ratePercent"])
    expect(validateListingInput(input({ earlyTermination: { allowed: false } })).earlyTermination).toEqual({ allowed: false })
  })
  it("the image link must be plain http(s)", () => {
    expect(problemsOf(() => validateListingInput(input({ imageUrl: "javascript:alert(1)" })))).toEqual(["imageUrl"])
    expect(validateListingInput(input({ imageUrl: "https://example.com/a.jpg" })).imageUrl).toBe("https://example.com/a.jpg")
  })
  it("only the owner can change it", () => {
    const listing = SpaceListing.create(input(), { id: "listing-a1", ownerId: "owner-1", now: "2026-11-26T20:00:00Z" })
    expect(() => listing.update(input(), "someone-else", "2026-11-26T21:00:00Z")).toThrow(DomainError)
    expect(listing.update(input({ rentMonthly: 950 }), "owner-1", "2026-11-26T21:00:00Z").props).toMatchObject({ rentMonthly: 950, updatedAt: "2026-11-26T21:00:00Z" })
  })
})

describe("ListingContact", () => {
  it("needs consent and at least one channel; normalises the email", () => {
    expect(problemsOf(() => createListingContact("listing-a1", "Pera", { consentToPublish: false }))).toEqual(["contact", "contact.consentToPublish"])
    expect(problemsOf(() => createListingContact("listing-a1", "Pera", { phone: "12345", consentToPublish: true }))).toEqual(["contact.phone"])
    expect(createListingContact("listing-a1", "Pera", contact)).toEqual({ listingId: "listing-a1", name: "Pera", phone: "+381 64 123 45 67", email: "pera@example.com" })
  })
  it("masks a demo phone and labels floors", () => {
    expect(maskPhone("+381 64 123 45 67")).toBe("+381 64 *** ** 67")
    expect(floorLabel(0)).toBe("ground floor")
    expect(floorLabel(-1)).toBe("basement")
    expect(floorLabel(2)).toBe("floor 2")
  })
})

describe("LocalListingStore", () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })
  const demoOwner = "demo-owner-1"
  const seeded = SpaceListing.create(input({ title: "Demo lokal na Grbavici" }), { id: "listing-seed1", ownerId: demoOwner, isDemo: true, now: "2026-11-01T00:00:00Z" })
  const seed = { listings: [seeded], contacts: [createListingContact("listing-seed1", "Demo Owner", contact)] }

  it("create, edit, delete for the owner; the contact goes with the listing; data survives a restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "suitespot-"))
    dirs.push(dir)
    const file = join(dir, "listings.json")
    const store = new LocalListingStore({ seed, file })
    const mine = await store.create(LOCAL_LANDLORD, input(), contact)
    expect(mine.id).toMatch(/^listing-[a-z0-9]{12}$/)
    expect((await store.listPublished()).map((l) => l.id)).toEqual([mine.id, "listing-seed1"])
    expect((await store.listByOwner(LOCAL_LANDLORD)).map((l) => l.id)).toEqual([mine.id])
    await store.update(LOCAL_LANDLORD, mine.id, input({ rentMonthly: 1000 }), { email: "novi@example.com", consentToPublish: true })
    expect((await store.revealContact(mine.id))?.phone).toBeNull()

    const reopened = new LocalListingStore({ seed, file })
    expect((await reopened.get(mine.id))?.props.rentMonthly).toBe(1000)
    await reopened.delete(LOCAL_LANDLORD, mine.id)
    expect(await reopened.get(mine.id)).toBeNull()
    expect(await reopened.revealContact(mine.id)).toBeNull()
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ listings: [], contacts: [], views: {}, saved: {} })
  })

  it("nobody else can change or delete a listing, and listing reads never carry the contact", async () => {
    const store = new LocalListingStore({ seed, file: null })
    const stranger: ListingActor = { id: "stranger", displayName: "Stranger", kind: "local" }
    await expect(store.update(stranger, "listing-seed1", input(), contact)).rejects.toMatchObject({ code: "not_listing_owner" })
    await expect(store.delete(LOCAL_LANDLORD, "listing-seed1")).rejects.toMatchObject({ code: "not_listing_owner" })
    await expect(store.ownContact(stranger, "listing-seed1")).rejects.toMatchObject({ code: "not_listing_owner" })
    await expect(store.delete(LOCAL_LANDLORD, "listing-nope")).rejects.toMatchObject({ code: "listing_not_found" })
    expect(JSON.stringify(await store.listPublished())).not.toContain("123 45 67")
    expect((await store.revealContact("listing-seed1"))?.name).toBe("Demo Owner")
  })
})
