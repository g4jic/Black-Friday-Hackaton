import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { FastifyRequest } from "fastify"
import type { ListingActor } from "../../application/listings/listing-store.js"

/**
 * Landlord accounts through Supabase Auth (email and password). The browser signs in with the public anon key and
 * sends its access token as "Authorization: Bearer <token>"; the server asks Supabase who that token belongs to.
 * The service role key is never used here (only the seed script and the server's own store use it).
 */
export type SupabaseAuthConfig = { readonly url: string; readonly anonKey: string }

/** Both values set, or null (then there are no accounts and everyone is the Local demo account). */
export function supabaseAuthConfig(env: NodeJS.ProcessEnv = process.env): SupabaseAuthConfig | null {
  const url = env.SUPABASE_URL?.trim()
  const anonKey = env.SUPABASE_ANON_KEY?.trim()
  return url && anonKey ? { url, anonKey } : null
}

export function bearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization
  const match = typeof header === "string" ? /^Bearer\s+(\S+)$/i.exec(header) : null
  return match ? match[1]! : null
}

/** Resolves the caller from the bearer token; null for a guest or an invalid or expired token. */
export function supabaseActorResolver(config: SupabaseAuthConfig, client?: Pick<SupabaseClient, "auth">): (req: FastifyRequest) => Promise<ListingActor | null> {
  const supabase = client ?? createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return async (req) => {
    const token = bearerToken(req)
    if (!token) return null
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return null
    const user = data.user
    const displayName = typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim() ? user.user_metadata.display_name.trim() : (user.email ?? "Owner")
    return { id: user.id, displayName, kind: "supabase", accessToken: token }
  }
}
