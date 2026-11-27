import type { Role } from "./auth"

/**
 * What each onboarding role sees. The role only shapes the interface (it is a UI preference on the account, never a
 * permission the server checks): an owner lists spaces, a seeker researches them, "both" does both.
 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Space owner",
  seeker: "Space seeker",
  both: "Owner & seeker",
}

/** An account without a role yet (for example one made before the onboarding existed) sees everything. */
export const listsSpaces = (role: Role | null): boolean => role !== "seeker"
export const seeksSpaces = (role: Role | null): boolean => role !== "owner"
