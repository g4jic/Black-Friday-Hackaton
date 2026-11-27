import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { DealStore } from "../../application/deals/deal-store.js"
import type { OfferProps, RentPaymentProps, TenancyProps } from "../../domain/index.js"

/** Where deals are kept without Supabase (data/ is in .gitignore). */
export const LOCAL_DEALS_FILE = "data/local-deals.json"

type LocalFile = { offers: OfferProps[]; tenancies: TenancyProps[]; payments: RentPaymentProps[] }

const newestFirst = <T extends { createdAt: string; id: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)

/** Deals in a local JSON file (null: memory only, for tests). Same interface as the Supabase store. */
export class LocalDealStore implements DealStore {
  private data: LocalFile = { offers: [], tenancies: [], payments: [] }

  constructor(private readonly file: string | null = LOCAL_DEALS_FILE) {
    if (file && existsSync(file)) {
      try {
        const stored = JSON.parse(readFileSync(file, "utf8")) as Partial<LocalFile>
        this.data = { offers: stored.offers ?? [], tenancies: stored.tenancies ?? [], payments: stored.payments ?? [] }
      } catch {
        // a broken file is ignored, never a crash
      }
    }
  }

  async insertOffer(offer: OfferProps): Promise<void> {
    this.data.offers.push(offer)
    this.persist()
  }

  async updateOffer(offer: OfferProps): Promise<void> {
    this.data.offers = this.data.offers.map((o) => (o.id === offer.id ? offer : o))
    this.persist()
  }

  async getOffer(id: string): Promise<OfferProps | null> {
    return this.data.offers.find((o) => o.id === id) ?? null
  }

  async offersFor(userId: string): Promise<OfferProps[]> {
    return this.data.offers.filter((o) => o.tenantId === userId || o.landlordId === userId).sort(newestFirst)
  }

  async offersOnListing(listingId: string): Promise<OfferProps[]> {
    return this.data.offers.filter((o) => o.listingId === listingId).sort(newestFirst)
  }

  async insertTenancy(tenancy: TenancyProps): Promise<void> {
    this.data.tenancies.push(tenancy)
    this.persist()
  }

  async getTenancy(id: string): Promise<TenancyProps | null> {
    return this.data.tenancies.find((t) => t.id === id) ?? null
  }

  async tenanciesFor(userId: string): Promise<TenancyProps[]> {
    return this.data.tenancies.filter((t) => t.tenantId === userId || t.landlordId === userId).sort(newestFirst)
  }

  async tenanciesOnListing(listingId: string): Promise<TenancyProps[]> {
    return this.data.tenancies.filter((t) => t.listingId === listingId).sort(newestFirst)
  }

  async leasedListingIds(): Promise<Set<string>> {
    return new Set(this.data.tenancies.map((t) => t.listingId))
  }

  async paymentsFor(tenancyIds: readonly string[]): Promise<RentPaymentProps[]> {
    const ids = new Set(tenancyIds)
    return this.data.payments.filter((p) => ids.has(p.tenancyId))
  }

  async insertPayment(payment: RentPaymentProps): Promise<void> {
    if (this.data.payments.some((p) => p.tenancyId === payment.tenancyId && p.period === payment.period)) return // one payment per month
    this.data.payments.push(payment)
    this.persist()
  }

  /** Write to a temporary file, then rename: a crash mid-write never leaves a half-written file. */
  private persist(): void {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 1), "utf8")
    renameSync(tmp, this.file)
  }
}
