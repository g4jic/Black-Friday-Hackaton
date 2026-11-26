import Fastify, { type FastifyInstance } from "fastify"
import fastifyStatic from "@fastify/static"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { InferenceRunner } from "@mozaik-ai/core"
import type { DemoLatency } from "../inference/scripts/demo-script.js"
import type { ListingStore } from "../../application/listings/listing-store.js"
import { seedCatalogue } from "../seed/seed-catalogue.js"
import { LOCAL_LANDLORD, LOCAL_LISTINGS_FILE, LocalListingStore } from "../storage/local-listing-store.js"
import { SupabaseListingStore, supabaseStoreConfig } from "../storage/supabase-listing-store.js"
import { registerListingRoutes, type ActorResolver } from "./listing-routes.js"
import { supabaseActorResolver, supabaseAuthConfig, type SupabaseAuthConfig } from "../auth/supabase-auth.js"
import { registerResearchRoutes, type DemoCatalogue } from "./research-routes.js"

const webDist = fileURLToPath(new URL("../../../web/dist", import.meta.url))

/** Live when the server has ANTHROPIC_API_KEY (real model runs); without a key the keyless demo (scripted answers). */
export function runMode(): "demo" | "live" {
  return process.env.ANTHROPIC_API_KEY?.trim() ? "live" : "demo"
}

export type ServerOptions = {
  readonly demoPace?: DemoLatency
  readonly liveRunner?: () => InferenceRunner
  readonly demoCatalogue?: DemoCatalogue
  /** For tests: a store without a file. Default: the local store (seed + data/local-listings.json). */
  readonly listingStore?: ListingStore
  readonly resolveActor?: ActorResolver
  /** For tests: the auth config instead of SUPABASE_URL and SUPABASE_ANON_KEY (null = no accounts). */
  readonly auth?: SupabaseAuthConfig | null
}

export async function buildServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } })

  app.get("/api/health", async () => ({ status: "ok", mode: runMode() }))
  // The API key stays in this process: no route returns it, and every outgoing event is scrubbed of it.
  // With SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY: listings live in Supabase.
  // Without them: the local store, and every caller acts as the one Local demo landlord (clearly labelled).
  const storeConfig = supabaseStoreConfig()
  const listingStore = options.listingStore ?? (storeConfig ? new SupabaseListingStore(storeConfig) : new LocalListingStore({ seed: seedCatalogue(), file: LOCAL_LISTINGS_FILE }))
  // With SUPABASE_URL and SUPABASE_ANON_KEY: landlord accounts (Supabase Auth). The anon key is public by design;
  // the browser gets it from /api/auth-config so the same env names work for the server and the frontend.
  const auth = options.auth === undefined ? supabaseAuthConfig() : options.auth
  app.get("/api/auth-config", async () => (auth ? { enabled: true, url: auth.url, anonKey: auth.anonKey } : { enabled: false }))
  const resolveActor = options.resolveActor ?? (auth ? supabaseActorResolver(auth) : async () => LOCAL_LANDLORD)
  registerListingRoutes(app, { store: listingStore, resolveActor, backend: auth ? "supabase" : "local" })
  registerResearchRoutes(app, { liveAvailable: () => runMode() === "live", demoPace: options.demoPace, liveRunner: options.liveRunner, demoCatalogue: options.demoCatalogue, listingStore })

  // In production the built web app is served by this same process (one Railway service).
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist })
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" })
      return reply.sendFile("index.html")
    })
  }
  return app
}
