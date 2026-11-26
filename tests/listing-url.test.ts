import { describe, expect, it } from "vitest"
import { DomainError, createListingBatch, validateListingUrl } from "../src/domain/index.js"

describe("listing URL (only when really given, only http(s))", () => {
  it("keeps a user-given http(s) address with a listing source", () => {
    const [listing] = createListingBatch([{ text: "Lokal 60 m2", url: " https://example.com/oglas/123 " }])
    expect(listing!.url).toEqual({ value: "https://example.com/oglas/123", source: { kind: "listing", ref: "pasted-1", field: "url" } })
  })
  it("no URL given means none: nothing is built or guessed", () => {
    expect(createListingBatch([{ text: "Lokal 60 m2" }])[0]!.url).toBeNull()
    expect(validateListingUrl("   ", 1)).toBeNull()
  })
  it("rejects other schemes, credentials and garbage", () => {
    expect(() => validateListingUrl("javascript:alert(1)", 1)).toThrow(DomainError)
    expect(() => validateListingUrl("ftp://example.com/x", 2)).toThrow("must start with http:// or https://")
    expect(() => validateListingUrl("https://user:pass@example.com/", 3)).toThrow("user name or password")
    expect(() => validateListingUrl("not a url", 4)).toThrow("not a valid address")
  })
})
