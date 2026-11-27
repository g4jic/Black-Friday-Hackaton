import type { FastifyInstance } from "fastify"
import { randomUUID } from "node:crypto"
import { ImageError, LocalImageStore, MAX_LISTING_PHOTO_BYTES, parseImageDataUrl, type ImageStore } from "../storage/image-store.js"
import { LocalAccountError, type LocalAccounts } from "../auth/local-accounts.js"
import { bearerToken } from "../auth/supabase-auth.js"
import type { ActorResolver } from "./listing-routes.js"

/**
 * POST /api/me/avatar { image: "data:image/webp;base64,..." }: stores the signed-in user's profile photo and answers
 * with its address. With local accounts the address is saved on the account here; with Supabase the browser saves it
 * in its own user_metadata (avatar_url), next to display_name. GET /api/avatars/:id serves local photos.
 */
export function registerAvatarRoutes(app: FastifyInstance, options: { store: ImageStore; resolveActor: ActorResolver; localAccounts: LocalAccounts | null }): void {
  app.post("/api/me/avatar", { bodyLimit: 1024 * 1024 }, async (req, reply) => {
    const actor = await options.resolveActor(req)
    if (!actor) return reply.code(401).send({ error: "Sign in first." })
    try {
      const image = parseImageDataUrl((req.body as { image?: unknown } | undefined)?.image)
      const avatarUrl = await options.store.save(actor.id, image)
      const account = options.localAccounts ? options.localAccounts.updateProfile(bearerToken(req), { avatarUrl }) : null
      return { avatarUrl, ...(account ? { account } : {}) }
    } catch (error) {
      if (error instanceof ImageError) return reply.code(400).send({ error: error.message })
      if (error instanceof LocalAccountError) return reply.code(error.status).send({ error: error.message })
      req.log.error(error)
      return reply.code(502).send({ error: "The photo could not be saved. Try again." })
    }
  })

  const local = options.store instanceof LocalImageStore ? options.store : null
  if (local) {
    app.get("/api/avatars/:id", async (req, reply) => {
      const image = local.read(String((req.params as { id?: string }).id ?? ""))
      if (!image) return reply.code(404).send({ error: "Not found" })
      return reply.header("Content-Type", image.contentType).header("Cache-Control", "private, max-age=60").header("X-Content-Type-Options", "nosniff").send(image.bytes)
    })
  }
}

/**
 * POST /api/me/listing-photos { image: "data:image/jpeg;base64,..." }: stores one photo for a listing the signed-in
 * owner is writing and answers with its address. The listing form keeps the addresses and saves them with the listing
 * (at most MAX_LISTING_PHOTOS, checked by the domain). GET /api/listing-photos/:id serves local photos.
 */
export function registerListingPhotoRoutes(app: FastifyInstance, options: { store: ImageStore; resolveActor: ActorResolver }): void {
  app.post("/api/me/listing-photos", { bodyLimit: 2304 * 1024 }, async (req, reply) => {
    const actor = await options.resolveActor(req)
    if (!actor) return reply.code(401).send({ error: "Sign in first." })
    try {
      const image = parseImageDataUrl((req.body as { image?: unknown } | undefined)?.image, MAX_LISTING_PHOTO_BYTES)
      const key = `${actor.id.replace(/[^A-Za-z0-9-]/g, "")}-${randomUUID()}`
      return { url: await options.store.save(key, image) }
    } catch (error) {
      if (error instanceof ImageError) return reply.code(400).send({ error: error.message })
      req.log.error(error)
      return reply.code(502).send({ error: "The photo could not be saved. Try again." })
    }
  })

  const local = options.store instanceof LocalImageStore ? options.store : null
  if (local) {
    app.get("/api/listing-photos/:id", async (req, reply) => {
      const image = local.read(String((req.params as { id?: string }).id ?? ""))
      if (!image) return reply.code(404).send({ error: "Not found" })
      return reply.header("Content-Type", image.contentType).header("Cache-Control", "public, max-age=3600").header("X-Content-Type-Options", "nosniff").send(image.bytes)
    })
  }
}
