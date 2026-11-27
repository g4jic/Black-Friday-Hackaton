import type { AreaLookup } from "../../src/application/location/area-lookup.js"
import { createAreaData, type AreaCounts, type AreaData } from "../../src/domain/index.js"

/** Fixed SYNTHETIC OpenStreetMap counts for the test listings (tests never call OSM). */
export const SAMPLE_COUNTS: AreaCounts = { food: 6, shops: 14, offices: 10, crafts: 1, transit: 5, schools: 2, parking: 3 }

export const sampleArea = (candidateId: string, counts: AreaCounts = SAMPLE_COUNTS): AreaData =>
  createAreaData({ candidateId, place: "Test street, Test district, Novi Sad", precision: "street", geocodeRef: "way/1", lat: 45.25, lon: 19.84, counts })

/** Every candidate gets the same synthetic area (no network). */
export const sampleAreaLookup: AreaLookup = async (candidateId) => sampleArea(candidateId)
