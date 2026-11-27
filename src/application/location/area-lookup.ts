import type { AreaData, Listing } from "../../domain/index.js"

/**
 * Port: the OpenStreetMap area data of a candidate's listing, or null when the address cannot be found. Adapters:
 * the fixture of the seeded listings (no network, used by the keyless demo and the tests) and a live OSM lookup for
 * an outside listing (only when the server runs live). The domain never sees where the data came from beyond its
 * "osm" source.
 */
export type AreaLookup = (candidateId: string, listing: Listing, signal: AbortSignal) => Promise<AreaData | null>
