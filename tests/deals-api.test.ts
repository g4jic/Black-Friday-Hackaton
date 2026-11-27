import { describe, expect, it } from "vitest"
import { SimulatedGateway } from "../src/adapters/payments/simulated-gateway.js"
import { StripeTestGateway, stripeTestConfig } from "../src/adapters/payments/stripe-test-gateway.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { buildServer } from "../src/adapters/server/server.js"
import { LocalDealStore } from "../src/adapters/storage/local-deal-store.js"
import { LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import type { ListingActor } from "../src/application/listings/listing-store.js"

const landlord: ListingActor = { id: "landlord-1", displayName: "Vlasnik d.o.o.", kind: "local" }
const tenant: ListingActor = { id: "tenant-1", displayName: "Test Cafe", kind: "local" }
const other: ListingActor = { id: "tenant-2", displayName: "Other Shop", kind: "local" }
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
const nextYear = `${new Date().getUTCFullYear() + 1}-01-15`

async function server() {
  let current: ListingActor | null = landlord
  const app = await buildServer({
    listingStore: new LocalListingStore({ seed: seedCatalogue(), file: null }),
    dealStore: new LocalDealStore(null),
    paymentGateway: new SimulatedGateway(),
    resolveActor: async () => current,
  })
  const call = async (actor: ListingActor | null, method: "GET" | "POST", url: string, payload?: object) => {
    current = actor
    const r = await app.inject({ method, url, ...(payload ? { payload } : {}) })
    return { status: r.statusCode, body: r.json() as Record<string, any> }
  }
  return { app, call }
}

describe("deals over HTTP: the full loop without any key (simulated payment)", () => {
  it("offer, accept, tenancy, simulated payment, and the status on both sides", async () => {
    const { call } = await server()
    const created = await call(landlord, "POST", "/api/me/listings", { listing, contact })
    expect(created.status).toBe(201)
    const listingId = created.body.id as string

    expect((await call(null, "POST", `/api/listings/${listingId}/offers`, {})).status).toBe(401)
    expect((await call(landlord, "POST", `/api/listings/${listingId}/offers`, { rentMonthly: 1300, startDate: nextYear, termMonths: 12 })).body.code).toBe("own_listing")
    const offer = await call(tenant, "POST", `/api/listings/${listingId}/offers`, { rentMonthly: 1300, startDate: nextYear, termMonths: 12, message: "Coffee bar" })
    expect(offer.status).toBe(200)
    expect((await call(tenant, "POST", `/api/listings/${listingId}/offers`, { rentMonthly: 1350, startDate: nextYear, termMonths: 12 })).status).toBe(409)
    const second = await call(other, "POST", `/api/listings/${listingId}/offers`, { rentMonthly: 1200, startDate: nextYear, termMonths: 24 })
    expect(second.status).toBe(200)

    // only the landlord answers; accepting makes the tenancy and declines the other open offer
    expect((await call(tenant, "POST", `/api/offers/${offer.body.id}/answer`, { answer: "accept" })).status).toBe(403)
    const accepted = await call(landlord, "POST", `/api/offers/${offer.body.id}/answer`, { answer: "accept" })
    expect(accepted.body.tenancy).toMatchObject({ rentMonthly: 1300, termMonths: 12, tenantId: "tenant-1", landlordId: "landlord-1" })
    const otherView = await call(other, "GET", "/api/deals")
    expect(otherView.body.offersMade[0].status).toBe("declined")
    expect((await call(other, "POST", `/api/listings/${listingId}/offers`, { rentMonthly: 1500, startDate: nextYear, termMonths: 12 })).body.code).toBe("already_leased")

    // the tenant pays the first month through the simulated checkout
    const tenancyId = accepted.body.tenancy.id as string
    const period = nextYear.slice(0, 7)
    expect((await call(landlord, "POST", `/api/tenancies/${tenancyId}/pay`, { period })).status).toBe(403)
    const start = await call(tenant, "POST", `/api/tenancies/${tenancyId}/pay`, { period })
    expect(start.body.method).toBe("simulated")
    const reference = decodeURIComponent(/\/pay\/simulated\/([^?]+)/.exec(start.body.redirectUrl)![1]!)
    expect((await call(tenant, "POST", "/api/payments/confirm", { reference })).body).toEqual({ recorded: false, payment: null }) // not paid yet
    expect((await call(other, "POST", `/api/payments/simulated/${encodeURIComponent(reference)}/pay`)).status).toBe(403)
    expect((await call(tenant, "POST", `/api/payments/simulated/${encodeURIComponent(reference)}/pay`)).body.paid).toBe(true)
    const confirmed = await call(tenant, "POST", "/api/payments/confirm", { reference })
    expect(confirmed.body.payment).toMatchObject({ period, amount: 1300, method: "simulated" })
    expect((await call(tenant, "POST", "/api/payments/confirm", { reference })).body.recorded).toBe(false) // idempotent
    expect((await call(tenant, "POST", `/api/tenancies/${tenancyId}/pay`, { period })).body.code).toBe("already_paid")

    // both sides see the same tenancy and the paid month
    const mine = await call(tenant, "GET", "/api/deals")
    const theirs = await call(landlord, "GET", "/api/deals")
    expect(mine.body.tenancies[0]).toMatchObject({ role: "tenant" })
    expect(theirs.body.tenancies[0]).toMatchObject({ role: "landlord" })
    for (const view of [mine, theirs]) expect(view.body.tenancies[0].schedule[0]).toMatchObject({ period, status: "paid", payment: { method: "simulated", reference } })
    expect(theirs.body.offersReceived).toHaveLength(2)
  })

  it("a demo listing: the tenant answers as the simulated demo landlord, and the listing stays open for others", async () => {
    const { call } = await server()
    const offer = await call(tenant, "POST", "/api/listings/listing-ns001/offers", { rentMonthly: 700, startDate: nextYear, termMonths: 6 })
    const accepted = await call(tenant, "POST", `/api/offers/${offer.body.id}/answer`, { answer: "accept" })
    expect(accepted.body.offer.decidedBy).toBe("demo-landlord")
    expect((await call(other, "POST", "/api/listings/listing-ns001/offers", { rentMonthly: 650, startDate: nextYear, termMonths: 6 })).status).toBe(200)
    expect((await call(other, "POST", `/api/offers/${offer.body.id}/withdraw`)).status).toBe(403)
  })
})

describe("Stripe test gateway (no network: a fake fetch)", () => {
  it("only test keys switch it on; a live key is refused", () => {
    expect(stripeTestConfig({}).config).toBeNull()
    expect(stripeTestConfig({ STRIPE_SECRET_KEY: "sk_live_x", STRIPE_PUBLISHABLE_KEY: "pk_live_x" })).toMatchObject({ config: null, warning: expect.stringContaining("test keys") })
    expect(stripeTestConfig({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PUBLISHABLE_KEY: "pk_test_y" }).config).not.toBeNull()
    // Restricted test keys, including an anonymous sandbox key from `stripe sandbox create`, are test keys too.
    expect(stripeTestConfig({ STRIPE_SECRET_KEY: "rk_test_x", STRIPE_PUBLISHABLE_KEY: "pk_test_y" }).config).not.toBeNull()
    expect(stripeTestConfig({ STRIPE_SECRET_KEY: "rkcs_test_x", STRIPE_PUBLISHABLE_KEY: "pk_test_y" }).config).not.toBeNull()
    expect(stripeTestConfig({ STRIPE_SECRET_KEY: "rk_live_x", STRIPE_PUBLISHABLE_KEY: "pk_test_y" }).config).toBeNull()
  })

  it("creates a Checkout session in euro cents and reads the paid status back from Stripe", async () => {
    const calls: { url: string; body: string }[] = []
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body ?? "") })
      const session = { id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/cs_test_abc", payment_status: url.endsWith("cs_test_abc") ? "paid" : "unpaid", amount_total: 130000, currency: "eur", metadata: { tenancyId: "tenancy-1", period: "2027-01" } }
      return new Response(JSON.stringify(session), { status: 200 })
    }) as unknown as typeof fetch
    const gateway = new StripeTestGateway({ secretKey: "sk_test_x", publishableKey: "pk_test_y" }, fakeFetch)
    const started = await gateway.startCheckout({ tenancyId: "tenancy-1", period: "2027-01", amount: 1300, currency: "EUR" }, { description: "Rent", successUrl: (r) => `http://x/my-spaces?paid=${r}`, cancelUrl: "http://x/my-spaces" })
    expect(started).toEqual({ reference: "cs_test_abc", redirectUrl: "https://checkout.stripe.com/c/pay/cs_test_abc" })
    const form = new URLSearchParams(calls[0]!.body)
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("130000")
    expect(form.get("success_url")).toBe("http://x/my-spaces?paid={CHECKOUT_SESSION_ID}")
    expect(await gateway.checkoutStatus("cs_test_abc")).toMatchObject({ paid: true, amount: 1300, currency: "EUR", tenancyId: "tenancy-1", period: "2027-01" })
    expect(await gateway.checkoutStatus("not-a-session")).toBeNull()
  })
})
