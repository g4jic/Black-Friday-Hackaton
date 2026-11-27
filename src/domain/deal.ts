import { DomainError } from "./errors.js"

/**
 * Deals on SuiteSpot: a tenant makes an offer on a listing, the landlord accepts or declines it, an accepted offer
 * becomes a tenancy, and the tenant pays the monthly rent. Plain TypeScript, no I/O: every rule lives here and the
 * stores only keep the records. Money is in whole euros (listings are priced in EUR). No real money moves: a payment
 * is a Stripe test payment or a simulated one, and its record says which.
 */
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn"
export type DealParty = { readonly id: string; readonly displayName: string }

export type OfferProps = {
  readonly id: string
  readonly listingId: string
  readonly listingTitle: string
  readonly isDemoListing: boolean
  readonly tenantId: string
  readonly tenantName: string
  readonly landlordId: string
  readonly rentMonthly: number
  readonly currency: "EUR"
  /** YYYY-MM-DD */
  readonly startDate: string
  readonly termMonths: number
  readonly message: string
  readonly status: OfferStatus
  readonly createdAt: string
  readonly decidedAt: string | null
  /** Who answered: the landlord, or "demo-landlord" for a demo listing answered in the simulation. */
  readonly decidedBy: string | null
}

export type OfferInput = { rentMonthly?: unknown; startDate?: unknown; termMonths?: unknown; message?: unknown }

export const DEAL_RULES = {
  maxTermMonths: 120,
  maxMessageLength: 1000,
  /** A demo listing has no real landlord: the tenant may answer the offer as the simulated demo landlord. */
  demoLandlordId: "demo-landlord",
} as const

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isRealDate = (s: string) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s

export class Offer {
  private constructor(readonly props: OfferProps) {}

  get id(): string {
    return this.props.id
  }

  /** Rules: a published listing, not your own, a positive rent, a real start date from today on, 1 to 120 months. */
  static create(
    input: OfferInput,
    meta: { id: string; listing: { id: string; title: string; ownerId: string; isDemo: boolean; published: boolean }; tenant: DealParty; now: string },
  ): Offer {
    const { listing, tenant } = meta
    if (!listing.published) throw new DomainError("invalid_offer", "This listing is not published, so it takes no offers")
    if (listing.ownerId === tenant.id) throw new DomainError("own_listing", "You cannot make an offer on your own listing")
    const rentMonthly = Number(input.rentMonthly)
    if (!Number.isInteger(rentMonthly) || rentMonthly <= 0 || rentMonthly > 1_000_000) throw new DomainError("invalid_offer", "The monthly rent must be a whole number of euros above 0")
    const startDate = String(input.startDate ?? "")
    if (!isRealDate(startDate)) throw new DomainError("invalid_offer", "The start date must be a date (YYYY-MM-DD)")
    if (startDate < meta.now.slice(0, 10)) throw new DomainError("invalid_offer", "The start date cannot be in the past")
    const termMonths = Number(input.termMonths)
    if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > DEAL_RULES.maxTermMonths) throw new DomainError("invalid_offer", `The lease length must be 1 to ${DEAL_RULES.maxTermMonths} months`)
    const message = String(input.message ?? "").trim()
    if (message.length > DEAL_RULES.maxMessageLength) throw new DomainError("invalid_offer", `The message can have at most ${DEAL_RULES.maxMessageLength} characters`)
    return new Offer(
      Object.freeze({
        id: meta.id,
        listingId: listing.id,
        listingTitle: listing.title,
        isDemoListing: listing.isDemo,
        tenantId: tenant.id,
        tenantName: tenant.displayName,
        landlordId: listing.ownerId,
        rentMonthly,
        currency: "EUR" as const,
        startDate,
        termMonths,
        message,
        status: "pending" as const,
        createdAt: meta.now,
        decidedAt: null,
        decidedBy: null,
      }),
    )
  }

  static rehydrate(props: OfferProps): Offer {
    return new Offer(Object.freeze({ ...props }))
  }

  /** The landlord answers; on a demo listing the tenant may answer as the simulated demo landlord. */
  canAnswer(actorId: string): boolean {
    return actorId === this.props.landlordId || (this.props.isDemoListing && actorId === this.props.tenantId)
  }

  private decide(status: "accepted" | "declined", actorId: string, now: string): Offer {
    if (!this.canAnswer(actorId)) throw new DomainError("not_offer_party", "Only the landlord of this listing can answer the offer")
    if (this.props.status !== "pending") throw new DomainError("invalid_offer", `This offer is already ${this.props.status}`)
    const decidedBy = actorId === this.props.landlordId ? actorId : DEAL_RULES.demoLandlordId
    return new Offer(Object.freeze({ ...this.props, status, decidedAt: now, decidedBy }))
  }

  accept(actorId: string, now: string): Offer {
    return this.decide("accepted", actorId, now)
  }

  decline(actorId: string, now: string): Offer {
    return this.decide("declined", actorId, now)
  }

  withdraw(actorId: string, now: string): Offer {
    if (actorId !== this.props.tenantId) throw new DomainError("not_offer_party", "Only the tenant who made the offer can withdraw it")
    if (this.props.status !== "pending") throw new DomainError("invalid_offer", `This offer is already ${this.props.status}`)
    return new Offer(Object.freeze({ ...this.props, status: "withdrawn" as const, decidedAt: now, decidedBy: actorId }))
  }
}

/** A tenant may have one open offer per listing; a real listing with a tenancy takes no more offers. */
export function assertCanOffer(existing: { tenantOpenOffer: boolean; listingLeased: boolean; isDemo: boolean }): void {
  if (existing.tenantOpenOffer) throw new DomainError("offer_already_open", "You already have an open offer on this listing. Withdraw it first to make a new one.")
  if (existing.listingLeased && !existing.isDemo) throw new DomainError("already_leased", "This space is already leased")
}

// ---------------------------------------------------------------- tenancy and rent

export type TenancyProps = {
  readonly id: string
  readonly offerId: string
  readonly listingId: string
  readonly listingTitle: string
  readonly isDemoListing: boolean
  readonly tenantId: string
  readonly tenantName: string
  readonly landlordId: string
  readonly rentMonthly: number
  readonly currency: "EUR"
  readonly startDate: string
  readonly termMonths: number
  readonly createdAt: string
}

/** The tenancy an accepted offer becomes (same rent, start and length). */
export function tenancyFromOffer(offer: Offer, meta: { id: string; now: string }): TenancyProps {
  const o = offer.props
  if (o.status !== "accepted") throw new DomainError("invalid_offer", "Only an accepted offer becomes a tenancy")
  return Object.freeze({
    id: meta.id,
    offerId: o.id,
    listingId: o.listingId,
    listingTitle: o.listingTitle,
    isDemoListing: o.isDemoListing,
    tenantId: o.tenantId,
    tenantName: o.tenantName,
    landlordId: o.landlordId,
    rentMonthly: o.rentMonthly,
    currency: o.currency,
    startDate: o.startDate,
    termMonths: o.termMonths,
    createdAt: meta.now,
  })
}

export type PaymentMethod = "stripe_test" | "simulated"

export type RentPaymentProps = {
  readonly id: string
  readonly tenancyId: string
  /** YYYY-MM, the rent month this pays */
  readonly period: string
  readonly amount: number
  readonly currency: "EUR"
  readonly method: PaymentMethod
  /** The source of the payment: the Stripe Checkout session id (test mode), or "simulated:<id>". */
  readonly reference: string
  readonly paidAt: string
}

export type RentDue = {
  readonly period: string
  readonly dueDate: string
  readonly amount: number
  readonly status: "paid" | "overdue" | "due" | "upcoming"
  readonly payment: RentPaymentProps | null
}

const pad = (n: number) => String(n).padStart(2, "0")
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

/**
 * The rent schedule: one due per month of the term, on the day of the month the tenancy started (the last day in a
 * shorter month). "due" is the first unpaid month that is not overdue; later unpaid months are "upcoming".
 */
export function rentSchedule(t: TenancyProps, payments: readonly RentPaymentProps[], today: string): RentDue[] {
  const [y, m, d] = t.startDate.split("-").map(Number) as [number, number, number]
  const paid = new Map(payments.filter((p) => p.tenancyId === t.id).map((p) => [p.period, p]))
  let dueMarked = false
  return Array.from({ length: t.termMonths }, (_, i) => {
    const month0 = m - 1 + i
    const year = y + Math.floor(month0 / 12)
    const month = (month0 % 12) + 1
    const period = `${year}-${pad(month)}`
    const dueDate = `${period}-${pad(Math.min(d, daysIn(year, month)))}`
    const payment = paid.get(period) ?? null
    let status: RentDue["status"]
    if (payment) status = "paid"
    else if (dueDate < today) status = "overdue"
    else if (!dueMarked) {
      status = "due"
      dueMarked = true
    } else status = "upcoming"
    return { period, dueDate, amount: t.rentMonthly, status, payment }
  })
}

/** The next rent to pay: the earliest overdue month, else the month marked "due"; null when all is paid. */
export function nextRentDue(schedule: readonly RentDue[]): RentDue | null {
  return schedule.find((d) => d.status === "overdue") ?? schedule.find((d) => d.status === "due") ?? null
}

/**
 * Checks a payment before it is recorded: only the tenant pays, the month is in the term, the amount is the rent,
 * and a month is paid once. Recording the same reference twice changes nothing (idempotent): "already_recorded".
 */
export function checkRentPayment(
  t: TenancyProps,
  existing: readonly RentPaymentProps[],
  p: { payerId: string; period: string; amount: number; currency: string; reference: string },
  today: string,
): "record" | "already_recorded" {
  if (p.payerId !== t.tenantId) throw new DomainError("not_tenancy_party", "Only the tenant pays the rent of this tenancy")
  const due = rentSchedule(t, existing, today).find((d) => d.period === p.period)
  if (!due) throw new DomainError("invalid_payment", `${p.period} is not a month of this tenancy`)
  if (due.payment?.reference === p.reference) return "already_recorded"
  if (due.payment) throw new DomainError("already_paid", `The rent for ${p.period} is already paid`)
  if (p.currency !== t.currency || p.amount !== t.rentMonthly) throw new DomainError("invalid_payment", `The payment must be the rent: ${t.rentMonthly} ${t.currency}`)
  return "record"
}
