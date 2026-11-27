import { describe, expect, it } from "vitest"
import { BLOCKED_NOTICE, navKeysFor, pageBlockedFor } from "../web/src/app/roles.js"

describe("the interface by role (web/src/app/roles.ts)", () => {
  it("the role filters the sidebar; Home is there for everyone", () => {
    expect(navKeysFor("owner")).toEqual(["home", "myListings", "addSpace", "offers"])
    expect(navKeysFor("seeker")).toEqual(["home", "research", "listings", "mySpaces", "history"])
    expect(navKeysFor("both")).toEqual(["home", "research", "listings", "mySpaces", "history", "myListings", "offers"])
    // No research for an owner, no adding spaces for a seeker.
    expect(navKeysFor("owner")).not.toContain("research")
    expect(navKeysFor("seeker")).not.toContain("addSpace")
    expect(navKeysFor("seeker")).not.toContain("myListings")
  })

  it("a page of the other role is blocked (App sends the user Home with a notice); shared pages are open to all", () => {
    for (const page of ["newResearch", "run", "results", "candidate", "history", "listings", "mySpaces"]) {
      expect(pageBlockedFor("owner", page)).toBe("seeker")
      expect(pageBlockedFor("seeker", page)).toBeNull()
      expect(pageBlockedFor("both", page)).toBeNull()
    }
    for (const page of ["newListing", "editListing", "myListings", "offers"]) {
      expect(pageBlockedFor("seeker", page)).toBe("owner")
      expect(pageBlockedFor("owner", page)).toBeNull()
      expect(pageBlockedFor("both", page)).toBeNull()
    }
    for (const page of ["dashboard", "listing", "howItWorks", "settings", "simulatedPayment", "notFound"]) {
      for (const role of ["owner", "seeker", "both", null] as const) expect(pageBlockedFor(role, page)).toBeNull()
    }
  })

  it("an account without a role is never blocked, and the notice names the way back", () => {
    expect(pageBlockedFor(null, "myListings")).toBeNull()
    expect(pageBlockedFor(null, "history")).toBeNull()
    expect(BLOCKED_NOTICE.seeker).toMatch(/Settings/)
    expect(BLOCKED_NOTICE.owner).toMatch(/Settings/)
  })
})
