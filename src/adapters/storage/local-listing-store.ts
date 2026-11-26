import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { ListingActor, ListingStore } from "../../application/listings/listing-store.js"
import {
  DomainError,
  SpaceListing,
  createListingContact,
  type ListingContact,
  type ListingContactInput,
  type SpaceListingInput,
  type SpaceListingProps,
} from "../../domain/index.js"

/** Where listings made without Supabase are kept (in .gitignore). */
export const LOCAL_LISTINGS_FILE = "data/local-listings.json"

/** The one local account when Supabase is not configured: no password, clearly labelled in the UI. */
export const LOCAL_LANDLORD: ListingActor = Object.freeze({ id: "local-demo-landlord", displayName: "Local demo account", kind: "local" })

type LocalFile = { listings: SpaceListingProps[]; contacts: ListingContact[] }

export type LocalListingStoreOptions = {
  /** Read-only listings everyone sees (the seed), with their contacts. */
  readonly seed?: { readonly listings: readonly SpaceListing[]; readonly contacts: readonly ListingContact[] }
  /** The JSON file for listings created locally; null keeps them in memory only (tests). */
  readonly file?: string | null
  readonly now?: () => string
}

export const newListingId = () => `listing-${randomUUID().replace(/-/g, "").slice(0, 12)}`

/** Listings without a database: the seed plus a local JSON file. Same interface and same rules as the Supabase store. */
export class LocalListingStore implements ListingStore {
  private readonly seedListings: ReadonlyMap<string, SpaceListing>
  private readonly seedContacts: ReadonlyMap<string, ListingContact>
  private readonly own = new Map<string, SpaceListing>()
  private readonly ownContacts = new Map<string, ListingContact>()
  private readonly file: string | null
  private readonly now: () => string

  constructor(options: LocalListingStoreOptions = {}) {
    this.seedListings = new Map((options.seed?.listings ?? []).map((l) => [l.id, l]))
    this.seedContacts = new Map((options.seed?.contacts ?? []).map((c) => [c.listingId, c]))
    this.file = options.file === undefined ? LOCAL_LISTINGS_FILE : options.file
    this.now = options.now ?? (() => new Date().toISOString())
    if (this.file && existsSync(this.file)) {
      const stored = JSON.parse(readFileSync(this.file, "utf8")) as LocalFile
      for (const p of stored.listings ?? []) this.own.set(p.id, SpaceListing.rehydrate(p))
      for (const c of stored.contacts ?? []) this.ownContacts.set(c.listingId, c)
    }
  }

  async listPublished(): Promise<SpaceListing[]> {
    return this.all().filter((l) => l.props.published)
  }

  async get(id: string): Promise<SpaceListing | null> {
    return this.own.get(id) ?? this.seedListings.get(id) ?? null
  }

  async listByOwner(actor: ListingActor): Promise<SpaceListing[]> {
    return this.all().filter((l) => l.isOwnedBy(actor.id))
  }

  async create(actor: ListingActor, input: SpaceListingInput, contactInput: ListingContactInput): Promise<SpaceListing> {
    const id = newListingId()
    const listing = SpaceListing.create(input, { id, ownerId: actor.id, now: this.now() })
    const contact = createListingContact(id, actor.displayName, contactInput)
    this.own.set(id, listing)
    this.ownContacts.set(id, contact)
    this.persist()
    return listing
  }

  async update(actor: ListingActor, id: string, input: SpaceListingInput, contactInput: ListingContactInput): Promise<SpaceListing> {
    const current = await this.require(id)
    const updated = current.update(input, actor.id, this.now())
    const contact = createListingContact(id, actor.displayName, contactInput)
    if (!this.own.has(id)) throw new DomainError("not_listing_owner", "Demo listings cannot be changed")
    this.own.set(id, updated)
    this.ownContacts.set(id, contact)
    this.persist()
    return updated
  }

  async delete(actor: ListingActor, id: string): Promise<void> {
    const current = await this.require(id)
    current.assertCanChange(actor.id)
    if (!this.own.has(id)) throw new DomainError("not_listing_owner", "Demo listings cannot be deleted")
    this.own.delete(id)
    this.ownContacts.delete(id) // the contact goes with the listing
    this.persist()
  }

  async revealContact(id: string): Promise<ListingContact | null> {
    const listing = await this.get(id)
    if (!listing || !listing.props.published) return null
    return this.ownContacts.get(id) ?? this.seedContacts.get(id) ?? null
  }

  async ownContact(actor: ListingActor, id: string): Promise<ListingContact | null> {
    const listing = await this.require(id)
    listing.assertCanChange(actor.id)
    return this.ownContacts.get(id) ?? this.seedContacts.get(id) ?? null
  }

  private readonly views = new Map<string, number>()
  private readonly saved = new Map<string, string[]>()

  async recordView(id: string): Promise<void> {
    const listing = await this.get(id)
    if (listing?.props.published) this.views.set(id, (this.views.get(id) ?? 0) + 1)
  }

  async viewCounts(actor: ListingActor): Promise<Record<string, number>> {
    return Object.fromEntries((await this.listByOwner(actor)).map((l) => [l.id, this.views.get(l.id) ?? 0]))
  }

  async savedIds(actor: ListingActor): Promise<string[]> {
    return [...(this.saved.get(actor.id) ?? [])]
  }

  async save(actor: ListingActor, id: string): Promise<void> {
    const listing = await this.get(id)
    if (!listing || !listing.props.published) throw new DomainError("listing_not_found", `No listing "${id}"`)
    const ids = this.saved.get(actor.id) ?? []
    if (!ids.includes(id)) this.saved.set(actor.id, [id, ...ids]) // saving twice changes nothing
  }

  async unsave(actor: ListingActor, id: string): Promise<void> {
    this.saved.set(actor.id, (this.saved.get(actor.id) ?? []).filter((x) => x !== id))
  }

  private all(): SpaceListing[] {
    return [...this.own.values(), ...this.seedListings.values()].sort((a, b) => b.props.createdAt.localeCompare(a.props.createdAt) || a.id.localeCompare(b.id))
  }

  private async require(id: string): Promise<SpaceListing> {
    const listing = await this.get(id)
    if (!listing) throw new DomainError("listing_not_found", `No listing "${id}"`)
    return listing
  }

  /** Write to a temporary file, then rename: a crash mid-write never leaves a half-written file. */
  private persist(): void {
    if (!this.file) return
    const data: LocalFile = { listings: [...this.own.values()].map((l) => l.toJSON()), contacts: [...this.ownContacts.values()] }
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8")
    renameSync(tmp, this.file)
  }
}
