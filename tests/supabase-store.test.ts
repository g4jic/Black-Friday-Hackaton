import { describe, expect, it } from "vitest"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { propsToRow, rowToProps, supabaseStoreConfig, type ListingRow } from "../src/adapters/storage/supabase-listing-store.js"
import { SpaceListing } from "../src/domain/index.js"

/** No network: the mapping between the entity and the table row (supabase/migrations) must lose nothing. */
describe("Supabase listing store: row mapping", () => {
  const { listings } = seedCatalogue()

  it("every seed listing survives entity -> row -> entity unchanged (numbers may come back as strings)", () => {
    for (const listing of listings) {
      const row = { ...propsToRow(listing.props), created_at: listing.props.createdAt, updated_at: listing.props.updatedAt } as ListingRow
      const asStrings = { ...row, area_m2: String(row.area_m2), rent_monthly: String(row.rent_monthly), deposit: String(row.deposit) }
      expect(SpaceListing.rehydrate(rowToProps(asStrings)).props).toEqual(listing.props)
    }
  })

  it("rows follow the shape rules of the migration (notice only with early exit, a rate only with a fixed increase)", () => {
    for (const { props } of listings) {
      const row = propsToRow(props)
      expect(row.id).toMatch(/^listing-[a-z0-9]{3,32}$/)
      expect(row.early_termination_notice_months === null).toBe(!row.early_termination_allowed)
      expect(row.indexation_rate_percent === null).toBe(row.indexation_kind !== "fixed_rate")
    }
  })

  it("is on only with all three Supabase values (the service role key stays on the server)", () => {
    const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" } as NodeJS.ProcessEnv
    expect(supabaseStoreConfig(env)).toBeNull()
    expect(supabaseStoreConfig({ ...env, SUPABASE_SERVICE_ROLE_KEY: "service" })).toEqual({ url: "https://x.supabase.co", anonKey: "anon", serviceRoleKey: "service" })
  })
})
