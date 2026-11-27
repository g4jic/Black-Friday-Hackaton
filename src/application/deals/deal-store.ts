import type { OfferProps, RentPaymentProps, TenancyProps } from "../../domain/index.js"

/**
 * The port for deals (offers, tenancies, rent payments). Two adapters: a local JSON file and Supabase. The stores only
 * keep records; every rule is checked by the domain (src/domain/deal.ts) in DealService before a write.
 */
export interface DealStore {
  insertOffer(offer: OfferProps): Promise<void>
  updateOffer(offer: OfferProps): Promise<void>
  getOffer(id: string): Promise<OfferProps | null>
  /** Offers a user made (as tenant) or received (as landlord), newest first. */
  offersFor(userId: string): Promise<OfferProps[]>
  offersOnListing(listingId: string): Promise<OfferProps[]>
  insertTenancy(tenancy: TenancyProps): Promise<void>
  getTenancy(id: string): Promise<TenancyProps | null>
  /** Tenancies where the user is the tenant or the landlord, newest first. */
  tenanciesFor(userId: string): Promise<TenancyProps[]>
  tenanciesOnListing(listingId: string): Promise<TenancyProps[]>
  paymentsFor(tenancyIds: readonly string[]): Promise<RentPaymentProps[]>
  insertPayment(payment: RentPaymentProps): Promise<void>
}
