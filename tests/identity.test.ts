import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { AvatarError, LocalAvatarStore, MAX_AVATAR_BYTES, parseAvatarDataUrl } from "../src/adapters/auth/avatar-store.js"
import { LocalAccounts, MAX_DISPLAY_NAME_LENGTH } from "../src/adapters/auth/local-accounts.js"
import { buildServer } from "../src/adapters/server/server.js"
import { LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16])
const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString("base64")}`

const tmp = mkdtempSync(join(tmpdir(), "suitespot-avatars-"))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

describe("profile photo checks", () => {
  it("accepts a real JPEG, PNG or WebP", () => {
    expect(parseAvatarDataUrl(dataUrl("image/png", PNG_HEADER)).contentType).toBe("image/png")
    expect(parseAvatarDataUrl(dataUrl("image/jpeg", JPEG_HEADER)).contentType).toBe("image/jpeg")
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")])
    expect(parseAvatarDataUrl(dataUrl("image/webp", webp)).contentType).toBe("image/webp")
  })

  it("refuses no photo, another type, a renamed file and a photo over the size limit", () => {
    expect(() => parseAvatarDataUrl(undefined)).toThrow(AvatarError)
    expect(() => parseAvatarDataUrl(dataUrl("image/svg+xml", Buffer.from("<svg/>")))).toThrow(/JPEG, PNG or WebP/)
    expect(() => parseAvatarDataUrl(dataUrl("image/png", JPEG_HEADER))).toThrow(/not the image type/)
    const huge = Buffer.concat([PNG_HEADER, Buffer.alloc(MAX_AVATAR_BYTES)])
    expect(() => parseAvatarDataUrl(dataUrl("image/png", huge))).toThrow(/too large/)
  })

  it("the local store keeps one photo per account and refuses an unsafe account id", async () => {
    const store = new LocalAvatarStore(tmp)
    const url = await store.save("local-abc", parseAvatarDataUrl(dataUrl("image/png", PNG_HEADER)))
    expect(url).toMatch(/^\/api\/avatars\/local-abc\?v=\d+$/)
    expect(store.read("local-abc")?.bytes.equals(PNG_HEADER)).toBe(true)
    await expect(store.save("../etc", parseAvatarDataUrl(dataUrl("image/png", PNG_HEADER)))).rejects.toThrow(AvatarError)
    expect(store.read("../etc")).toBeNull()
  })
})

describe("editing the account (local accounts)", () => {
  const signUp = (accounts: LocalAccounts, email: string) => accounts.signUp({ email, password: "long-enough-1", displayName: "Ana" }).token

  it("changes the name and the email, checks everything before it saves anything", () => {
    const accounts = new LocalAccounts(null)
    const token = signUp(accounts, "ana@example.com")
    signUp(accounts, "taken@example.com")
    expect(accounts.updateProfile(token, { displayName: "  Ana d.o.o. ", email: "Ana.New@Example.com" })).toMatchObject({ displayName: "Ana d.o.o.", email: "ana.new@example.com" })
    // sign in works with the new email
    expect(() => accounts.signIn({ email: "ana.new@example.com", password: "long-enough-1" })).not.toThrow()

    expect(() => accounts.updateProfile(token, { displayName: "" })).toThrow(/name/)
    expect(() => accounts.updateProfile(token, { displayName: "x".repeat(MAX_DISPLAY_NAME_LENGTH + 1) })).toThrow(/at most/)
    expect(() => accounts.updateProfile(token, { email: "not-an-email" })).toThrow(/valid email/)
    // a duplicate email is refused, and the valid name in the same request is not saved either
    expect(() => accounts.updateProfile(token, { displayName: "Changed", email: "taken@example.com" })).toThrow(expect.objectContaining({ status: 409 }))
    expect(accounts.publicAccount(token)).toMatchObject({ displayName: "Ana d.o.o.", email: "ana.new@example.com" })
  })

  it("only takes a photo address of its own account from the upload", () => {
    const accounts = new LocalAccounts(null)
    const token = signUp(accounts, "ana@example.com")
    const id = accounts.publicAccount(token)!.id
    expect(() => accounts.updateProfile(token, { avatarUrl: "https://evil.example/x.png" })).toThrow(/Upload the photo/)
    expect(() => accounts.updateProfile(token, { avatarUrl: "/api/avatars/local-someone-else?v=1" })).toThrow(/Upload the photo/)
    expect(accounts.updateProfile(token, { avatarUrl: `/api/avatars/${id}?v=1` }).avatarUrl).toBe(`/api/avatars/${id}?v=1`)
    expect(accounts.updateProfile(token, { avatarUrl: null }).avatarUrl).toBeNull()
    expect(() => accounts.updateProfile(null, { displayName: "X" })).toThrow(expect.objectContaining({ status: 401 }))
  })
})

describe("profile photo over HTTP", () => {
  it("a signed-in user uploads a photo, sees it on the account and the server serves it; a guest is refused", async () => {
    const app = await buildServer({ auth: null, localAccountsFile: null, avatarStore: new LocalAvatarStore(tmp), listingStore: new LocalListingStore({ seed: seedCatalogue(), file: null }) })
    const image = dataUrl("image/jpeg", JPEG_HEADER)
    expect((await app.inject({ method: "POST", url: "/api/me/avatar", payload: { image } })).statusCode).toBe(401)
    const up = (await app.inject({ method: "POST", url: "/api/local-auth/sign-up", payload: { email: "ana@example.com", password: "long-enough-1", displayName: "Ana" } })).json() as { token: string }
    const headers = { authorization: `Bearer ${up.token}` }

    const bad = await app.inject({ method: "POST", url: "/api/me/avatar", headers, payload: { image: dataUrl("image/png", JPEG_HEADER) } })
    expect(bad.statusCode).toBe(400)
    const saved = await app.inject({ method: "POST", url: "/api/me/avatar", headers, payload: { image } })
    expect(saved.statusCode).toBe(200)
    const { avatarUrl, account } = saved.json() as { avatarUrl: string; account: { avatarUrl: string } }
    expect(account.avatarUrl).toBe(avatarUrl)

    const served = await app.inject({ method: "GET", url: avatarUrl })
    expect(served.statusCode).toBe(200)
    expect(served.headers["content-type"]).toBe("image/jpeg")
    expect(served.rawPayload.equals(JPEG_HEADER)).toBe(true)
    expect((await app.inject({ method: "GET", url: "/api/avatars/local-unknown" })).statusCode).toBe(404)
    await app.close()
  })
})
