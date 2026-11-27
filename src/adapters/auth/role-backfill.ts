/**
 * One-time backfill for accounts made before the onboarding existed (scripts/backfill-roles.ts): every Supabase
 * account without a role gets one, owner when it has at least one listing in its name, else seeker, plus
 * onboarded_at, so it does not go through the role choice. Accounts that already have a role are left alone.
 * Pure: the script reads the accounts and the listing counts, this decides, the script writes.
 */
export type BackfillRole = "owner" | "seeker" | "both"
export type BackfillAccount = { id: string; email: string | null; metadata: Record<string, unknown> }
export type BackfillRow = { id: string; maskedEmail: string; listings: number; role: BackfillRole; metadata: Record<string, unknown> }
export type BackfillPlan = { changes: BackfillRow[]; skipped: number; byRole: Record<BackfillRole, number> }

const ROLES = ["owner", "seeker", "both"]

/** "aleksa@gmail.com" -> "a***@gmail.com": enough to recognise an account in the table, not to read it. */
export function maskEmail(email: string | null): string {
  if (!email || !email.includes("@")) return "(no email)"
  const [local, domain] = [email.slice(0, email.lastIndexOf("@")), email.slice(email.lastIndexOf("@") + 1)]
  return `${local.slice(0, 1) || "?"}***@${domain}`
}

/**
 * bothFor: masked emails (as the dry run prints them) that get "both" instead of the listing rule (the team's own
 * accounts). A masked email that matches no account, or more than one, is refused, so nothing is guessed.
 */
export function planRoleBackfill(accounts: readonly BackfillAccount[], listingsByOwner: ReadonlyMap<string, number>, now: string, bothFor: readonly string[] = []): BackfillPlan {
  for (const masked of bothFor) {
    const matches = accounts.filter((a) => maskEmail(a.email) === masked).length
    if (matches !== 1) throw new Error(`--both ${masked} matches ${matches} accounts; it must match exactly one.`)
  }
  const changes: BackfillRow[] = []
  let skipped = 0
  for (const account of accounts) {
    if (ROLES.includes(account.metadata.role as string)) {
      skipped++
      continue
    }
    const listings = listingsByOwner.get(account.id) ?? 0
    const role: BackfillRole = bothFor.includes(maskEmail(account.email)) ? "both" : listings > 0 ? "owner" : "seeker"
    // Everything already in the metadata (display_name, ...) is kept; only role and onboarded_at are added.
    changes.push({ id: account.id, maskedEmail: maskEmail(account.email), listings, role, metadata: { ...account.metadata, role, onboarded_at: now } })
  }
  changes.sort((a, b) => a.role.localeCompare(b.role) || b.listings - a.listings || a.maskedEmail.localeCompare(b.maskedEmail))
  const count = (role: BackfillRole) => changes.filter((c) => c.role === role).length
  return { changes, skipped, byRole: { owner: count("owner"), seeker: count("seeker"), both: count("both") } }
}
