import { afterEach, describe, expect, it } from "vitest"
import { supabaseActorResolver, supabaseAuthConfig } from "../src/adapters/auth/supabase-auth.js"
import { buildServer } from "../src/adapters/server/server.js"
import { LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"

const CONFIG = { url: "https://example.supabase.co", anonKey: "public-anon-key-for-tests" }

/** A fake Supabase auth client: one valid token, everything else is rejected. No network. */
const fakeClient = {
  auth: {
    getUser: async (token: string) =>
      token === "valid-token"
        ? { data: { user: { id: "user-1", email: "landlord@example.com", user_metadata: { display_name: "Ana Petrović" } } }, error: null }
        : { data: { user: null }, error: { message: "invalid JWT" } },
  },
} as never

describe("landlord accounts (Supabase Auth)", () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
  })

  it("is on only with both SUPABASE_URL and SUPABASE_ANON_KEY", () => {
    expect(supabaseAuthConfig({ SUPABASE_URL: CONFIG.url } as NodeJS.ProcessEnv)).toBeNull()
    expect(supabaseAuthConfig({ SUPABASE_URL: CONFIG.url, SUPABASE_ANON_KEY: CONFIG.anonKey } as NodeJS.ProcessEnv)).toEqual(CONFIG)
  })

  it("without Supabase: no accounts, everyone publishes as the Local demo account", async () => {
    const app = await buildServer({ auth: null, listingStore: new LocalListingStore({ seed: seedCatalogue(), file: null }) })
    expect((await app.inject({ method: "GET", url: "/api/auth-config" })).json()).toEqual({ enabled: false })
    const session = (await app.inject({ method: "GET", url: "/api/session" })).json() as { backend: string; landlord: { displayName: string } }
    expect(session.backend).toBe("local")
    expect(session.landlord.displayName).toBe("Local demo account")
    await app.close()
  })

  it("with Supabase: a guest gets 401 on landlord routes, a valid token is the landlord, the service role key never leaves", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret-THIS-MUST-NEVER-LEAVE"
    const app = await buildServer({ auth: CONFIG, resolveActor: supabaseActorResolver(CONFIG, fakeClient), listingStore: new LocalListingStore({ seed: seedCatalogue(), file: null }) })
    const config = await app.inject({ method: "GET", url: "/api/auth-config" })
    expect(config.json()).toEqual({ enabled: true, url: CONFIG.url, anonKey: CONFIG.anonKey })
    expect(config.body).not.toContain("service-role-secret")

    expect((await app.inject({ method: "GET", url: "/api/me/listings" })).statusCode).toBe(401)
    expect((await app.inject({ method: "GET", url: "/api/me/listings", headers: { authorization: "Bearer expired" } })).statusCode).toBe(401)
    const mine = await app.inject({ method: "GET", url: "/api/me/listings", headers: { authorization: "Bearer valid-token" } })
    expect(mine.statusCode).toBe(200)
    const session = (await app.inject({ method: "GET", url: "/api/session", headers: { authorization: "Bearer valid-token" } })).json()
    expect(session).toMatchObject({ backend: "supabase", landlord: { id: "user-1", displayName: "Ana Petrović", kind: "supabase" } })
    // Public reads need no account.
    expect((await app.inject({ method: "GET", url: "/api/listings" })).statusCode).toBe(200)
    await app.close()
  })
})
