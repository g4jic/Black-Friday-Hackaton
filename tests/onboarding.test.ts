import { describe, expect, it } from "vitest"
import { LocalAccounts } from "../src/adapters/auth/local-accounts.js"
import { buildServer } from "../src/adapters/server/server.js"
import { LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { onboardingPath, onboardingRedirect, safeNext } from "../web/src/app/onboarding-gate.js"

describe("onboarding gate (web/src/app/onboarding-gate.ts)", () => {
  it("sends an account that has not finished the onboarding to /onboarding, remembering the page", () => {
    expect(onboardingRedirect({ onboardedAt: null, onOnboarding: false, step: null, here: "/history?x=1", next: null })).toBe("/onboarding?next=%2Fhistory%3Fx%3D1")
    expect(onboardingRedirect({ onboardedAt: null, onOnboarding: true, step: null, here: "/onboarding", next: "/history" })).toBeNull()
  })

  it("a returning user who finished the onboarding goes straight in, and /onboarding sends them on", () => {
    expect(onboardingRedirect({ onboardedAt: "2026-11-27T20:00:00.000Z", onOnboarding: false, step: null, here: "/history", next: null })).toBeNull()
    expect(onboardingRedirect({ onboardedAt: "2026-11-27T20:00:00.000Z", onOnboarding: true, step: null, here: "/onboarding", next: "/my-listings" })).toBe("/my-listings")
    expect(onboardingRedirect({ onboardedAt: "2026-11-27T20:00:00.000Z", onOnboarding: true, step: null, here: "/onboarding", next: null })).toBe("/")
  })

  it("a form step stays open for every account (onboarding steps, and adding a role later); skip moves through the same paths", () => {
    expect(onboardingRedirect({ onboardedAt: null, onOnboarding: true, step: "seeker", here: "/onboarding?step=seeker", next: "/" })).toBeNull()
    expect(onboardingRedirect({ onboardedAt: "2026-11-27T20:00:00.000Z", onOnboarding: true, step: "owner", here: "/onboarding?step=owner&add=1", next: "/history" })).toBeNull()
    expect(onboardingRedirect({ onboardedAt: "2026-11-27T20:00:00.000Z", onOnboarding: true, step: "nonsense", here: "/onboarding?step=nonsense", next: "/history" })).toBe("/history")
    expect(onboardingPath("role", { next: null })).toBe("/onboarding")
    expect(onboardingPath("owner", { next: "/history" })).toBe("/onboarding?step=owner&next=%2Fhistory")
    expect(onboardingPath("seeker", { next: "/", add: true })).toBe("/onboarding?step=seeker&add=1&next=%2F")
  })

  it("never sends the user back to sign in, sign up, the onboarding or another site", () => {
    for (const bad of ["/login", "/signup?next=/", "/onboarding?next=/", "//evil.example", "https://evil.example", "", null]) expect(safeNext(bad)).toBe("/")
    expect(safeNext("/research/new?mode=find")).toBe("/research/new?mode=find")
  })
})

describe("onboarding answers on a local account", () => {
  const signUp = (accounts: LocalAccounts) => accounts.signUp({ email: "owner@example.com", password: "long-enough-1", displayName: "Owner d.o.o." }).token

  it("starts with no role and not onboarded; saves the role, then the done flag once (idempotent)", () => {
    const accounts = new LocalAccounts(null)
    const token = signUp(accounts)
    expect(accounts.publicAccount(token)).toMatchObject({ role: null, onboardedAt: null })
    expect(accounts.updateProfile(token, { role: "owner" })).toMatchObject({ role: "owner", onboardedAt: null })
    const done = accounts.updateProfile(token, { onboarded: true })
    expect(done.onboardedAt).toEqual(expect.any(String))
    // Changing the role later (Settings) keeps the onboarding finished; a second "done" keeps the first time.
    expect(accounts.updateProfile(token, { role: "both", onboarded: true })).toMatchObject({ role: "both", onboardedAt: done.onboardedAt })
  })

  it("refuses an unknown role, undoing the onboarding, and a request without a session", () => {
    const accounts = new LocalAccounts(null)
    const token = signUp(accounts)
    expect(() => accounts.updateProfile(token, { role: "admin" })).toThrow(/role must be one of/)
    expect(() => accounts.updateProfile(token, { onboarded: false })).toThrow(/only be set to true/)
    expect(() => accounts.updateProfile(null, { role: "owner" })).toThrow(/Sign in first/)
    expect(() => accounts.updateProfile("not-a-token", { role: "owner" })).toThrow(/Sign in first/)
  })

  it("POST /api/local-auth/profile saves the answers; sign in and /me return them; no password hash leaves", async () => {
    const app = await buildServer({ auth: null, localAccountsFile: null, listingStore: new LocalListingStore({ seed: seedCatalogue(), file: null }) })
    const up = await app.inject({ method: "POST", url: "/api/local-auth/sign-up", payload: { email: "seeker@example.com", password: "long-enough-1", displayName: "Cafe Liman" } })
    const { token, account } = up.json() as { token: string; account: Record<string, unknown> }
    expect(account).toMatchObject({ role: null, onboardedAt: null })
    const auth = { authorization: `Bearer ${token}` }

    expect((await app.inject({ method: "POST", url: "/api/local-auth/profile", payload: { role: "seeker" } })).statusCode).toBe(401)
    expect((await app.inject({ method: "POST", url: "/api/local-auth/profile", headers: auth, payload: { role: "landlord" } })).statusCode).toBe(400)
    const saved = await app.inject({ method: "POST", url: "/api/local-auth/profile", headers: auth, payload: { role: "seeker", onboarded: true } })
    expect(saved.statusCode).toBe(200)
    expect(saved.json()).toMatchObject({ account: { role: "seeker", onboardedAt: expect.any(String) } })

    const me = (await app.inject({ method: "GET", url: "/api/local-auth/me", headers: auth })).json() as { account: Record<string, unknown> }
    expect(me.account).toMatchObject({ email: "seeker@example.com", role: "seeker", onboardedAt: expect.any(String) })
    const again = await app.inject({ method: "POST", url: "/api/local-auth/sign-in", payload: { email: "seeker@example.com", password: "long-enough-1" } })
    expect(again.json()).toMatchObject({ account: { role: "seeker", onboardedAt: expect.any(String) } })
    for (const body of [saved.body, again.body, JSON.stringify(me)]) {
      expect(body).not.toContain("long-enough-1")
      expect(body).not.toMatch(/"(hash|salt)"/)
    }
    await app.close()
  })
})
