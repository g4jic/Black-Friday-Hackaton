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

  it("without Supabase: local accounts on this machine (sign up, sign in, wrong password, sign out), no guest", async () => {
    const app = await buildServer({ auth: null, localAccountsFile: null, listingStore: new LocalListingStore({ seed: seedCatalogue(), file: null }) })
    expect((await app.inject({ method: "GET", url: "/api/auth-config" })).json()).toEqual({ enabled: true, local: true })
    const guest = (await app.inject({ method: "GET", url: "/api/session" })).json() as { backend: string; landlord: unknown }
    expect(guest).toMatchObject({ backend: "local", landlord: null })
    expect((await app.inject({ method: "GET", url: "/api/me/listings" })).statusCode).toBe(401)

    const short = await app.inject({ method: "POST", url: "/api/local-auth/sign-up", payload: { email: "ana@example.com", password: "short", displayName: "Ana" } })
    expect(short.statusCode).toBe(400)
    const up = await app.inject({ method: "POST", url: "/api/local-auth/sign-up", payload: { email: "Ana@Example.com", password: "long-enough-1", displayName: "Ana d.o.o." } })
    expect(up.statusCode).toBe(200)
    const { token, account } = up.json() as { token: string; account: { email: string; displayName: string } }
    expect(account).toMatchObject({ email: "ana@example.com", displayName: "Ana d.o.o." })
    expect(up.body).not.toContain("long-enough-1")
    expect((await app.inject({ method: "POST", url: "/api/local-auth/sign-up", payload: { email: "ana@example.com", password: "long-enough-1", displayName: "Ana" } })).statusCode).toBe(409)

    const me = (await app.inject({ method: "GET", url: "/api/session", headers: { authorization: `Bearer ${token}` } })).json() as { landlord: { displayName: string; kind: string } }
    expect(me.landlord).toMatchObject({ displayName: "Ana d.o.o.", kind: "local" })
    expect((await app.inject({ method: "GET", url: "/api/me/listings", headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200)

    expect((await app.inject({ method: "POST", url: "/api/local-auth/sign-in", payload: { email: "ana@example.com", password: "wrong-password" } })).statusCode).toBe(401)
    const again = await app.inject({ method: "POST", url: "/api/local-auth/sign-in", payload: { email: "ana@example.com", password: "long-enough-1" } })
    expect(again.statusCode).toBe(200)
    await app.inject({ method: "POST", url: "/api/local-auth/sign-out", headers: { authorization: `Bearer ${token}` } })
    expect((await app.inject({ method: "GET", url: "/api/local-auth/me", headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401)
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
