import { SpaceListing, createListingContact, type ListingContact } from "../../domain/index.js"
import { generateSeed, type Seed } from "./generate-listings.js"

/**
 * The seed as domain objects: every generated listing goes through SpaceListing.create (the same rules as the form),
 * marked is_demo. Owner ids are the stable demo owner keys; the Supabase seed maps them to real auth user ids.
 */
export function seedCatalogue(seed: Seed = generateSeed()): { listings: SpaceListing[]; contacts: ListingContact[] } {
  const ownerName = new Map(seed.owners.map((o) => [o.key, o.fullName]))
  return {
    listings: seed.listings.map((l) => SpaceListing.create(l.input, { id: l.id, ownerId: l.ownerKey, isDemo: true, now: l.createdAt })),
    contacts: seed.listings.map((l) => createListingContact(l.id, ownerName.get(l.ownerKey)!, l.contact)),
  }
}
