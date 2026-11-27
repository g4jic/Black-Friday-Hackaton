import { call } from "../listings/listings-api"

/** Mirrors of the server's deal records (src/domain/deal.ts). */
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn"
export type Offer = {
  id: string
  listingId: string
  listingTitle: string
  isDemoListing: boolean
  tenantId: string
  tenantName: string
  landlordId: string
  rentMonthly: number
  currency: "EUR"
  startDate: string
  termMonths: number
  message: string
  status: OfferStatus
  createdAt: string
  decidedAt: string | null
  decidedBy: string | null
}
export type Tenancy = Omit<Offer, "message" | "status" | "decidedAt" | "decidedBy"> & { offerId: string }
export type PaymentMethod = "stripe_test" | "simulated"
export type RentPayment = { id: string; tenancyId: string; period: string; amount: number; currency: "EUR"; method: PaymentMethod; reference: string; paidAt: string }
export type RentDue = { period: string; dueDate: string; amount: number; status: "paid" | "overdue" | "due" | "upcoming"; payment: RentPayment | null }
export type TenancyView = { tenancy: Tenancy; role: "tenant" | "landlord"; schedule: RentDue[]; nextDue: RentDue | null }
export type DealsOverview = { offersMade: Offer[]; offersReceived: Offer[]; tenancies: TenancyView[]; paymentMethod: PaymentMethod }
export type Checkout = { tenancyId: string; period: string; amount: number; currency: "EUR"; paid: boolean; reference: string }

const enc = encodeURIComponent

export const dealsApi = {
  overview: () => call<DealsOverview>("GET", "/api/deals"),
  makeOffer: (listingId: string, input: { rentMonthly: number; startDate: string; termMonths: number; message: string }) => call<Offer>("POST", `/api/listings/${enc(listingId)}/offers`, input),
  answer: (offerId: string, answer: "accept" | "decline") => call<{ offer: Offer; tenancy: Tenancy | null }>("POST", `/api/offers/${enc(offerId)}/answer`, { answer }),
  withdraw: (offerId: string) => call<Offer>("POST", `/api/offers/${enc(offerId)}/withdraw`, {}),
  pay: (tenancyId: string, period: string) => call<{ redirectUrl: string; method: PaymentMethod }>("POST", `/api/tenancies/${enc(tenancyId)}/pay`, { period }),
  confirm: (reference: string) => call<{ recorded: boolean; payment: RentPayment | null }>("POST", "/api/payments/confirm", { reference }),
  simulatedCheckout: (reference: string) => call<Checkout>("GET", `/api/payments/simulated/${enc(reference)}`),
  simulatedPay: (reference: string) => call<Checkout>("POST", `/api/payments/simulated/${enc(reference)}/pay`, {}),
}

/** How a payment is labelled everywhere: never real money. */

/** "2027-01" as "January 2027". */
export const monthLabel = (period: string) => new Date(`${period}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
export const dateLabel = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
