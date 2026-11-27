import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import type { ListingActor } from "../src/application/listings/listing-store.js"
import type { SpaceListingInput } from "../src/domain/index.js"

const owner: ListingActor = { id: "local-owner", displayName: "Owner", kind: "local" }
const seeker: ListingActor = { id: "local-seeker", displayName: "Seeker", kind: "local" }
const input = {
  title: "Lokal 40 m2",
  city: "Novi Sad",
  district: "Liman 1",
  street: "Bulevar",
  areaM2: 40,
  floor: 0,
  rentMonthly: 600,
  serviceChargeMonthly: 40,
  deposit: 1200,
  minimumTermMonths: 12,
  earlyTermination: { allowed: true, noticeMonths: 2 },
  indexation: { kind: "none" },
  permittedUses: ["retail"],
  tenantPaysStructuralRepairs: false,
} as unknown as SpaceListingInput

describe("local listing store (no Supabase)", () => {
  let dir = ""
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  it("keeps view counts and saved spaces in its file, so a restart does not lose them", async () => {
    dir = mkdtempSync(join(tmpdir(), "suitespot-store-"))
    const file = join(dir, "listings.json")
    const first = new LocalListingStore({ file })
    const listing = await first.create(owner, input, { phone: null, email: "owner@example.com", consentToPublish: true })
    await first.recordView(listing.id)
    await first.recordView(listing.id)
    await first.save(seeker, listing.id)

    const restarted = new LocalListingStore({ file })
    expect(await restarted.viewCounts(owner)).toEqual({ [listing.id]: 2 })
    expect(await restarted.savedIds(seeker)).toEqual([listing.id])
    await restarted.unsave(seeker, listing.id)
    expect(await new LocalListingStore({ file }).savedIds(seeker)).toEqual([])
  })
})
