import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import type { ListingActor, ListingStore } from "../../application/listings/listing-store.js"
import { DomainError, ListingValidationError, maskPhone, type ListingContact, type ListingContactInput, type SpaceListing, type SpaceListingInput } from "../../domain/index.js"

/** Who is calling: a signed-in landlord, the local demo landlord, or nobody (a guest). */
export type ActorResolver = (req: FastifyRequest) => Promise<ListingActor | null>

export type ListingRoutesOptions = {
  readonly store: ListingStore
  readonly resolveActor: ActorResolver
  readonly backend: "local" | "supabase"
}

/** What anyone may see of a listing. Contacts are never part of it. */
export function publicListing(listing: SpaceListing) {
  const p = listing.props
  return {
    id: p.id,
    isDemo: p.isDemo,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    title: p.title,
    city: p.city,
    district: p.district,
    street: p.street,
    areaM2: p.areaM2,
    floor: p.floor,
    rentMonthly: p.rentMonthly,
    serviceChargeMonthly: p.serviceChargeMonthly,
    deposit: p.deposit,
    currency: "EUR" as const,
    minimumTermMonths: p.minimumTermMonths,
    earlyTermination: p.earlyTermination,
    indexation: p.indexation,
    permittedUses: p.permittedUses,
    tenantPaysStructuralRepairs: p.tenantPaysStructuralRepairs,
    description: p.description ?? null,
    imageUrl: p.imageUrl ?? null,
    leaseDraft: p.leaseDraft ?? null,
  }
}

/**
 * A revealed contact. On a demo listing the phone is partly masked (a generated number may belong to a real person),
 * the email is an example.com address, and the browser gets no tel: or mailto: link (links: false).
 */
export function revealedContact(contact: ListingContact, isDemo: boolean) {
  return { name: contact.name, phone: contact.phone ? (isDemo ? maskPhone(contact.phone) : contact.phone) : null, email: contact.email, isDemo, links: !isDemo }
}

type ListingBody = { listing?: SpaceListingInput; contact?: ListingContactInput }

function send(reply: FastifyReply, error: unknown, req: FastifyRequest) {
  if (error instanceof ListingValidationError) return reply.code(400).send({ error: error.message, problems: error.problems })
  if (error instanceof DomainError) {
    const status = error.code === "not_listing_owner" ? 403 : error.code === "listing_not_found" ? 404 : 400
    return reply.code(status).send({ error: error.message })
  }
  req.log.error(error)
  return reply.code(500).send({ error: "Something went wrong with the listing" })
}

export function registerListingRoutes(app: FastifyInstance, options: ListingRoutesOptions): void {
  const { store, resolveActor } = options
  const landlord = async (req: FastifyRequest, reply: FastifyReply): Promise<ListingActor | null> => {
    const actor = await resolveActor(req)
    if (!actor) {
      await reply.code(401).send({ error: "Sign in to continue" })
      return null
    }
    return actor
  }

  app.get("/api/session", async (req) => {
    const actor = await resolveActor(req)
    return { backend: options.backend, landlord: actor ? { id: actor.id, displayName: actor.displayName, kind: actor.kind } : null }
  })

  app.get("/api/listings", async () => ({ listings: (await store.listPublished()).map(publicListing) }))

  app.get("/api/listings/:id", async (req, reply) => {
    const listing = await store.get((req.params as { id: string }).id)
    if (!listing || !listing.props.published) return reply.code(404).send({ error: "No such listing" })
    return publicListing(listing)
  })

  /** "Show contact": a POST, never cached, and the contact is never written to the log. */
  app.post("/api/listings/:id/contact", async (req, reply) => {
    const id = (req.params as { id: string }).id
    const [listing, contact] = await Promise.all([store.get(id), store.revealContact(id)])
    if (!listing || !contact) return reply.code(404).send({ error: "No contact for this listing" })
    return reply.header("Cache-Control", "no-store").send(revealedContact(contact, listing.props.isDemo))
  })

  /** Counts one opening of a listing page. Best effort: a failed count never breaks the page. */
  app.post("/api/listings/:id/view", async (req, reply) => {
    try {
      await store.recordView((req.params as { id: string }).id)
    } catch (error) {
      req.log.warn({ err: error }, "could not count a listing view")
    }
    return reply.code(204).send()
  })

  app.get("/api/me/listings", async (req, reply) => {
    const actor = await landlord(req, reply)
    if (!actor) return reply
    const [listings, views] = await Promise.all([store.listByOwner(actor), store.viewCounts(actor).catch(() => ({}) as Record<string, number>)])
    return { listings: listings.map((l) => ({ ...publicListing(l), views: views[l.id] ?? 0 })) }
  })

  /** My spaces: the saved listings that are still published. */
  app.get("/api/me/saved", async (req, reply) => {
    const actor = await landlord(req, reply)
    if (!actor) return reply
    try {
      const ids = await store.savedIds(actor)
      const listings = await Promise.all(ids.map((id) => store.get(id)))
      return { listings: listings.filter((l): l is SpaceListing => Boolean(l?.props.published)).map(publicListing) }
    } catch (error) {
      return send(reply, error, req)
    }
  })

  app.put("/api/me/saved/:id", async (req, reply) => {
    const actor = await landlord(req, reply)
    if (!actor) return reply
    try {
      await store.save(actor, (req.params as { id: string }).id)
      return reply.code(204).send()
    } catch (error) {
      return send(reply, error, req)
    }
  })

  app.delete("/api/me/saved/:id", async (req, reply) => {
    const actor = await landlord(req, reply)
    if (!actor) return reply
    try {
      await store.unsave(actor, (req.params as { id: string }).id)
      return reply.code(204).send()
    } catch (error) {
      return send(reply, error, req)
    }
  })

  app.get("/api/me/listings/:id", async (req, reply) => {
    const actor = await landlord(req, reply)
    if (!actor) return reply
    try {
      const id = (req.params as { id: string }).id
      const contact = await store.ownContact(actor, id)
      const listing = (await store.get(id))!
      return reply.header("Cache-Control", "no-store").send({ listing: publicListing(listing), contact: contact ? { phone: contact.phone, email: contact.email } : null })
    } catch (error) {
      return send(reply, error, req)
    }
  })

  app.post("/api/me/listings", async (req, reply) => {
    const actor = await landlord(req, reply)
    if (!actor) return reply
    try {
      const body = (req.body ?? {}) as ListingBody
      const listing = await store.create(actor, body.listing ?? ({} as SpaceListingInput), body.contact ?? { consentToPublish: false })
      return reply.code(201).send(publicListing(listing))
    } catch (error) {
      return send(reply, error, req)
    }
  })

  app.put("/api/me/listings/:id", async (req, reply) => {
    const actor = await landlord(req, reply)
    if (!actor) return reply
    try {
      const body = (req.body ?? {}) as ListingBody
      const listing = await store.update(actor, (req.params as { id: string }).id, body.listing ?? ({} as SpaceListingInput), body.contact ?? { consentToPublish: false })
      return publicListing(listing)
    } catch (error) {
      return send(reply, error, req)
    }
  })

  app.delete("/api/me/listings/:id", async (req, reply) => {
    const actor = await landlord(req, reply)
    if (!actor) return reply
    try {
      await store.delete(actor, (req.params as { id: string }).id)
      return reply.code(204).send()
    } catch (error) {
      return send(reply, error, req)
    }
  })
}
