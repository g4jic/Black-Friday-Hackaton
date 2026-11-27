import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { DealStore } from "../../application/deals/deal-store.js"
import type { OfferProps, OfferStatus, PaymentMethod, RentPaymentProps, TenancyProps } from "../../domain/index.js"
import type { SupabaseStoreConfig } from "./supabase-listing-store.js"

/**
 * Deals in Supabase (offers, tenancies, rent_payments; see supabase/migrations/20261127150000_*). The server writes
 * with the service role key after the domain rules have passed; Row Level Security lets a signed-in user read only
 * the rows they are a party to and gives nobody else any access. The key never leaves this process.
 */
type OfferRow = {
  id: string
  listing_id: string
  listing_title: string
  is_demo_listing: boolean
  tenant_id: string
  tenant_name: string
  landlord_id: string
  rent_monthly: number
  currency: "EUR"
  start_date: string
  term_months: number
  message: string
  status: OfferStatus
  created_at: string
  decided_at: string | null
  decided_by: string | null
}
type TenancyRow = Omit<OfferRow, "message" | "status" | "decided_at" | "decided_by"> & { offer_id: string }
type PaymentRow = { id: string; tenancy_id: string; period: string; amount: number; currency: "EUR"; method: PaymentMethod; reference: string; paid_at: string }

const iso = (t: string) => new Date(t).toISOString()

const offerToRow = (o: OfferProps): OfferRow => ({
  id: o.id,
  listing_id: o.listingId,
  listing_title: o.listingTitle,
  is_demo_listing: o.isDemoListing,
  tenant_id: o.tenantId,
  tenant_name: o.tenantName,
  landlord_id: o.landlordId,
  rent_monthly: o.rentMonthly,
  currency: o.currency,
  start_date: o.startDate,
  term_months: o.termMonths,
  message: o.message,
  status: o.status,
  created_at: o.createdAt,
  decided_at: o.decidedAt,
  decided_by: o.decidedBy,
})
const rowToOffer = (r: OfferRow): OfferProps => ({
  id: r.id,
  listingId: r.listing_id,
  listingTitle: r.listing_title,
  isDemoListing: r.is_demo_listing,
  tenantId: r.tenant_id,
  tenantName: r.tenant_name,
  landlordId: r.landlord_id,
  rentMonthly: Number(r.rent_monthly),
  currency: "EUR",
  startDate: r.start_date,
  termMonths: r.term_months,
  message: r.message,
  status: r.status,
  createdAt: iso(r.created_at),
  decidedAt: r.decided_at ? iso(r.decided_at) : null,
  decidedBy: r.decided_by,
})
const tenancyToRow = (t: TenancyProps): TenancyRow => ({
  id: t.id,
  offer_id: t.offerId,
  listing_id: t.listingId,
  listing_title: t.listingTitle,
  is_demo_listing: t.isDemoListing,
  tenant_id: t.tenantId,
  tenant_name: t.tenantName,
  landlord_id: t.landlordId,
  rent_monthly: t.rentMonthly,
  currency: t.currency,
  start_date: t.startDate,
  term_months: t.termMonths,
  created_at: t.createdAt,
})
const rowToTenancy = (r: TenancyRow): TenancyProps => ({
  id: r.id,
  offerId: r.offer_id,
  listingId: r.listing_id,
  listingTitle: r.listing_title,
  isDemoListing: r.is_demo_listing,
  tenantId: r.tenant_id,
  tenantName: r.tenant_name,
  landlordId: r.landlord_id,
  rentMonthly: Number(r.rent_monthly),
  currency: "EUR",
  startDate: r.start_date,
  termMonths: r.term_months,
  createdAt: iso(r.created_at),
})
const rowToPayment = (r: PaymentRow): RentPaymentProps => ({
  id: r.id,
  tenancyId: r.tenancy_id,
  period: r.period,
  amount: Number(r.amount),
  currency: "EUR",
  method: r.method,
  reference: r.reference,
  paidAt: iso(r.paid_at),
})

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Supabase (${what}): ${result.error.message}`)
  return result.data as T
}

export class SupabaseDealStore implements DealStore {
  private readonly db: SupabaseClient

  constructor(config: SupabaseStoreConfig) {
    this.db = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  }

  async insertOffer(offer: OfferProps): Promise<void> {
    check(await this.db.from("offers").insert(offerToRow(offer)), "insert offer")
  }

  async updateOffer(offer: OfferProps): Promise<void> {
    const { status, decided_at, decided_by } = offerToRow(offer)
    check(await this.db.from("offers").update({ status, decided_at, decided_by }).eq("id", offer.id), "update offer")
  }

  async getOffer(id: string): Promise<OfferProps | null> {
    const row = check(await this.db.from("offers").select("*").eq("id", id).maybeSingle(), "get offer") as OfferRow | null
    return row ? rowToOffer(row) : null
  }

  async offersFor(userId: string): Promise<OfferProps[]> {
    const rows = check(await this.db.from("offers").select("*").or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`).order("created_at", { ascending: false }), "list offers") as OfferRow[]
    return rows.map(rowToOffer)
  }

  async offersOnListing(listingId: string): Promise<OfferProps[]> {
    const rows = check(await this.db.from("offers").select("*").eq("listing_id", listingId).order("created_at", { ascending: false }), "listing offers") as OfferRow[]
    return rows.map(rowToOffer)
  }

  async insertTenancy(tenancy: TenancyProps): Promise<void> {
    check(await this.db.from("tenancies").insert(tenancyToRow(tenancy)), "insert tenancy")
  }

  async getTenancy(id: string): Promise<TenancyProps | null> {
    const row = check(await this.db.from("tenancies").select("*").eq("id", id).maybeSingle(), "get tenancy") as TenancyRow | null
    return row ? rowToTenancy(row) : null
  }

  async tenanciesFor(userId: string): Promise<TenancyProps[]> {
    const rows = check(await this.db.from("tenancies").select("*").or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`).order("created_at", { ascending: false }), "list tenancies") as TenancyRow[]
    return rows.map(rowToTenancy)
  }

  async tenanciesOnListing(listingId: string): Promise<TenancyProps[]> {
    const rows = check(await this.db.from("tenancies").select("*").eq("listing_id", listingId), "listing tenancies") as TenancyRow[]
    return rows.map(rowToTenancy)
  }

  /** Only the listing ids are read (service role on the server), a page of 1000 at a time. */
  async leasedListingIds(): Promise<Set<string>> {
    const ids = new Set<string>()
    for (let from = 0; ; from += 1000) {
      const rows = check(await this.db.from("tenancies").select("listing_id").order("id").range(from, from + 999), "leased listings") as { listing_id: string }[]
      for (const r of rows) ids.add(r.listing_id)
      if (rows.length < 1000) return ids
    }
  }

  async paymentsFor(tenancyIds: readonly string[]): Promise<RentPaymentProps[]> {
    if (tenancyIds.length === 0) return []
    const rows = check(await this.db.from("rent_payments").select("*").in("tenancy_id", [...tenancyIds]), "list payments") as PaymentRow[]
    return rows.map(rowToPayment)
  }

  async insertPayment(p: RentPaymentProps): Promise<void> {
    const row: PaymentRow = { id: p.id, tenancy_id: p.tenancyId, period: p.period, amount: p.amount, currency: p.currency, method: p.method, reference: p.reference, paid_at: p.paidAt }
    // one payment per month (unique tenancy_id, period): a second insert of the same month changes nothing
    check(await this.db.from("rent_payments").upsert(row, { onConflict: "tenancy_id,period", ignoreDuplicates: true }), "insert payment")
  }
}
