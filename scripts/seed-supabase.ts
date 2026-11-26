import "dotenv/config"
import { randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { generateSeed } from "../src/adapters/seed/generate-listings.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { contactToRow, propsToRow, supabaseStoreConfig } from "../src/adapters/storage/supabase-listing-store.js"

/**
 * npm run seed:supabase
 * Puts the frozen synthetic seed into Supabase: 100 demo landlord accounts (Supabase Auth, example.com emails,
 * confirmed, random password nobody knows) and their 100 demo listings (is_demo = true) with contacts.
 * Safe to run again: accounts are found by email and reused, listings and contacts are upserted by id.
 * Uses the service role key from .env (server side only). Prints counts, never keys, phones or passwords.
 */
const config = supabaseStoreConfig()
if (!config) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env first.")
  process.exit(1)
}
const admin = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

const seed = generateSeed()
const catalogue = seedCatalogue(seed)

/** Every existing account by email (the admin API pages at most 1000 per call). */
async function existingUsers(): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Could not list accounts (${error.code ?? error.status ?? "error"})`)
    for (const u of data.users) if (u.email) byEmail.set(u.email.toLowerCase(), u.id)
    if (data.users.length < 1000) return byEmail
  }
}

async function withRetry<T>(what: string, run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (attempt >= 4) throw error
      const wait = 500 * 2 ** attempt
      console.warn(`${what}: retry ${attempt} in ${wait} ms`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

const users = await existingUsers()
const ownerIds = new Map<string, string>() // demo owner key -> auth user id
let created = 0
for (const owner of seed.owners) {
  const email = owner.email.toLowerCase()
  let id = users.get(email)
  if (!id) {
    id = await withRetry(`account ${owner.key}`, async () => {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { display_name: owner.fullName },
        app_metadata: { is_demo: true, demo_owner_key: owner.key },
      })
      if (error || !data.user) throw new Error(`Could not create ${owner.key} (${error?.code ?? error?.status ?? "error"})`)
      return data.user.id
    })
    created++
  }
  ownerIds.set(owner.key, id)
}
console.log(`Demo accounts: ${seed.owners.length} (${created} created, ${seed.owners.length - created} already there)`)

const rows = catalogue.listings.map((l) => {
  const ownerId = ownerIds.get(l.ownerId)
  if (!ownerId) throw new Error(`No account for ${l.ownerId}`)
  return { ...propsToRow({ ...l.props, ownerId }), created_at: l.props.createdAt }
})
const listingResult = await admin.from("listings").upsert(rows, { onConflict: "id" })
if (listingResult.error) throw new Error(`Could not save listings (${listingResult.error.code})`)
const contactResult = await admin.from("listing_contacts").upsert(catalogue.contacts.map(contactToRow), { onConflict: "listing_id" })
if (contactResult.error) throw new Error(`Could not save contacts (${contactResult.error.code})`)
console.log(`Demo listings: ${rows.length} upserted, contacts: ${catalogue.contacts.length} upserted`)

const count = async (table: string, filter?: (q: any) => any) => {
  const q = admin.from(table).select("*", { count: "exact", head: true })
  const { count: n, error } = await (filter ? filter(q) : q)
  if (error) throw new Error(`Could not count ${table} (${error.code})`)
  return n
}
console.log(`In the database now: listings ${await count("listings")} (demo ${await count("listings", (q) => q.eq("is_demo", true))}), contacts ${await count("listing_contacts")}`)
