import type { ListingContact, ListingContactInput, SpaceListing, SpaceListingInput } from "../../domain/index.js"

/**
 * Who is acting on a listing. A landlord signed in with Supabase carries its access token, so the Supabase store can
 * act as that user (Row Level Security then enforces ownership a second time, in the database).
 */
export type ListingActor = {
  readonly id: string
  readonly displayName: string
  readonly kind: "local" | "supabase"
  readonly accessToken?: string
}

/**
 * The port for listings. One interface, two adapters: a local store (seed + a local JSON file, no account) and a
 * Supabase store. Ownership is enforced by the domain (SpaceListing.assertCanChange) in both.
 * Contacts are separate: they are never part of a listing read, only of revealContact.
 */
export interface ListingStore {
  /** Published listings, newest first. */
  listPublished(): Promise<SpaceListing[]>
  get(id: string): Promise<SpaceListing | null>
  listByOwner(actor: ListingActor): Promise<SpaceListing[]>
  create(actor: ListingActor, input: SpaceListingInput, contact: ListingContactInput): Promise<SpaceListing>
  update(actor: ListingActor, id: string, input: SpaceListingInput, contact: ListingContactInput): Promise<SpaceListing>
  /** Deletes the listing and its contact. */
  delete(actor: ListingActor, id: string): Promise<void>
  /** The contact of a published listing, on an explicit "Show contact". Never logged. */
  revealContact(id: string): Promise<ListingContact | null>
  /** The owner's own contact for the edit form. */
  ownContact(actor: ListingActor, id: string): Promise<ListingContact | null>
  /** Counts one opening of a published listing page (no personal data is stored). */
  recordView(id: string): Promise<void>
  /** View counts of the actor's own listings, by listing id. */
  viewCounts(actor: ListingActor): Promise<Record<string, number>>
  /** My spaces: the ids the actor saved, newest first. */
  savedIds(actor: ListingActor): Promise<string[]>
  save(actor: ListingActor, id: string): Promise<void>
  unsave(actor: ListingActor, id: string): Promise<void>
}
