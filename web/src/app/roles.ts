import type { AccountRole } from "./onboarding-gate"

/**
 * What each onboarding role sees. The role only shapes the interface (it is a UI preference on the account, never a
 * permission the server checks): an owner lists spaces, a seeker researches them, "both" does both. No browser
 * access, so the rules are tested in Node (tests/roles.test.ts).
 */
export const ROLE_LABELS: Record<AccountRole, string> = {
  owner: "Space owner",
  seeker: "Space seeker",
  both: "Owner & seeker",
}

/** An account without a role yet (for example one made before the onboarding existed) sees everything. */
export const listsSpaces = (role: AccountRole | null): boolean => role !== "seeker"
export const seeksSpaces = (role: AccountRole | null): boolean => role !== "owner"

/** The sidebar items, in order. Home is there for everyone. */
export type NavKey = "home" | "research" | "listings" | "mySpaces" | "history" | "myListings" | "addSpace" | "offers"
const SEEKER_NAV: NavKey[] = ["research", "listings", "mySpaces", "history"]
const OWNER_NAV: NavKey[] = ["myListings", "addSpace", "offers"]

export function navKeysFor(role: AccountRole | null): NavKey[] {
  if (role === "owner") return ["home", ...OWNER_NAV]
  if (role === "seeker") return ["home", ...SEEKER_NAV]
  // Both: everything, except "Add a space" (My listings has the button), so the rail stays short.
  return ["home", ...SEEKER_NAV, "myListings", "offers"]
}

/** Pages that belong to one role. Home, a listing page, How it works, Settings and payments are for everyone. */
const PAGE_ROLE: Partial<Record<string, "seeker" | "owner">> = {
  newResearch: "seeker",
  run: "seeker",
  results: "seeker",
  candidate: "seeker",
  history: "seeker",
  listings: "seeker",
  mySpaces: "seeker",
  newListing: "owner",
  editListing: "owner",
  myListings: "owner",
  offers: "owner",
}

/** null: the role may open the page. Otherwise the role the page is for (App sends the user Home with a notice). */
export function pageBlockedFor(role: AccountRole | null, routeName: string): "seeker" | "owner" | null {
  const needed = PAGE_ROLE[routeName]
  if (!needed) return null
  return (needed === "seeker" ? seeksSpaces(role) : listsSpaces(role)) ? null : needed
}

/** The notice on Home after a blocked page (?notice=seeker or ?notice=owner). */
export const BLOCKED_NOTICE: Record<"seeker" | "owner", string> = {
  seeker: "That page is for space seekers. To research spaces, add the Space seeker role in Settings.",
  owner: "That page is for space owners. To list a space, add the Space owner role in Settings.",
}
