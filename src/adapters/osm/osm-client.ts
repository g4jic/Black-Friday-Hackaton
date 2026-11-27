import { AREA_RADIUS_M, OSM_METRICS, type AreaCounts, type LanduseCounts, type OsmMetric } from "../../domain/index.js"

/**
 * OpenStreetMap over plain HTTP, following the usage policies of both services:
 * - Nominatim (https://operations.osmfoundation.org/policies/nominatim/): an honest User-Agent, at most 1 request
 *   per second, results cached (we cache per address for the whole process, and the seed areas are fetched once into
 *   fixtures/osm/seed-areas.json).
 * - Overpass (https://wiki.openstreetmap.org/wiki/Overpass_API): one small count query per address, spaced out.
 * Data © OpenStreetMap contributors, available under the Open Database License (ODbL).
 */
export const OSM_USER_AGENT = "SuiteSpot/0.1 (hackathon entry; https://github.com/g4jic/Black-Friday-Hackaton)"
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright)"
const NOMINATIM = "https://nominatim.openstreetmap.org/search"
/** Public Overpass instances listed on the OSM wiki, tried in order (the main one answered 502 on 27 Nov). */
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
const REQUEST_TIMEOUT_MS = 45_000
const NOMINATIM_GAP_MS = 1100
const OVERPASS_GAP_MS = 2500

/** What each metric counts (Overpass filters). Shown on the Assumptions screen as the method. */
export const OVERPASS_FILTERS: Record<OsmMetric, string[]> = {
  food: ['nwr(around:R,LAT,LON)["amenity"~"^(cafe|restaurant|fast_food|bar|pub|ice_cream)$"]'],
  shops: ['nwr(around:R,LAT,LON)["shop"]'],
  offices: ['nwr(around:R,LAT,LON)["office"]'],
  crafts: ['nwr(around:R,LAT,LON)["craft"]'],
  transit: ['node(around:R,LAT,LON)["highway"="bus_stop"]', 'node(around:R,LAT,LON)["railway"="tram_stop"]'],
  schools: ['nwr(around:R,LAT,LON)["amenity"~"^(school|college|university)$"]'],
  parking: ['nwr(around:R,LAT,LON)["amenity"="parking"]'],
}

export type Geocoded = {
  readonly lat: number
  readonly lon: number
  readonly osmType: string
  readonly osmId: number
  readonly displayName: string
  /** "street": the street was found in that city; "district": only the district was (less precise). */
  readonly precision: "street" | "district"
}

export type AreaFetch = {
  readonly geocoded: Geocoded
  readonly counts: AreaCounts
  readonly query: string
  readonly fetchedAt: string
  /** Land use around the address (added 27 Nov for the noisy business rule); missing in older fixtures. */
  readonly landuse?: LanduseCounts
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Spaces calls to one service so they never come closer than `gapMs` (a single queue per service). */
class Pacer {
  private next = 0
  constructor(private readonly gapMs: number) {}
  async turn(): Promise<void> {
    const now = Date.now()
    const at = Math.max(now, this.next)
    this.next = at + this.gapMs
    if (at > now) await sleep(at - now)
  }
}

export function overpassQuery(lat: number, lon: number, radius = AREA_RADIUS_M): string {
  const fill = (f: string) => f.replace("R", String(radius)).replace("LAT", lat.toFixed(6)).replace("LON", lon.toFixed(6))
  const blocks = OSM_METRICS.map((m) => `(${OVERPASS_FILTERS[m].map(fill).join(";")};);out count;`)
  return `[out:json][timeout:25];${blocks.join("")}`
}

/** Building tags counted as homes / as industry for the land use check (an assumption, shown on How it works). */
export const RESIDENTIAL_BUILDINGS = "apartments|residential|house|detached|semidetached_house|terrace|dormitory"
export const INDUSTRIAL_BUILDINGS = "industrial|warehouse|manufacture"

/**
 * Land use around a point: the landuse areas the point lies inside (is_in), the landuse areas within the radius, and
 * the homes and industrial buildings within the radius. One small query per address.
 */
export function landuseQuery(lat: number, lon: number, radius = AREA_RADIUS_M): string {
  const at = `${lat.toFixed(6)},${lon.toFixed(6)}`
  return (
    `[out:json][timeout:25];` +
    `is_in(${at})->.a;area.a["landuse"];out tags;` +
    `wr(around:${radius},${at})["landuse"~"^(residential|industrial|commercial|retail)$"];out tags;` +
    `nwr(around:${radius},${at})["building"~"^(${RESIDENTIAL_BUILDINGS})$"];out count;` +
    `nwr(around:${radius},${at})["building"~"^(${INDUSTRIAL_BUILDINGS})$"];out count;`
  )
}

type OverpassElement = { type: string; id?: number; tags?: Record<string, string> }

/** Turns the answer of `landuseQuery` into counts. is_in area ids are 3600000000 + relation id or 2400000000 + way id. */
export function parseLanduse(elements: readonly OverpassElement[]): LanduseCounts {
  const areaRef = (id: number) => (id >= 3_600_000_000 ? `relation/${id - 3_600_000_000}` : id >= 2_400_000_000 ? `way/${id - 2_400_000_000}` : `area/${id}`)
  const atPoint = elements.filter((e) => e.type === "area" && e.tags?.landuse).map((e) => ({ landuse: e.tags!.landuse!, ref: areaRef(e.id ?? 0) }))
  const nearby = elements.filter((e) => (e.type === "way" || e.type === "relation") && e.tags?.landuse)
  const near = (re: RegExp) => nearby.filter((e) => re.test(e.tags!.landuse!)).length
  const totals = elements.filter((e) => e.type === "count").map((e) => Number(e.tags?.total ?? 0))
  if (totals.length !== 2) throw new Error(`Overpass returned ${totals.length} building counts, expected 2`)
  return {
    atPoint,
    residentialAreas: near(/^residential$/),
    industrialAreas: near(/^industrial$/),
    commercialAreas: near(/^(commercial|retail)$/),
    residentialBuildings: totals[0]!,
    industrialBuildings: totals[1]!,
  }
}

export class OsmClient {
  private readonly nominatim = new Pacer(NOMINATIM_GAP_MS)
  private readonly overpass = new Pacer(OVERPASS_GAP_MS)
  private readonly cache = new Map<string, Promise<AreaFetch | null>>()
  /** The Overpass instance that answered last: tried first next time, so a broken one is not retried for every address. */
  private preferred = 0

  constructor(private readonly doFetch: typeof fetch = fetch) {}

  private async get(url: string): Promise<unknown> {
    await this.nominatim.turn()
    const res = await this.doFetch(url, { headers: { "User-Agent": OSM_USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`Nominatim answered ${res.status}`)
    return res.json()
  }

  async geocode(street: string, district: string, city: string): Promise<Geocoded | null> {
    const base = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=rs`
    const tries: { url: string; precision: Geocoded["precision"] }[] = [
      { url: `${base}&street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}`, precision: "street" },
      { url: `${base}&q=${encodeURIComponent(`${district}, ${city}, Serbia`)}`, precision: "district" },
    ]
    for (const t of tries) {
      const rows = (await this.get(t.url)) as { lat: string; lon: string; osm_type: string; osm_id: number; display_name: string }[]
      const row = rows[0]
      if (row) return { lat: Number(row.lat), lon: Number(row.lon), osmType: row.osm_type, osmId: row.osm_id, displayName: row.display_name, precision: t.precision }
    }
    return null
  }

  async counts(lat: number, lon: number): Promise<{ counts: AreaCounts; query: string }> {
    const query = overpassQuery(lat, lon)
    const elements = await this.overpassElements(query)
    const totals = elements.filter((e) => e.type === "count").map((e) => Number(e.tags?.total ?? 0))
    if (totals.length !== OSM_METRICS.length) throw new Error(`Overpass returned ${totals.length} counts, expected ${OSM_METRICS.length}`)
    const counts = Object.fromEntries(OSM_METRICS.map((m, i) => [m, totals[i]!])) as AreaCounts
    return { counts, query }
  }

  async landuse(lat: number, lon: number): Promise<LanduseCounts> {
    return parseLanduse(await this.overpassElements(landuseQuery(lat, lon)))
  }

  /** POSTs one query to the first Overpass instance that answers and returns its elements. */
  private async overpassElements(query: string): Promise<OverpassElement[]> {
    const problems: string[] = []
    for (let attempt = 0; attempt < OVERPASS.length * 2; attempt++) {
      const index = (this.preferred + attempt) % OVERPASS.length
      const endpoint = OVERPASS[index]!
      await this.overpass.turn()
      let res: Response
      try {
        res = await this.doFetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": OSM_USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (error) {
        problems.push(`${new URL(endpoint).host}: ${(error as Error).name}`)
        continue
      }
      if (!res.ok) {
        problems.push(`${new URL(endpoint).host}: ${res.status}`)
        if (res.status === 429) await sleep(5000)
        continue
      }
      const body = (await res.json()) as { elements: OverpassElement[] }
      this.preferred = index
      return body.elements
    }
    throw new Error(`Overpass did not answer (${problems.join("; ")})`)
  }

  /** Geocode, then count; cached per address for the life of the process. Null when the address is not found. */
  area(street: string, district: string, city: string): Promise<AreaFetch | null> {
    const key = `${street}|${district}|${city}`.toLowerCase()
    let p = this.cache.get(key)
    if (!p) {
      p = (async () => {
        const geocoded = await this.geocode(street, district, city)
        if (!geocoded) return null
        const { counts, query } = await this.counts(geocoded.lat, geocoded.lon)
        const landuse = await this.landuse(geocoded.lat, geocoded.lon)
        return { geocoded, counts, query, landuse, fetchedAt: new Date().toISOString() }
      })()
      this.cache.set(key, p)
      p.catch(() => this.cache.delete(key)) // a failed lookup may be retried later
    }
    return p
  }
}
