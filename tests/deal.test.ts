import { describe, expect, it } from "vitest"
import { DomainError, Offer, assertCanOffer, checkRentPayment, nextRentDue, rentSchedule, tenancyFromOffer, type RentPaymentProps } from "../src/domain/index.js"

const NOW = "2026-11-27T12:00:00.000Z"
const listing = { id: "listing-a", title: "Shop Liman 2", ownerId: "landlord-1", isDemo: false, published: true }
const demo = { ...listing, id: "listing-demo", ownerId: "demo-owner-7", isDemo: true }
const tenant = { id: "tenant-1", displayName: "Test Cafe" }
const offer = (input: Record<string, unknown> = {}, l = listing) => Offer.create({ rentMonthly: 800, startDate: "2026-12-01", termMonths: 12, message: "Hello", ...input }, { id: "offer-1", listing: l, tenant, now: NOW })
const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e instanceof DomainError ? e.code : "other"
  }
  return "none"
}

describe("offers (domain rules)", () => {
  it("a valid offer is pending, in EUR, with the listing and both parties", () => {
    const o = offer()
    expect(o.props).toMatchObject({ status: "pending", currency: "EUR", landlordId: "landlord-1", tenantId: "tenant-1", rentMonthly: 800 })
  })

  it("rejects your own listing, an unpublished listing, a bad rent, date or length", () => {
    expect(code(() => Offer.create({ rentMonthly: 800, startDate: "2026-12-01", termMonths: 12 }, { id: "o", listing, tenant: { id: "landlord-1", displayName: "L" }, now: NOW }))).toBe("own_listing")
    expect(code(() => offer({}, { ...listing, published: false }))).toBe("invalid_offer")
    expect(code(() => offer({ rentMonthly: 0 }))).toBe("invalid_offer")
    expect(code(() => offer({ rentMonthly: 12.5 }))).toBe("invalid_offer")
    expect(code(() => offer({ startDate: "2026-02-30" }))).toBe("invalid_offer")
    expect(code(() => offer({ startDate: "2026-11-01" }))).toBe("invalid_offer") // in the past
    expect(code(() => offer({ termMonths: 0 }))).toBe("invalid_offer")
    expect(code(() => offer({ termMonths: 121 }))).toBe("invalid_offer")
  })

  it("only the landlord answers a real listing; a pending offer is answered once", () => {
    const o = offer()
    expect(code(() => o.accept("tenant-1", NOW))).toBe("not_offer_party")
    const accepted = o.accept("landlord-1", NOW)
    expect(accepted.props).toMatchObject({ status: "accepted", decidedBy: "landlord-1" })
    expect(code(() => accepted.decline("landlord-1", NOW))).toBe("invalid_offer")
    expect(code(() => accepted.withdraw("tenant-1", NOW))).toBe("invalid_offer")
  })

  it("on a demo listing the tenant answers as the simulated demo landlord", () => {
    const accepted = offer({}, demo).accept("tenant-1", NOW)
    expect(accepted.props.decidedBy).toBe("demo-landlord")
  })

  it("only the tenant withdraws; one open offer per listing; a leased real listing takes no offers", () => {
    expect(code(() => offer().withdraw("landlord-1", NOW))).toBe("not_offer_party")
    expect(offer().withdraw("tenant-1", NOW).props.status).toBe("withdrawn")
    expect(code(() => assertCanOffer({ tenantOpenOffer: true, listingLeased: false, isDemo: false }))).toBe("offer_already_open")
    expect(code(() => assertCanOffer({ tenantOpenOffer: false, listingLeased: true, isDemo: false }))).toBe("already_leased")
    expect(code(() => assertCanOffer({ tenantOpenOffer: false, listingLeased: true, isDemo: true }))).toBe("none")
  })
})

describe("tenancy and rent (domain rules)", () => {
  const tenancy = tenancyFromOffer(offer({ startDate: "2027-01-31", termMonths: 3 }).accept("landlord-1", NOW), { id: "ten-1", now: NOW })
  const pay = (period: string, reference = `simulated:${period}`): RentPaymentProps => ({ id: `p-${period}`, tenancyId: "ten-1", period, amount: 800, currency: "EUR", method: "simulated", reference, paidAt: NOW })

  it("only an accepted offer becomes a tenancy", () => {
    expect(code(() => tenancyFromOffer(offer(), { id: "t", now: NOW }))).toBe("invalid_offer")
  })

  it("one due per month on the start day, the last day in a short month", () => {
    const s = rentSchedule(tenancy, [], "2027-01-01")
    expect(s.map((d) => d.dueDate)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"])
    expect(s.map((d) => d.status)).toEqual(["due", "upcoming", "upcoming"])
  })

  it("paid, overdue and the next due follow the payments and today", () => {
    const s = rentSchedule(tenancy, [pay("2027-01")], "2027-03-05")
    expect(s.map((d) => d.status)).toEqual(["paid", "overdue", "due"])
    expect(nextRentDue(s)?.period).toBe("2027-02")
    expect(nextRentDue(rentSchedule(tenancy, [pay("2027-01"), pay("2027-02"), pay("2027-03")], "2027-03-05"))).toBeNull()
  })

  it("a payment: only the tenant, a month of the term, the exact rent, once; the same reference twice changes nothing", () => {
    const ok = { payerId: "tenant-1", period: "2027-01", amount: 800, currency: "EUR", reference: "simulated:x" }
    expect(checkRentPayment(tenancy, [], ok, "2027-01-01")).toBe("record")
    expect(code(() => checkRentPayment(tenancy, [], { ...ok, payerId: "landlord-1" }, "2027-01-01"))).toBe("not_tenancy_party")
    expect(code(() => checkRentPayment(tenancy, [], { ...ok, period: "2027-09" }, "2027-01-01"))).toBe("invalid_payment")
    expect(code(() => checkRentPayment(tenancy, [], { ...ok, amount: 700 }, "2027-01-01"))).toBe("invalid_payment")
    const recorded = [pay("2027-01", "simulated:x")]
    expect(checkRentPayment(tenancy, recorded, ok, "2027-01-01")).toBe("already_recorded")
    expect(code(() => checkRentPayment(tenancy, recorded, { ...ok, reference: "cs_test_other" }, "2027-01-01"))).toBe("already_paid")
  })
})
