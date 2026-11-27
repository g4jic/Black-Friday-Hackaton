import { DomainError } from "./errors.js"
import type { BusinessType } from "./profile.js"
import { sourced, type SourceRef, type Sourced } from "./source.js"

/**
 * The area around a space, from public OpenStreetMap data (© OpenStreetMap contributors, ODbL). Code counts what is
 * mapped within AREA_RADIUS_M of the address; the Location analyst (AI) only explains these counts for the business.
 * Nothing here estimates revenue or foot traffic: OSM does not hold them, and SuiteSpot never invents them.
 */
export const AREA_RADIUS_M = 300

export const OSM_METRICS = ["food", "shops", "offices", "crafts", "transit", "schools", "parking"] as const
export type OsmMetric = (typeof OSM_METRICS)[number]
export type AreaCounts = Record<OsmMetric, number>

export const OSM_METRIC_TEXT: Record<OsmMetric, string> = {
  food: "cafes, restaurants and bars",
  shops: "shops",
  offices: "offices",
  crafts: "workshops and crafts",
  transit: "bus and tram stops",
  schools: "schools and faculties",
  parking: "parking areas",
}

/** Land use around an address, from OpenStreetMap (raw counts; code classifies them, see classifyZone). */
export type LanduseCounts = {
  /** The landuse areas the address lies inside, with their OSM reference ("way/123"). */
  readonly atPoint: readonly { readonly landuse: string; readonly ref: string }[]
  readonly residentialAreas: number
  readonly industrialAreas: number
  readonly commercialAreas: number
  /** Homes (apartments, houses) mapped within the radius. */
  readonly residentialBuildings: number
  /** Industrial buildings and warehouses mapped within the radius. */
  readonly industrialBuildings: number
}

/** The area data of one candidate: where it was found and what was counted, every count with its OSM source. */
export type AreaData = {
  readonly candidateId: string
  readonly place: string
  /** "street": the street was found; "district": only the district centre (less precise). */
  readonly precision: "street" | "district"
  readonly counts: Readonly<Record<OsmMetric, Sourced<number>>>
  /** Land use around the address (null when it was not fetched). */
  readonly landuse: Sourced<LanduseCounts> | null
}

/** Builds the area data from raw counts; each count gets an "osm" source naming the query and the metric. */
export function createAreaData(input: {
  candidateId: string
  place: string
  precision: "street" | "district"
  geocodeRef: string
  lat: number
  lon: number
  counts: AreaCounts
  landuse?: LanduseCounts | null
}): AreaData {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lon)) throw new DomainError("invalid_input", "Area data needs coordinates")
  const counts = Object.fromEntries(
    OSM_METRICS.map((m) => {
      const n = input.counts[m]
      if (!Number.isInteger(n) || n < 0) throw new DomainError("invalid_input", `OSM count "${m}" must be a whole number of 0 or more`)
      const source: SourceRef = {
        kind: "osm",
        ref: `Overpass count within ${AREA_RADIUS_M} m of ${input.lat.toFixed(5)},${input.lon.toFixed(5)} (${input.geocodeRef}, ${input.precision === "street" ? "street" : "district centre"})`,
        field: m,
      }
      return [m, sourced(n, source)]
    }),
  ) as Record<OsmMetric, Sourced<number>>
  const where = `${input.lat.toFixed(5)},${input.lon.toFixed(5)} (${input.geocodeRef}, ${input.precision === "street" ? "street" : "district centre"})`
  const l = input.landuse
  if (l) {
    for (const n of [l.residentialAreas, l.industrialAreas, l.commercialAreas, l.residentialBuildings, l.industrialBuildings]) {
      if (!Number.isInteger(n) || n < 0) throw new DomainError("invalid_input", "OSM land use counts must be whole numbers of 0 or more")
    }
  }
  const landuse = l ? sourced(Object.freeze({ ...l, atPoint: Object.freeze([...l.atPoint]) }), { kind: "osm", ref: `Overpass land use within ${AREA_RADIUS_M} m of ${where}`, field: "landuse" }) : null
  return Object.freeze({ candidateId: input.candidateId, place: input.place, precision: input.precision, counts: Object.freeze(counts), landuse })
}

/**
 * Noisy work and land use. SuiteSpot assumptions (shown on How it works): which businesses are noisy by nature (a
 * word in the business description), and how code reads the OpenStreetMap land use around the address. A noisy
 * business in dense housing gets a point to check before signing (never a hard flag); in an industrial or business
 * zone it gets a plus in the location part. A quiet business is never judged on this.
 */
export const NOISE_ASSUMPTIONS = {
  description: "Noisy work (machines, tools, cars) suits industrial and business zones better than dense housing. Read from OpenStreetMap land use within 300 m of the address.",
  /** Lowercase word stems matched in the business description (English and Serbian Latin). */
  noisyWords: [
    "carpent", "joiner", "woodwork", "sawmill", "metalwork", "metal work", "welding", "sheet metal", "locksmith workshop", "car repair", "auto repair", "car service", "mechanic", "body shop", "tyre", "tire service", "car wash", "spray paint", "small factory", "manufactur", "production", "machine shop",
    "stolar", "limar", "bravar", "zavariv", "autoservis", "auto servis", "automehaničar", "automehanicar", "vulkaniz", "autolimar", "farbar", "pogon", "proizvodn", "radionica sa mašinama", "radionica sa masinama",
  ],
  /** Homes mapped within the radius from which the area counts as dense housing. */
  denseHomesAtLeast: 40,
  /** Industrial buildings within the radius from which the area counts as industrial (when it is not dense housing). */
  industrialBuildingsAtLeast: 3,
} as const

export type Zone = "industrial" | "business" | "residential" | "mixed"
export const ZONE_TEXT: Record<Zone, string> = { industrial: "an industrial zone", business: "a business zone", residential: "dense housing", mixed: "a mixed area" }

/** Is the business noisy by nature? Plain code: a word from NOISE_ASSUMPTIONS.noisyWords in the description. */
export function noisyBusiness(description: string): { noisy: boolean; word: string | null } {
  const text = description.toLowerCase()
  const word = NOISE_ASSUMPTIONS.noisyWords.find((w) => text.includes(w)) ?? null
  return { noisy: word !== null, word }
}

/**
 * The zone around an address, from the land use counts (plain code, in this order): the landuse area the address
 * lies in decides; otherwise many homes mean dense housing; otherwise mapped industry or business land.
 */
export function classifyZone(l: LanduseCounts): Zone {
  const at = new Set(l.atPoint.map((a) => a.landuse))
  if (at.has("industrial")) return "industrial"
  if (at.has("commercial") || at.has("retail")) return "business"
  if (at.has("residential") || l.residentialBuildings >= NOISE_ASSUMPTIONS.denseHomesAtLeast) return "residential"
  if (l.industrialAreas > 0 || l.industrialBuildings >= NOISE_ASSUMPTIONS.industrialBuildingsAtLeast) return "industrial"
  if (l.commercialAreas > 0) return "business"
  return "mixed"
}

/** The noise check of one candidate, or null when the business is quiet or the land use is unknown. */
export function noiseCheck(area: AreaData, description: string): { zone: Zone; word: string; concern: boolean; text: string; source: SourceRef } | null {
  const { noisy, word } = noisyBusiness(description)
  if (!noisy || !word || !area.landuse) return null
  const l = area.landuse.value
  const zone = classifyZone(l)
  const counted = `${l.residentialBuildings} homes and ${l.industrialBuildings} industrial buildings mapped within ${AREA_RADIUS_M} m`
  const text = `noisy work in ${ZONE_TEXT[zone]}: ${counted}`
  return { zone, word, concern: zone === "residential", text, source: area.landuse.source }
}

type Rule = { readonly metric: OsmMetric } & ({ readonly kind: "more_is_better"; readonly fullAt: number } | { readonly kind: "competition"; readonly fullAtOrBelow: number; readonly zeroAt: number })

/**
 * SuiteSpot assumptions (shown on the Assumptions screen): which mapped places help a business type, and which are
 * competitors. A part scores full at `fullAt` or more; competition scores full at `fullAtOrBelow` or fewer and 0 at
 * `zeroAt`. The location part is the average. These are our choices, not facts about demand.
 */
export const LOCATION_ASSUMPTIONS = {
  radiusM: AREA_RADIUS_M,
  description: "What OpenStreetMap maps within 300 m of the address, scored per type of business. It does not measure revenue or foot traffic.",
  rules: {
    cafe_food: [
      { metric: "transit", kind: "more_is_better", fullAt: 4 },
      { metric: "offices", kind: "more_is_better", fullAt: 10 },
      { metric: "schools", kind: "more_is_better", fullAt: 2 },
      { metric: "food", kind: "competition", fullAtOrBelow: 5, zeroAt: 25 },
    ],
    retail: [
      { metric: "transit", kind: "more_is_better", fullAt: 4 },
      { metric: "parking", kind: "more_is_better", fullAt: 2 },
      { metric: "offices", kind: "more_is_better", fullAt: 10 },
      { metric: "shops", kind: "competition", fullAtOrBelow: 15, zeroAt: 50 },
    ],
    office_studio: [
      { metric: "transit", kind: "more_is_better", fullAt: 4 },
      { metric: "parking", kind: "more_is_better", fullAt: 3 },
      { metric: "food", kind: "more_is_better", fullAt: 5 },
    ],
    workshop: [
      { metric: "parking", kind: "more_is_better", fullAt: 3 },
      { metric: "transit", kind: "more_is_better", fullAt: 2 },
      { metric: "crafts", kind: "competition", fullAtOrBelow: 3, zeroAt: 12 },
    ],
  } satisfies Record<BusinessType, readonly Rule[]>,
} as const

export type LocationPart = { readonly metric: OsmMetric | "zone"; readonly score: number; readonly text: string; readonly effect: "plus" | "minus"; readonly source: SourceRef }

const round2 = (n: number) => Math.round(n * 100) / 100

/** The location part of the score (0 to 1) and one sourced reason per counted metric. Deterministic, plain code. */
export function scoreLocation(area: AreaData, businessType: BusinessType, description = ""): { score: number; parts: LocationPart[] } {
  const rules = LOCATION_ASSUMPTIONS.rules[businessType] as readonly Rule[]
  const parts = rules.map((r): LocationPart => {
    const n = area.counts[r.metric]
    const what = `${n.value} ${OSM_METRIC_TEXT[r.metric]} within ${AREA_RADIUS_M} m`
    if (r.kind === "more_is_better") {
      const score = round2(Math.min(1, n.value / r.fullAt))
      return { metric: r.metric, score, text: what, effect: score >= 0.5 ? "plus" : "minus", source: n.source }
    }
    const score = round2(Math.max(0, Math.min(1, (r.zeroAt - n.value) / (r.zeroAt - r.fullAtOrBelow))))
    return { metric: r.metric, score, text: `${what} (competition)`, effect: score >= 0.5 ? "plus" : "minus", source: n.source }
  })
  // Noisy work in an industrial or business zone: one more full part (a plus). Dense housing is a point to check
  // before signing instead (see noiseCheck), so it is not scored twice; a mixed area and a quiet business add nothing.
  const noise = noiseCheck(area, description)
  if (noise && (noise.zone === "industrial" || noise.zone === "business")) parts.push({ metric: "zone", score: 1, text: noise.text, effect: "plus", source: noise.source })
  return { score: round2(parts.reduce((a, p) => a + p.score, 0) / parts.length), parts }
}

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/** Serbian case endings a district name may carry in a typed address ("na Grbavici", "na Limanu", "u Zemunu"). */
const ENDINGS = ["ama", "ima", "oj", "om", "em", "u", "i", "e", "a", "o"]
const stem = (word: string) => {
  for (const e of ENDINGS) if (word.length > e.length + 2 && word.endsWith(e)) return word.slice(0, -e.length)
  return word
}
const stemmed = (s: string) => strip(s).split(" ").map(stem).join(" ")

/**
 * The known district a typed district means, or null: "grbavici", "na Grbavici", "Grbavica" all give "Grbavica";
 * "Limanu 2" gives "Liman 2". Matching ignores letter case, diacritics and common Serbian case endings. Only names
 * from `known` are returned (never an invented place); an unknown input is returned as typed by the caller.
 */
export function normalizeDistrict(typed: string, known: readonly string[]): string | null {
  const t = stemmed(typed.replace(/^\s*(na|u|kod)\s+/i, ""))
  if (!t) return null
  return known.find((k) => stemmed(k) === t) ?? null
}
