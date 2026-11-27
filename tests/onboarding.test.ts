import { describe, expect, it } from "vitest"
import { LocalAccounts } from "../src/adapters/auth/local-accounts.js"
import { buildServer } from "../src/adapters/server/server.js"
import { LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { maskEmail, planRoleBackfill } from "../src/adapters/auth/role-backfill.js"
import { onboardingFromMetadata, onboardingPath, onboardingRedirect, safeNext } from "../web/src/app/onboarding-gate.js"

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

describe("an account without a role still works (made before the onboarding, or between the role backfill and a deploy)", () => {
  it("reads missing or unknown metadata as not given, and the gate sends that account to the role choice", () => {
    for (const meta of [undefined, null, {}, { display_name: "Ana" }, { role: "landlord", onboarded_at: 5 }, { onboarded_at: "" }]) {
      const { role, onboardedAt } = onboardingFromMetadata(meta as Record<string, unknown> | null | undefined)
      expect({ role, onboardedAt }).toEqual({ role: null, onboardedAt: null })
      expect(onboardingRedirect({ onboardedAt, onOnboarding: false, step: null, here: "/my-listings", next: null })).toBe("/onboarding?next=%2Fmy-listings")
    }
    // A role chosen but the onboarding not finished: back to the onboarding, which continues from the role's form.
    expect(onboardingFromMetadata({ role: "owner" })).toEqual({ role: "owner", onboardedAt: null })
    expect(onboardingFromMetadata({ role: "seeker", onboarded_at: "2026-11-27T20:00:00.000Z" })).toEqual({ role: "seeker", onboardedAt: "2026-11-27T20:00:00.000Z" })
  })
})

describe("role backfill plan (scripts/backfill-roles.ts)", () => {
  const accounts = [
    { id: "u1", email: "aleksa@gmail.com", metadata: { display_name: "Aleksa" } },
    { id: "u2", email: "demo.owner@example.com", metadata: {} },
    { id: "u3", email: "chosen@example.com", metadata: { role: "both", onboarded_at: "2026-11-27T19:00:00.000Z" } },
    { id: "u4", email: null, metadata: { role: "bogus" } },
  ]
  const plan = planRoleBackfill(accounts, new Map([["u2", 3], ["u3", 1]]), "2026-11-27T21:00:00.000Z")

  it("owner with at least one listing, seeker without; accounts with a role are left alone", () => {
    expect(plan.skipped).toBe(1)
    expect(plan.byRole).toEqual({ owner: 1, seeker: 2 })
    expect(plan.changes.map((c) => [c.id, c.role, c.listings])).toEqual([
      ["u2", "owner", 3],
      ["u4", "seeker", 0],
      ["u1", "seeker", 0],
    ])
  })

  it("keeps the other metadata, adds onboarded_at, and shows only masked emails", () => {
    expect(plan.changes.find((c) => c.id === "u1")!.metadata).toEqual({ display_name: "Aleksa", role: "seeker", onboarded_at: "2026-11-27T21:00:00.000Z" })
    expect(plan.changes.map((c) => c.maskedEmail)).toEqual(["d***@example.com", "(no email)", "a***@gmail.com"])
    expect(maskEmail("x@y.rs")).toBe("x***@y.rs")
  })
})
