import { randomUUID } from "node:crypto"
import {
  DomainError,
  Offer,
  assertCanOffer,
  checkRentPayment,
  nextRentDue,
  rentSchedule,
  tenancyFromOffer,
  type OfferInput,
  type OfferProps,
  type RentDue,
  type RentPaymentProps,
  type TenancyProps,
} from "../../domain/index.js"
import type { ListingActor, ListingStore } from "../listings/listing-store.js"
import type { PaymentGateway } from "../payments/payment-gateway.js"
import type { DealStore } from "./deal-store.js"

export type TenancyView = {
  readonly tenancy: TenancyProps
  readonly role: "tenant" | "landlord"
  readonly schedule: readonly RentDue[]
  readonly nextDue: RentDue | null
}

export type DealsOverview = {
  readonly offersMade: readonly OfferProps[]
  readonly offersReceived: readonly OfferProps[]
  readonly tenancies: readonly TenancyView[]
  readonly paymentMethod: PaymentGateway["method"]
}

const shortId = (prefix: string) => `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12)}`

/**
 * Offers, tenancies and rent payments. Each method loads the records, lets the domain decide (src/domain/deal.ts),
 * then writes. The payment gateway is a port: Stripe test mode or the simulation, the same flow either way.
 */
export class DealService {
  constructor(
    private readonly deals: DealStore,
    private readonly listings: ListingStore,
    private readonly payments: PaymentGateway,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  get paymentMethod(): PaymentGateway["method"] {
    return this.payments.method
  }

  private today(): string {
    return this.now().slice(0, 10)
  }

  async makeOffer(actor: ListingActor, listingId: string, input: OfferInput): Promise<OfferProps> {
    const listing = await this.listings.get(listingId)
    if (!listing) throw new DomainError("listing_not_found", `No listing "${listingId}"`)
    const [offers, tenancies] = await Promise.all([this.deals.offersOnListing(listingId), this.deals.tenanciesOnListing(listingId)])
    assertCanOffer({
      tenantOpenOffer: offers.some((o) => o.tenantId === actor.id && o.status === "pending"),
      listingLeased: tenancies.length > 0,
      isDemo: listing.props.isDemo,
    })
    const offer = Offer.create(input, {
      id: shortId("offer"),
      listing: { id: listing.id, title: listing.props.title, ownerId: listing.ownerId, isDemo: listing.props.isDemo, published: listing.props.published },
      tenant: { id: actor.id, displayName: actor.displayName },
      now: this.now(),
    })
    await this.deals.insertOffer(offer.props)
    return offer.props
  }

  private async requireOffer(id: string): Promise<Offer> {
    const props = await this.deals.getOffer(id)
    if (!props) throw new DomainError("offer_not_found", `No offer "${id}"`)
    return Offer.rehydrate(props)
  }

  /**
   * Accept or decline. Accepting creates the tenancy; on a real listing it also declines the other open offers, since
   * the space is now leased. A demo listing stays open for other visitors (each plays its own demo landlord).
   */
  async answerOffer(actor: ListingActor, offerId: string, answer: "accept" | "decline"): Promise<{ offer: OfferProps; tenancy: TenancyProps | null }> {
    const offer = await this.requireOffer(offerId)
    const now = this.now()
    if (answer === "decline") {
      const declined = offer.decline(actor.id, now)
      await this.deals.updateOffer(declined.props)
      return { offer: declined.props, tenancy: null }
    }
    const listing = await this.listings.get(offer.props.listingId)
    if (!listing || !listing.props.published) throw new DomainError("listing_not_found", "This listing is no longer published, so the offer cannot be accepted")
    if (!offer.props.isDemoListing && (await this.deals.tenanciesOnListing(offer.props.listingId)).length > 0) throw new DomainError("already_leased", "This space is already leased")
    const accepted = offer.accept(actor.id, now)
    const tenancy = tenancyFromOffer(accepted, { id: shortId("tenancy"), now })
    await this.deals.updateOffer(accepted.props)
    await this.deals.insertTenancy(tenancy)
    if (!offer.props.isDemoListing) {
      for (const other of await this.deals.offersOnListing(offer.props.listingId)) {
        if (other.id !== offerId && other.status === "pending") await this.deals.updateOffer({ ...other, status: "declined", decidedAt: now, decidedBy: actor.id })
      }
    }
    return { offer: accepted.props, tenancy }
  }

  async withdrawOffer(actor: ListingActor, offerId: string): Promise<OfferProps> {
    const withdrawn = (await this.requireOffer(offerId)).withdraw(actor.id, this.now())
    await this.deals.updateOffer(withdrawn.props)
    return withdrawn.props
  }

  async overview(actor: ListingActor): Promise<DealsOverview> {
    const [offers, tenancies] = await Promise.all([this.deals.offersFor(actor.id), this.deals.tenanciesFor(actor.id)])
    const payments = await this.deals.paymentsFor(tenancies.map((t) => t.id))
    const today = this.today()
    return {
      offersMade: offers.filter((o) => o.tenantId === actor.id),
      offersReceived: offers.filter((o) => o.landlordId === actor.id),
      tenancies: tenancies.map((t) => {
        const schedule = rentSchedule(t, payments, today)
        return { tenancy: t, role: t.tenantId === actor.id ? "tenant" : "landlord", schedule, nextDue: nextRentDue(schedule) }
      }),
      paymentMethod: this.payments.method,
    }
  }

  private async tenancyForTenant(actor: ListingActor, tenancyId: string): Promise<TenancyProps> {
    const t = await this.deals.getTenancy(tenancyId)
    if (!t) throw new DomainError("tenancy_not_found", `No tenancy "${tenancyId}"`)
    if (t.tenantId !== actor.id) throw new DomainError("not_tenancy_party", "Only the tenant pays the rent of this tenancy")
    return t
  }

  /** Starts paying one month's rent. The domain checks it first, so an invalid payment never reaches the gateway. */
  async startRentPayment(actor: ListingActor, tenancyId: string, period: string, baseUrl: string): Promise<{ redirectUrl: string; method: PaymentGateway["method"] }> {
    const t = await this.tenancyForTenant(actor, tenancyId)
    const existing = await this.deals.paymentsFor([t.id])
    checkRentPayment(t, existing, { payerId: actor.id, period, amount: t.rentMonthly, currency: t.currency, reference: "pending" }, this.today())
    const back = `${baseUrl}/my-spaces`
    const { redirectUrl } = await this.payments.startCheckout(
      { tenancyId: t.id, period, amount: t.rentMonthly, currency: t.currency },
      {
        description: `Rent ${period}: ${t.listingTitle}`,
        successUrl: (reference) => `${back}?paid=${reference.startsWith("{") ? reference : encodeURIComponent(reference)}`,
        cancelUrl: `${back}?payment=cancelled`,
      },
    )
    return { redirectUrl, method: this.payments.method }
  }

  /**
   * Records a payment after the checkout: the status comes from the gateway (Stripe or the simulation), never from
   * the browser. Confirming the same checkout twice changes nothing.
   */
  async confirmRentPayment(actor: ListingActor, reference: string): Promise<{ recorded: boolean; payment: RentPaymentProps | null }> {
    const status = await this.payments.checkoutStatus(reference)
    if (!status) throw new DomainError("invalid_payment", "This payment is not known. Start it again from My spaces.")
    if (!status.paid) return { recorded: false, payment: null }
    const t = await this.tenancyForTenant(actor, status.tenancyId)
    const existing = await this.deals.paymentsFor([t.id])
    const decision = checkRentPayment(t, existing, { payerId: actor.id, period: status.period, amount: status.amount, currency: status.currency, reference }, this.today())
    if (decision === "already_recorded") return { recorded: false, payment: existing.find((p) => p.reference === reference) ?? null }
    const payment: RentPaymentProps = { id: shortId("payment"), tenancyId: t.id, period: status.period, amount: status.amount, currency: "EUR", method: this.payments.method, reference, paidAt: this.now() }
    await this.deals.insertPayment(payment)
    return { recorded: true, payment }
  }

  /** Only for the simulated checkout: the tenant must own the tenancy it pays. */
  async assertTenantOf(actor: ListingActor, tenancyId: string): Promise<void> {
    await this.tenancyForTenant(actor, tenancyId)
  }
}
