import type { FastifyInstance } from "fastify"
import { AvatarError, LocalAvatarStore, parseAvatarDataUrl, type AvatarStore } from "../auth/avatar-store.js"
import { LocalAccountError, type LocalAccounts } from "../auth/local-accounts.js"
import { bearerToken } from "../auth/supabase-auth.js"
import type { ActorResolver } from "./listing-routes.js"

/**
 * POST /api/me/avatar { image: "data:image/webp;base64,..." }: stores the signed-in user's profile photo and answers
 * with its address. With local accounts the address is saved on the account here; with Supabase the browser saves it
 * in its own user_metadata (avatar_url), next to display_name. GET /api/avatars/:id serves local photos.
 */
export function registerAvatarRoutes(app: FastifyInstance, options: { store: AvatarStore; resolveActor: ActorResolver; localAccounts: LocalAccounts | null }): void {
  app.post("/api/me/avatar", { bodyLimit: 1024 * 1024 }, async (req, reply) => {
    const actor = await options.resolveActor(req)
    if (!actor) return reply.code(401).send({ error: "Sign in first." })
    try {
      const image = parseAvatarDataUrl((req.body as { image?: unknown } | undefined)?.image)
      const avatarUrl = await options.store.save(actor.id, image)
      const account = options.localAccounts ? options.localAccounts.updateProfile(bearerToken(req), { avatarUrl }) : null
      return { avatarUrl, ...(account ? { account } : {}) }
    } catch (error) {
      if (error instanceof AvatarError) return reply.code(400).send({ error: error.message })
      if (error instanceof LocalAccountError) return reply.code(error.status).send({ error: error.message })
      req.log.error(error)
      return reply.code(502).send({ error: "The photo could not be saved. Try again." })
    }
  })

  const local = options.store instanceof LocalAvatarStore ? options.store : null
  if (local) {
    app.get("/api/avatars/:id", async (req, reply) => {
      const image = local.read(String((req.params as { id?: string }).id ?? ""))
      if (!image) return reply.code(404).send({ error: "Not found" })
      return reply.header("Content-Type", image.contentType).header("Cache-Control", "private, max-age=60").header("X-Content-Type-Options", "nosniff").send(image.bytes)
    })
  }
}
