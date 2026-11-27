import { existsSync, readFileSync } from "node:fs"
import type { AreaLookup } from "../../application/location/area-lookup.js"
import { createAreaData, isMissingData, normalizeDistrict, type AreaData, type Listing } from "../../domain/index.js"
import { DISTRICTS } from "../seed/generate-listings.js"
import type { AreaFetch, OsmClient } from "./osm-client.js"

export const SEED_AREAS_FILE = "fixtures/osm/seed-areas.json"

type SeedAreas = { readonly areas: Record<string, AreaFetch | null>; readonly listings: Record<string, string> }

const toAreaData = (candidateId: string, place: string, f: AreaFetch): AreaData =>
  createAreaData({ candidateId, place, precision: f.geocoded.precision, geocodeRef: `${f.geocoded.osmType}/${f.geocoded.osmId}`, lat: f.geocoded.lat, lon: f.geocoded.lon, counts: f.counts })

/** "Grbavica, Gogoljeva" (the listing's address field: district, street) and the city. */
function addressOf(listing: Listing): { district: string; street: string; city: string } | null {
  if (isMissingData(listing.address) || isMissingData(listing.city)) return null
  const [district = "", ...rest] = listing.address.value.split(",").map((s) => s.trim())
  return { district, street: rest.join(", "), city: listing.city.value }
}

/** The OSM data of the seeded listings, fetched once (scripts/fetch-osm.ts). No network. */
export function fixtureAreaLookup(file = SEED_AREAS_FILE): AreaLookup {
  const data: SeedAreas | null = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as SeedAreas) : null
  return async (candidateId, listing) => {
    const key = data?.listings[listing.ref]
    const fetched = key ? data?.areas[key] : null
    if (!key || !fetched) return null
    const [street, district, city] = key.split("|")
    return toAreaData(candidateId, `${street}, ${district}, ${city}`, fetched)
  }
}

/**
 * A live lookup for a listing that is not in the fixture (an outside listing typed by the user). The typed district
 * is normalised to a known district first ("grbavici" gives "Grbavica"); an unknown one is used as typed.
 */
export function liveAreaLookup(client: OsmClient): AreaLookup {
  return async (candidateId, listing) => {
    const a = addressOf(listing)
    if (!a) return null
    const known = (DISTRICTS as Record<string, readonly { name: string }[]>)[a.city]?.map((d) => d.name) ?? []
    const district = normalizeDistrict(a.district, known) ?? a.district
    const fetched = await client.area(a.street, district, a.city)
    return fetched ? toAreaData(candidateId, `${a.street}, ${district}, ${a.city}`, fetched) : null
  }
}

/** Fixture first (seeded listings); the live lookup only for other listings, and only when one is given. */
export function areaLookup(fixture: AreaLookup, live: AreaLookup | null): AreaLookup {
  return async (candidateId, listing, signal) => (await fixture(candidateId, listing, signal)) ?? (live ? live(candidateId, listing, signal) : null)
}
