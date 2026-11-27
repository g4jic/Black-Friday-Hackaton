/**
 * Fetches the OpenStreetMap area data for the 100 seeded demo listings ONCE and stores it in
 * fixtures/osm/seed-areas.json, so the keyless demo and the tests never need the network.
 * Usage (PowerShell): npx tsx scripts/fetch-osm.ts
 * Follows the OSM usage policies (honest User-Agent, Nominatim at most 1 request per second, one small Overpass count
 * query per address, every address fetched once). Data © OpenStreetMap contributors, ODbL.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { OSM_ATTRIBUTION, OsmClient, type AreaFetch } from "../src/adapters/osm/osm-client.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { AREA_RADIUS_M } from "../src/domain/index.js"

const client = new OsmClient()
const { listings } = seedCatalogue()
const addressOf = (p: { street: string; district: string; city: string }) => `${p.street}|${p.district}|${p.city}`
const addresses = [...new Set(listings.map((l) => addressOf(l.props)))].sort()
console.log(`${listings.length} listings, ${addresses.length} distinct addresses`)

const areas: Record<string, AreaFetch | null> = {}
let i = 0
for (const a of addresses) {
  const [street, district, city] = a.split("|") as [string, string, string]
  try {
    areas[a] = await client.area(street, district, city)
  } catch (error) {
    console.error(`  ${a}: ${(error as Error).message}`)
    areas[a] = null
  }
  const r = areas[a]
  console.log(`${++i}/${addresses.length} ${a}: ${r ? `${r.geocoded.precision} ${JSON.stringify(r.counts)}` : "not found"}`)
}

mkdirSync("fixtures/osm", { recursive: true })
writeFileSync(
  "fixtures/osm/seed-areas.json",
  JSON.stringify(
    {
      attribution: OSM_ATTRIBUTION,
      note: "Counts of mapped OpenStreetMap features around each seeded listing's street (public data). Fetched once by scripts/fetch-osm.ts.",
      radiusM: AREA_RADIUS_M,
      fetchedAt: new Date().toISOString(),
      areas,
      listings: Object.fromEntries(listings.map((l) => [l.id, addressOf(l.props)])),
    },
    null,
    1,
  ) + "\n",
)
console.log(`wrote fixtures/osm/seed-areas.json (${Object.values(areas).filter(Boolean).length} of ${addresses.length} addresses found)`)
