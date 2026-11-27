import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import { planRoleBackfill, type BackfillAccount } from "../src/adapters/auth/role-backfill.js"
import { supabaseStoreConfig } from "../src/adapters/storage/supabase-listing-store.js"

/**
 * npx tsx scripts/backfill-roles.ts --dry-run   (prints the plan, changes nothing)
 * npx tsx scripts/backfill-roles.ts             (writes it)
 * --both "4***@gmail.com,o***@gmail.com"       (these masked emails get "both"; each must match exactly one account)
 *
 * One-time: gives every Supabase account without an onboarding role a role (owner with at least one listing, else
 * seeker) and onboarded_at in user_metadata, so accounts made before the onboarding skip the role choice. Accounts
 * with a role are not touched. The rule is in src/adapters/auth/role-backfill.ts (tested). Uses the service role key
 * from .env (server side only); prints masked emails and counts, never keys.
 */
const dryRun = process.argv.includes("--dry-run")
const bothArg = process.argv.indexOf("--both")
const bothFor = bothArg >= 0 ? (process.argv[bothArg + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : []
const config = supabaseStoreConfig()
if (!config) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env first.")
  process.exit(1)
}
const admin = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function allAccounts(): Promise<BackfillAccount[]> {
  const accounts: BackfillAccount[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Could not list accounts (${error.code ?? error.status ?? "error"})`)
    for (const u of data.users) accounts.push({ id: u.id, email: u.email ?? null, metadata: { ...(u.user_metadata ?? {}) } })
    if (data.users.length < 1000) return accounts
  }
}

async function listingCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("listings").select("owner_id").order("id").range(from, from + 999)
    if (error) throw new Error(`Could not read listings (${error.code ?? "error"})`)
    for (const row of data as { owner_id: string }[]) counts.set(row.owner_id, (counts.get(row.owner_id) ?? 0) + 1)
    if (data.length < 1000) return counts
  }
}

const accounts = await allAccounts()
const plan = planRoleBackfill(accounts, await listingCounts(), new Date().toISOString(), bothFor)

console.log(`${dryRun ? "DRY RUN (nothing is written)" : "WRITING"}: ${accounts.length} accounts, ${plan.skipped} already have a role (left alone)`)
console.log(`To set: owner ${plan.byRole.owner}, seeker ${plan.byRole.seeker}, both ${plan.byRole.both}`)
console.table(plan.changes.map((c) => ({ email: c.maskedEmail, listings: c.listings, role: c.role })))

if (!dryRun) {
  const written = { owner: 0, seeker: 0, both: 0 }
  const failed: string[] = []
  for (const change of plan.changes) {
    let ok = false
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      const { error } = await admin.auth.admin.updateUserById(change.id, { user_metadata: change.metadata })
      if (!error) ok = true
      else if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
    }
    if (ok) written[change.role]++
    else failed.push(change.maskedEmail)
  }
  const done = written.owner + written.seeker + written.both
  console.log(`Written: owner ${written.owner}, seeker ${written.seeker}, both ${written.both}`)
  console.log(`Updated ${done} of ${plan.changes.length} accounts.${failed.length ? ` Failed: ${failed.join(", ")} (run the script again; it skips accounts that have a role).` : ""}`)
  if (failed.length) process.exitCode = 1
}
