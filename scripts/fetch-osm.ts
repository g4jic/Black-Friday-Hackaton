/**
 * Fetches the OpenStreetMap area data for the 100 seeded demo listings and stores it in
 * fixtures/osm/seed-areas.json, so the keyless demo and the tests never need the network.
 * Usage (PowerShell): npx tsx scripts/fetch-osm.ts
 * Resumable: addresses already in the JSON are skipped, counts already in fixtures/osm/seed-areas.partial.txt (the
 * log of an earlier stopped run) are reused (only the address is geocoded again), and the JSON is written after
 * every address, so a stop loses nothing.
 * Follows the OSM usage policies (honest User-Agent, Nominatim at most 1 request per second, one small Overpass count
 * query per address, every address fetched once). Data © OpenStreetMap contributors, ODbL.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { OSM_ATTRIBUTION, OsmClient, overpassQuery, type AreaFetch } from "../src/adapters/osm/osm-client.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { AREA_RADIUS_M, type AreaCounts } from "../src/domain/index.js"

const FILE = "fixtures/osm/seed-areas.json"
const PARTIAL_LOG = "fixtures/osm/seed-areas.partial.txt"
const client = new OsmClient()
const { listings } = seedCatalogue()
const addressOf = (p: { street: string; district: string; city: string }) => `${p.street}|${p.district}|${p.city}`
const addresses = [...new Set(listings.map((l) => addressOf(l.props)))].sort()

const areas: Record<string, AreaFetch | null> = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf8")) as { areas: Record<string, AreaFetch | null> }).areas : {}
const logged = new Map<string, AreaCounts>()
if (existsSync(PARTIAL_LOG)) {
  for (const m of readFileSync(PARTIAL_LOG, "utf8").matchAll(/^\d+\/\d+ (.+?): (?:street|district) (\{.*\})$/gm)) logged.set(m[1]!, JSON.parse(m[2]!) as AreaCounts)
}
console.log(`${listings.length} listings, ${addresses.length} distinct addresses, ${Object.values(areas).filter(Boolean).length} done, ${logged.size} counts in the log`)

const save = () => {
  mkdirSync("fixtures/osm", { recursive: true })
  writeFileSync(
    FILE,
    JSON.stringify(
      {
        attribution: OSM_ATTRIBUTION,
        note: "Counts of mapped OpenStreetMap features around each seeded listing's street (public data). Fetched by scripts/fetch-osm.ts.",
        radiusM: AREA_RADIUS_M,
        fetchedAt: new Date().toISOString(),
        areas,
        listings: Object.fromEntries(listings.map((l) => [l.id, addressOf(l.props)])),
      },
      null,
      1,
    ) + "\n",
  )
}

let i = 0
for (const a of addresses) {
  i++
  if (areas[a]) continue
  const [street, district, city] = a.split("|") as [string, string, string]
  try {
    const counts = logged.get(a)
    if (counts) {
      const geocoded = await client.geocode(street, district, city)
      areas[a] = geocoded ? { geocoded, counts, query: overpassQuery(geocoded.lat, geocoded.lon), fetchedAt: new Date().toISOString() } : null
    } else areas[a] = await client.area(street, district, city)
  } catch (error) {
    console.error(`  ${a}: ${(error as Error).message}`)
    continue // not saved as null: a later run retries it
  }
  save()
  const r = areas[a]
  console.log(`${i}/${addresses.length} ${a}: ${r ? `${r.geocoded.precision} ${JSON.stringify(r.counts)}${logged.has(a) ? " (counts from the log)" : ""}` : "not found"}`)
}
save()
console.log(`wrote ${FILE} (${Object.values(areas).filter(Boolean).length} of ${addresses.length} addresses found)`)
