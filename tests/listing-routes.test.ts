import { describe, expect, it } from "vitest"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import { buildServer } from "../src/adapters/server/server.js"
import type { ListingActor } from "../src/application/listings/listing-store.js"

const listing = {
  title: "Lokal 55 m2 na Vračaru",
  city: "Beograd",
  district: "Vračar",
  street: "Kalenićeva",
  areaM2: 55,
  floor: 0,
  rentMonthly: 1400,
  serviceChargeMonthly: 60,
  deposit: 2800,
  minimumTermMonths: 24,
  earlyTermination: { allowed: true, noticeMonths: 3 },
  indexation: { kind: "cpi" },
  permittedUses: ["retail"],
  tenantPaysStructuralRepairs: false,
}
const contact = { phone: "+381 64 765 43 21", email: "vlasnik@example.com", consentToPublish: true }

async function server(actor: ListingActor | null = { id: "landlord-1", displayName: "Test Landlord", kind: "local" }) {
  let current = actor
  const app = await buildServer({ listingStore: new LocalListingStore({ seed: seedCatalogue(), file: null }), resolveActor: async () => current })
  return { app, as: (a: ListingActor | null) => (current = a) }
}

describe("listing routes", () => {
  it("anyone reads the 100 seeded listings; no listing read carries a contact", async () => {
    const { app } = await server(null)
    const list = (await app.inject({ method: "GET", url: "/api/listings" })).json() as { listings: { id: string; isDemo: boolean }[] }
    expect(list.listings).toHaveLength(100)
    expect(list.listings.every((l) => l.isDemo)).toBe(true)
    const one = await app.inject({ method: "GET", url: "/api/listings/listing-ns001" })
    expect(one.statusCode).toBe(200)
    expect(one.body).not.toMatch(/\+381|@example\.com/)
    expect((await app.inject({ method: "GET", url: "/api/listings/listing-nope" })).statusCode).toBe(404)
    await app.close()
  })

  it("Show contact: a demo phone is masked and links are off", async () => {
    const { app } = await server(null)
    const res = await app.inject({ method: "POST", url: "/api/listings/listing-ns001/contact" })
    expect(res.headers["cache-control"]).toBe("no-store")
    const body = res.json() as { phone: string | null; isDemo: boolean; links: boolean }
    expect(body).toMatchObject({ isDemo: true, links: false })
    expect(body.phone).toMatch(/^\+381 6\d \*\*\* \*\* \d{2}$/)
    await app.close()
  })

  it("a landlord creates, edits and deletes a listing; problems come back per field; guests are turned away", async () => {
    const { app, as } = await server()
    const bad = await app.inject({ method: "POST", url: "/api/me/listings", payload: { listing: { ...listing, areaM2: 0 }, contact: { ...contact, consentToPublish: false } } })
    expect(bad.statusCode).toBe(400)
    expect((bad.json() as { problems: { field: string }[] }).problems.map((p) => p.field)).toEqual(["areaM2"])
    const noConsent = await app.inject({ method: "POST", url: "/api/me/listings", payload: { listing, contact: { ...contact, consentToPublish: false } } })
    expect((noConsent.json() as { problems: { field: string }[] }).problems.map((p) => p.field)).toEqual(["contact.consentToPublish"])

    const created = await app.inject({ method: "POST", url: "/api/me/listings", payload: { listing, contact } })
    expect(created.statusCode).toBe(201)
    const { id, isDemo } = created.json() as { id: string; isDemo: boolean }
    expect(isDemo).toBe(false)
    expect(((await app.inject({ method: "GET", url: "/api/me/listings" })).json() as { listings: unknown[] }).listings).toHaveLength(1)
    // A real (non-demo) contact is shown in full, with links.
    expect((await app.inject({ method: "POST", url: `/api/listings/${id}/contact` })).json()).toEqual({ name: "Test Landlord", phone: "+381 64 765 43 21", email: "vlasnik@example.com", isDemo: false, links: true })

    expect((await app.inject({ method: "PUT", url: `/api/me/listings/${id}`, payload: { listing: { ...listing, rentMonthly: 1500 }, contact } })).json()).toMatchObject({ rentMonthly: 1500 })

    as({ id: "someone-else", displayName: "Other", kind: "local" })
    expect((await app.inject({ method: "DELETE", url: `/api/me/listings/${id}` })).statusCode).toBe(403)
    expect((await app.inject({ method: "PUT", url: "/api/me/listings/listing-ns001", payload: { listing, contact } })).statusCode).toBe(403)
    as(null)
    expect((await app.inject({ method: "POST", url: "/api/me/listings", payload: { listing, contact } })).statusCode).toBe(401)
    as({ id: "landlord-1", displayName: "Test Landlord", kind: "local" })
    expect((await app.inject({ method: "DELETE", url: `/api/me/listings/${id}` })).statusCode).toBe(204)
    expect((await app.inject({ method: "POST", url: `/api/listings/${id}/contact` })).statusCode).toBe(404)
    await app.close()
  })
})
