import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { ListingActor, ListingStore } from "../../application/listings/listing-store.js"
import {
  DomainError,
  SpaceListing,
  createListingContact,
  type BusinessType,
  type ListingContact,
  type ListingContactInput,
  type SpaceListingInput,
  type SpaceListingProps,
} from "../../domain/index.js"
import { newListingId } from "./local-listing-store.js"

/**
 * Listings in Supabase (tables listings and listing_contacts, see supabase/migrations). Three clients, three levels:
 * - public reads use the anon key, so Row Level Security returns published listings only;
 * - a landlord's own reads and writes use that landlord's access token, so RLS checks ownership a second time
 *   (after SpaceListing.assertCanChange in the domain);
 * - only "Show contact" uses the service role key, because anon has no access to listing_contacts at all.
 * The service role key lives in this server process only: never sent to the browser, never logged.
 */
export type SupabaseStoreConfig = { readonly url: string; readonly anonKey: string; readonly serviceRoleKey: string }

/** All three values set, or null (then the server keeps the local store). */
export function supabaseStoreConfig(env: NodeJS.ProcessEnv = process.env): SupabaseStoreConfig | null {
  const url = env.SUPABASE_URL?.trim()
  const anonKey = env.SUPABASE_ANON_KEY?.trim()
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : null
}

/** One row of public.listings, as PostgREST returns it. */
export type ListingRow = {
  id: string
  owner_id: string
  is_demo: boolean
  published: boolean
  title: string
  city: string
  district: string
  street: string
  area_m2: number | string
  floor: number
  rent_monthly: number | string
  service_charge_monthly: number | string
  deposit: number | string
  minimum_term_months: number
  early_termination_allowed: boolean
  early_termination_notice_months: number | null
  indexation_kind: "none" | "cpi" | "fixed_rate" | "landlord_unilateral"
  indexation_rate_percent: number | string | null
  permitted_uses: string[]
  tenant_pays_structural_repairs: boolean
  lease_draft: string | null
  description: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export type ContactRow = { listing_id: string; name: string; phone: string | null; email: string | null; consent_to_publish: boolean }

const num = (v: number | string): number => (typeof v === "number" ? v : Number(v))

/** Row to entity props. SpaceListing.rehydrate validates them again, so a broken row never enters the app. */
export function rowToProps(r: ListingRow): SpaceListingProps {
  return {
    id: r.id,
    ownerId: r.owner_id,
    isDemo: r.is_demo,
    published: r.published,
    title: r.title,
    city: r.city,
    district: r.district,
    street: r.street,
    areaM2: num(r.area_m2),
    floor: r.floor,
    rentMonthly: num(r.rent_monthly),
    serviceChargeMonthly: num(r.service_charge_monthly),
    deposit: num(r.deposit),
    minimumTermMonths: r.minimum_term_months,
    earlyTermination: r.early_termination_allowed ? { allowed: true, noticeMonths: r.early_termination_notice_months ?? 0 } : { allowed: false },
    indexation: r.indexation_kind === "fixed_rate" ? { kind: "fixed_rate", ratePercent: num(r.indexation_rate_percent ?? 0) } : { kind: r.indexation_kind },
    permittedUses: r.permitted_uses as BusinessType[],
    tenantPaysStructuralRepairs: r.tenant_pays_structural_repairs,
    leaseDraft: r.lease_draft,
    description: r.description,
    imageUrl: r.image_url,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

/** Entity props to a row. created_at and updated_at are set by the database (default and trigger). */
export function propsToRow(p: SpaceListingProps): Omit<ListingRow, "created_at" | "updated_at"> & { created_at?: string } {
  return {
    id: p.id,
    owner_id: p.ownerId,
    is_demo: p.isDemo,
    published: p.published,
    title: p.title,
    city: p.city,
    district: p.district,
    street: p.street,
    area_m2: p.areaM2,
    floor: p.floor,
    rent_monthly: p.rentMonthly,
    service_charge_monthly: p.serviceChargeMonthly,
    deposit: p.deposit,
    minimum_term_months: p.minimumTermMonths,
    early_termination_allowed: p.earlyTermination.allowed,
    early_termination_notice_months: p.earlyTermination.allowed ? p.earlyTermination.noticeMonths : null,
    indexation_kind: p.indexation.kind,
    indexation_rate_percent: p.indexation.kind === "fixed_rate" ? p.indexation.ratePercent : null,
    permitted_uses: [...p.permittedUses],
    tenant_pays_structural_repairs: p.tenantPaysStructuralRepairs,
    lease_draft: p.leaseDraft ?? null,
    description: p.description ?? null,
    image_url: p.imageUrl ?? null,
  }
}

export const contactToRow = (c: ListingContact): ContactRow => ({ listing_id: c.listingId, name: c.name, phone: c.phone, email: c.email, consent_to_publish: true })
const rowToContact = (r: ContactRow): ListingContact => Object.freeze({ listingId: r.listing_id, name: r.name, phone: r.phone, email: r.email })

const LISTING_COLUMNS =
  "id,owner_id,is_demo,published,title,city,district,street,area_m2,floor,rent_monthly,service_charge_monthly,deposit,minimum_term_months,early_termination_allowed,early_termination_notice_months,indexation_kind,indexation_rate_percent,permitted_uses,tenant_pays_structural_repairs,lease_draft,description,image_url,created_at,updated_at"

/** A database error becomes a plain Error with no row data in it (rows may hold contacts). */
function check<T>(result: { data: T; error: { message: string; code?: string } | null }, what: string): T {
  if (result.error) throw new Error(`Supabase: could not ${what} (${result.error.code ?? "error"})`)
  return result.data
}

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } } as const

export class SupabaseListingStore implements ListingStore {
  private readonly anon: SupabaseClient
  private readonly service: SupabaseClient

  constructor(private readonly config: SupabaseStoreConfig) {
    this.anon = createClient(config.url, config.anonKey, NO_SESSION)
    this.service = createClient(config.url, config.serviceRoleKey, NO_SESSION)
  }

  /** A client that acts as the landlord (RLS sees auth.uid() = actor.id). */
  private as(actor: ListingActor): SupabaseClient {
    if (actor.kind !== "supabase" || !actor.accessToken) throw new DomainError("not_listing_owner", "Log in as a landlord to manage listings")
    return createClient(this.config.url, this.config.anonKey, { ...NO_SESSION, global: { headers: { Authorization: `Bearer ${actor.accessToken}` } } })
  }

  async listPublished(): Promise<SpaceListing[]> {
    const rows = check(await this.anon.from("listings").select(LISTING_COLUMNS).eq("published", true).order("created_at", { ascending: false }).order("id"), "read listings")
    return (rows as ListingRow[]).map((r) => SpaceListing.rehydrate(rowToProps(r)))
  }

  async get(id: string): Promise<SpaceListing | null> {
    const row = check(await this.anon.from("listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle(), "read a listing")
    return row ? SpaceListing.rehydrate(rowToProps(row as ListingRow)) : null
  }

  async listByOwner(actor: ListingActor): Promise<SpaceListing[]> {
    const rows = check(await this.as(actor).from("listings").select(LISTING_COLUMNS).eq("owner_id", actor.id).order("created_at", { ascending: false }).order("id"), "read your listings")
    return (rows as ListingRow[]).map((r) => SpaceListing.rehydrate(rowToProps(r)))
  }

  async create(actor: ListingActor, input: SpaceListingInput, contactInput: ListingContactInput): Promise<SpaceListing> {
    const db = this.as(actor)
    const id = newListingId()
    const draft = SpaceListing.create(input, { id, ownerId: actor.id, now: new Date().toISOString() })
    const contact = createListingContact(id, actor.displayName, contactInput) // validated before anything is written
    const { created_at: _ignored, ...row } = propsToRow(draft.props)
    const saved = check(await db.from("listings").insert(row).select(LISTING_COLUMNS).single(), "save the listing")
    const contactResult = await db.from("listing_contacts").insert(contactToRow(contact))
    if (contactResult.error) {
      await db.from("listings").delete().eq("id", id) // no listing without its contact
      check(contactResult, "save the contact")
    }
    return SpaceListing.rehydrate(rowToProps(saved as ListingRow))
  }

  async update(actor: ListingActor, id: string, input: SpaceListingInput, contactInput: ListingContactInput): Promise<SpaceListing> {
    const db = this.as(actor)
    const current = await this.requireOwn(db, id)
    if (current.props.isDemo) throw new DomainError("not_listing_owner", "Demo listings cannot be changed")
    const updated = current.update(input, actor.id, new Date().toISOString())
    const contact = createListingContact(id, actor.displayName, contactInput)
    const { created_at: _c, id: _id, owner_id: _o, is_demo: _d, ...changes } = propsToRow(updated.props)
    const saved = check(await db.from("listings").update(changes).eq("id", id).select(LISTING_COLUMNS).single(), "update the listing")
    check(await db.from("listing_contacts").upsert(contactToRow(contact)), "update the contact")
    return SpaceListing.rehydrate(rowToProps(saved as ListingRow))
  }

  async delete(actor: ListingActor, id: string): Promise<void> {
    const db = this.as(actor)
    const current = await this.requireOwn(db, id)
    current.assertCanChange(actor.id)
    if (current.props.isDemo) throw new DomainError("not_listing_owner", "Demo listings cannot be deleted")
    check(await db.from("listings").delete().eq("id", id), "delete the listing") // the contact goes with it (cascade)
  }

  async revealContact(id: string): Promise<ListingContact | null> {
    const listing = await this.get(id) // anon read: null unless published
    if (!listing || !listing.props.published) return null
    const row = check(await this.service.from("listing_contacts").select("listing_id,name,phone,email,consent_to_publish").eq("listing_id", id).maybeSingle(), "read the contact")
    return row ? rowToContact(row as ContactRow) : null
  }

  async ownContact(actor: ListingActor, id: string): Promise<ListingContact | null> {
    const db = this.as(actor)
    const listing = await this.requireOwn(db, id)
    listing.assertCanChange(actor.id)
    const row = check(await db.from("listing_contacts").select("listing_id,name,phone,email,consent_to_publish").eq("listing_id", id).maybeSingle(), "read your contact")
    return row ? rowToContact(row as ContactRow) : null
  }

  async recordView(id: string): Promise<void> {
    check(await this.service.rpc("record_listing_view", { p_listing_id: id }), "count a view")
  }

  async viewCounts(actor: ListingActor): Promise<Record<string, number>> {
    const rows = check(await this.as(actor).from("listing_views").select("listing_id,views"), "read view counts") as { listing_id: string; views: number | string }[]
    return Object.fromEntries(rows.map((r) => [r.listing_id, Number(r.views)]))
  }

  async savedIds(actor: ListingActor): Promise<string[]> {
    const rows = check(await this.as(actor).from("saved_listings").select("listing_id").order("created_at", { ascending: false }), "read saved spaces") as { listing_id: string }[]
    return rows.map((r) => r.listing_id)
  }

  async save(actor: ListingActor, id: string): Promise<void> {
    if (!(await this.get(id))) throw new DomainError("listing_not_found", `No listing "${id}"`)
    // Saving twice changes nothing (primary key user + listing).
    check(await this.as(actor).from("saved_listings").upsert({ user_id: actor.id, listing_id: id }, { onConflict: "user_id,listing_id", ignoreDuplicates: true }), "save the space")
  }

  async unsave(actor: ListingActor, id: string): Promise<void> {
    check(await this.as(actor).from("saved_listings").delete().eq("user_id", actor.id).eq("listing_id", id), "remove the saved space")
  }

  /** Read as the landlord, so an own unpublished listing is found too. */
  private async requireOwn(db: SupabaseClient, id: string): Promise<SpaceListing> {
    const row = check(await db.from("listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle(), "read the listing")
    if (!row) throw new DomainError("listing_not_found", `No listing "${id}"`)
    return SpaceListing.rehydrate(rowToProps(row as ListingRow))
  }
}
