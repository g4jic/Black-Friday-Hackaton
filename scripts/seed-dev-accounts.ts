import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { LOCAL_ACCOUNTS_FILE, LocalAccounts } from "../src/adapters/auth/local-accounts.js"
import { SimulatedGateway } from "../src/adapters/payments/simulated-gateway.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { LOCAL_DEALS_FILE, LocalDealStore } from "../src/adapters/storage/local-deal-store.js"
import { LOCAL_LISTINGS_FILE, LocalListingStore } from "../src/adapters/storage/local-listing-store.js"
import type { ListingActor } from "../src/application/listings/listing-store.js"
import { DealService } from "../src/application/deals/deal-service.js"
import type { SpaceListingInput } from "../src/domain/index.js"
import { DEV_ACCOUNTS, DEV_PASSWORD, type DevAccountKey } from "../web/src/dev/dev-accounts.js"

/**
 * LOCAL DEVELOPMENT ONLY: npx tsx scripts/seed-dev-accounts.ts
 *
 * Writes three demo accounts with synthetic data into the LOCAL stores (data/, git-ignored), the ones the app uses
 * when SUPABASE_* are empty. It never talks to Supabase or any network. Running it again first removes the previous
 * demo accounts and everything that belongs to them, then makes them fresh; other local accounts are left alone.
 *
 * - Demo owner: 3 published spaces with views, 1 offer waiting (from Demo both), 1 space leased to Demo seeker with
 *   the first month paid (simulated).
 * - Demo seeker: saved spaces, the lease with one paid month. Its business profile and two research runs (recorded
 *   scenarios) live in the browser, so the "Dev: sign in as seeker" button fills them on first sign in.
 * - Demo both: 1 published space with views, the waiting offer on Demo owner's space, a saved space; profile and
 *   runs from the button too.
 * Everything goes through the real domain rules (DealService, listing validation). Remove before the walkthrough
 * recording: see PROGRESS.md.
 */
if (process.env.NODE_ENV === "production") {
  console.error("Refused: this script is for local development only.")
  process.exit(1)
}

const emails = new Set<string>(Object.values(DEV_ACCOUNTS).map((a) => a.email))
const readJson = <T>(file: string, empty: T): T => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : empty)

// 1. Remove the previous demo accounts and what belongs to them (only theirs).
type AccountsFile = { accounts: { id: string; email: string }[]; sessions: { accountId: string }[] }
const accountsFile = readJson<AccountsFile>(LOCAL_ACCOUNTS_FILE, { accounts: [], sessions: [] })
const oldIds = new Set(accountsFile.accounts.filter((a) => emails.has(a.email)).map((a) => a.id))
if (oldIds.size > 0) {
  writeFileSync(
    LOCAL_ACCOUNTS_FILE,
    JSON.stringify(
      { accounts: accountsFile.accounts.filter((a) => !oldIds.has(a.id)), sessions: accountsFile.sessions.filter((s) => !oldIds.has(s.accountId)) },
      null,
      1,
    ),
  )
  type ListingsFile = {
    listings: { id: string; ownerId: string }[]
    contacts: { listingId: string }[]
    views?: Record<string, number>
    saved?: Record<string, string[]>
  }
  const listingsFile = readJson<ListingsFile>(LOCAL_LISTINGS_FILE, { listings: [], contacts: [] })
  const goneListings = new Set(listingsFile.listings.filter((l) => oldIds.has(l.ownerId)).map((l) => l.id))
  writeFileSync(
    LOCAL_LISTINGS_FILE,
    JSON.stringify(
      {
        listings: listingsFile.listings.filter((l) => !goneListings.has(l.id)),
        contacts: listingsFile.contacts.filter((c) => !goneListings.has(c.listingId)),
        views: Object.fromEntries(Object.entries(listingsFile.views ?? {}).filter(([id]) => !goneListings.has(id))),
        saved: Object.fromEntries(
          Object.entries(listingsFile.saved ?? {})
            .filter(([actorId]) => !oldIds.has(actorId))
            .map(([a, ids]) => [a, ids.filter((id) => !goneListings.has(id))]),
        ),
      },
      null,
      2,
    ),
  )
  type DealsFile = {
    offers: { id: string; tenantId: string; landlordId: string; listingId: string }[]
    tenancies: { id: string; tenantId: string; landlordId: string; listingId: string }[]
    payments: { tenancyId: string }[]
  }
  const dealsFile = readJson<DealsFile>(LOCAL_DEALS_FILE, { offers: [], tenancies: [], payments: [] })
  const involved = (d: { tenantId: string; landlordId: string; listingId: string }) =>
    oldIds.has(d.tenantId) || oldIds.has(d.landlordId) || goneListings.has(d.listingId)
  const goneTenancies = new Set(dealsFile.tenancies.filter(involved).map((t) => t.id))
  writeFileSync(
    LOCAL_DEALS_FILE,
    JSON.stringify(
      {
        offers: dealsFile.offers.filter((o) => !involved(o)),
        tenancies: dealsFile.tenancies.filter((t) => !goneTenancies.has(t.id)),
        payments: dealsFile.payments.filter((p) => !goneTenancies.has(p.tenancyId)),
      },
      null,
      2,
    ),
  )
}

// 2. Make the accounts (onboarded, with their role).
const accounts = new LocalAccounts(LOCAL_ACCOUNTS_FILE)
const actors = {} as Record<DevAccountKey, ListingActor>
for (const [key, a] of Object.entries(DEV_ACCOUNTS) as [DevAccountKey, (typeof DEV_ACCOUNTS)[DevAccountKey]][]) {
  const made = accounts.signUp({ email: a.email, password: DEV_PASSWORD, displayName: a.name })
  accounts.updateProfile(made.token, { role: a.role, onboarded: true })
  accounts.signOut(made.token)
  actors[key] = made.actor
}

// 3. Listings, views and saved spaces.
const listings = new LocalListingStore({ seed: seedCatalogue(), file: LOCAL_LISTINGS_FILE })
const deals = new LocalDealStore(LOCAL_DEALS_FILE)
const gateway = new SimulatedGateway()
const service = new DealService(deals, listings, gateway)

const space = (over: Partial<SpaceListingInput> & Pick<SpaceListingInput, "title" | "district" | "street" | "areaM2" | "rentMonthly">): SpaceListingInput =>
  ({
    city: "Novi Sad",
    floor: 0,
    serviceChargeMonthly: 60,
    deposit: over.rentMonthly * 2,
    minimumTermMonths: 24,
    earlyTermination: { allowed: true, noticeMonths: 3 },
    indexation: { kind: "cpi" },
    permittedUses: ["cafe_food", "retail"],
    tenantPaysStructuralRepairs: false,
    leaseDraft: null,
    description: "SYNTHETIC DEMO DATA. Storefront window: yes. Parking: public parking in front.",
    imageUrl: null,
    ...over,
  }) as SpaceListingInput
const contact = (email: string) => ({ phone: null, email, consentToPublish: true })

const owner = actors.owner
const L1 = await listings.create(
  owner,
  space({ title: "Corner shop near the Liman market (demo)", district: "Liman 2", street: "Narodnog fronta", areaM2: 58, rentMonthly: 950 }),
  contact(DEV_ACCOUNTS.owner.email),
)
const L2 = await listings.create(
  owner,
  space({
    title: "Studio office in Grbavica (demo)",
    district: "Grbavica",
    street: "Bulevar oslobodjenja",
    areaM2: 44,
    rentMonthly: 720,
    permittedUses: ["office_studio"],
    floor: 1,
  }),
  contact(DEV_ACCOUNTS.owner.email),
)
const L3 = await listings.create(
  owner,
  space({ title: "Cafe space in the old town (demo)", district: "Stari grad", street: "Zmaj Jovina", areaM2: 72, rentMonthly: 1350 }),
  contact(DEV_ACCOUNTS.owner.email),
)
const L4 = await listings.create(
  actors.both,
  space({
    title: "Small workshop in Detelinara (demo)",
    district: "Detelinara",
    street: "Rumenacka",
    areaM2: 90,
    rentMonthly: 800,
    permittedUses: ["workshop"],
  }),
  contact(DEV_ACCOUNTS.both.email),
)
for (const [listing, n] of [
  [L1, 14],
  [L2, 9],
  [L3, 5],
  [L4, 7],
] as const)
  for (let i = 0; i < n; i++) await listings.recordView(listing.id)
for (const id of ["listing-ns001", "listing-ns002", L3.id]) await listings.save(actors.seeker, id)
await listings.save(actors.both, "listing-ns003")

// 4. Deals: the seeker leases L1 and pays the first month (simulated); Demo both waits for an answer on L2.
const nextMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
const lease = await service.makeOffer(actors.seeker, L1.id, {
  rentMonthly: 950,
  startDate: nextMonth,
  termMonths: 24,
  message: "A specialty coffee bar (synthetic demo).",
})
const { tenancy } = await service.answerOffer(owner, lease.id, "accept")
const period = nextMonth.slice(0, 7)
const { redirectUrl } = await service.startRentPayment(actors.seeker, tenancy!.id, period, "http://localhost:5173")
const reference = decodeURIComponent(redirectUrl.split("/pay/simulated/")[1]!.split("?")[0]!)
gateway.pay(reference)
await service.confirmRentPayment(actors.seeker, reference)
await service.makeOffer(actors.both, L2.id, { rentMonthly: 700, startDate: nextMonth, termMonths: 12, message: "A small design studio (synthetic demo)." })

console.log(`Local demo accounts ready (password for all three: ${DEV_PASSWORD}, local only):`)
for (const a of Object.values(DEV_ACCOUNTS)) console.log(`  ${a.name.padEnd(12)} ${a.email}`)
console.log("Start the app without Supabase (SUPABASE_* empty) and use the Dev buttons on the sign in screen.")
