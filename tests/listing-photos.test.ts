import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { buildServer } from "../src/adapters/server/server.js"
import { LocalImageStore } from "../src/adapters/storage/image-store.js"
import { LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import { photoColumnToProps, photoPropsToColumn } from "../src/adapters/storage/supabase-listing-store.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { LISTING_LIMITS, ListingValidationError, SpaceListing, type SpaceListingInput } from "../src/domain/index.js"

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16])
const tmp = mkdtempSync(join(tmpdir(), "suitespot-listing-photos-"))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

const INPUT: SpaceListingInput = {
  title: "Lokal 60 m2 na Limanu", city: "Novi Sad", district: "Liman 3", street: "Bulevar cara Lazara", areaM2: 60, floor: 0,
  rentMonthly: 900, serviceChargeMonthly: 50, deposit: 1800, minimumTermMonths: 24, earlyTermination: { allowed: true, noticeMonths: 3 },
  indexation: { kind: "cpi" }, permittedUses: ["cafe_food"], tenantPaysStructuralRepairs: false,
}
const STORAGE = "https://abc.supabase.co/storage/v1/object/public/listing-photos"
const photo = (i: number) => `${STORAGE}/local-${"a".repeat(36)}-${String(i).padStart(36, "0")}?v=1795811134390`
const create = (photos: unknown) => SpaceListing.create({ ...INPUT, photos: photos as string[] }, { id: "listing-p1", ownerId: "owner-1", now: "2026-11-27T22:00:00.000Z" })
const problemsOf = (photos: unknown) => {
  try {
    create(photos)
    return []
  } catch (error) {
    return (error as ListingValidationError).problems.map((p) => p.field)
  }
}

describe("listing photos: domain rule", () => {
  it("keeps up to six photo addresses in order, the cover first; none is an empty list", () => {
    const six = Array.from({ length: LISTING_LIMITS.photosMax }, (_, i) => photo(i))
    expect(create(six).props.photos).toEqual(six)
    expect(create(["/api/listing-photos/local-1-abc?v=1"]).props.photos).toEqual(["/api/listing-photos/local-1-abc?v=1"])
    expect(create(undefined).props.photos).toEqual([])
  })

  it("refuses a seventh photo, a script or protocol-relative address, spaces and the same photo twice", () => {
    expect(problemsOf(Array.from({ length: 7 }, (_, i) => photo(i)))).toEqual(["photos"])
    expect(problemsOf(["javascript:alert(1)"])).toEqual(["photos"])
    expect(problemsOf(["//evil.example/x.jpg"])).toEqual(["photos"])
    expect(problemsOf([`${photo(1)} ${photo(2)}`])).toEqual(["photos"])
    expect(problemsOf([photo(1), photo(1)])).toEqual(["photos"])
  })
})

describe("listing photos: Supabase keeps them in the image_url column", () => {
  it("six uploaded photos fit in one value and come back in order; an older image link stays a link", () => {
    const six = Array.from({ length: 6 }, (_, i) => photo(i))
    const column = photoPropsToColumn({ imageUrl: null, photos: six })!
    expect(column.length).toBeLessThanOrEqual(LISTING_LIMITS.urlMax)
    expect(photoColumnToProps(column)).toEqual({ imageUrl: null, photos: six })
    expect(photoColumnToProps("https://example.com/space.jpg")).toEqual({ imageUrl: "https://example.com/space.jpg", photos: [] })
    expect(photoColumnToProps(null)).toEqual({ imageUrl: null, photos: [] })
  })
})

describe("listing photos: upload and show", () => {
  it("a signed-in owner uploads a photo, publishes a listing with it and everyone sees it; a guest cannot upload", async () => {
    const app = await buildServer({
      auth: null,
      localAccountsFile: null,
      listingPhotoStore: new LocalImageStore(tmp, "/api/listing-photos"),
      listingStore: new LocalListingStore({ seed: seedCatalogue(), file: null }),
    })
    const image = `data:image/jpeg;base64,${JPEG.toString("base64")}`
    expect((await app.inject({ method: "POST", url: "/api/me/listing-photos", payload: { image } })).statusCode).toBe(401)
    const up = (await app.inject({ method: "POST", url: "/api/local-auth/sign-up", payload: { email: "owner@example.com", password: "long-enough-1", displayName: "Owner" } })).json() as { token: string }
    const headers = { authorization: `Bearer ${up.token}` }

    expect((await app.inject({ method: "POST", url: "/api/me/listing-photos", headers, payload: { image: "data:image/png;base64,AAAA" } })).statusCode).toBe(400)
    const saved = await app.inject({ method: "POST", url: "/api/me/listing-photos", headers, payload: { image } })
    expect(saved.statusCode).toBe(200)
    const { url } = saved.json() as { url: string }
    expect(url).toMatch(/^\/api\/listing-photos\/[A-Za-z0-9-]+\?v=\d+$/)
    const served = await app.inject({ method: "GET", url })
    expect(served.headers["content-type"]).toBe("image/jpeg")
    expect(served.rawPayload.equals(JPEG)).toBe(true)

    const listing = await app.inject({ method: "POST", url: "/api/me/listings", headers, payload: { listing: { ...INPUT, photos: [url] }, contact: { email: "owner@example.com", consentToPublish: true } } })
    expect(listing.statusCode).toBe(201)
    const { id } = listing.json() as { id: string }
    const shown = (await app.inject({ method: "GET", url: `/api/listings/${id}` })).json() as { photos: string[]; mine: boolean }
    expect(shown.photos).toEqual([url])
    expect(shown.mine).toBe(false) // a guest looks at it
    const own = (await app.inject({ method: "GET", url: `/api/listings/${id}`, headers })).json() as { mine: boolean }
    expect(own.mine).toBe(true)
    await app.close()
  })
})
