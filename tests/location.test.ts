import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { areaLookup, fixtureAreaLookup, SEED_AREAS_FILE } from "../src/adapters/osm/area-lookup.js"
import type { AreaLookup } from "../src/application/location/area-lookup.js"
import { landuseQuery, overpassQuery, parseLanduse } from "../src/adapters/osm/osm-client.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { DISTRICTS } from "../src/adapters/seed/generate-listings.js"
import { AREA_RADIUS_M, BusinessProfile, DomainError, OSM_METRICS, classifyZone, createAreaData, listingFromSpaceListing, noiseCheck, noisyBusiness, normalizeDistrict, scoreLocation, validateSource } from "../src/domain/index.js"
import { HOUSING, INDUSTRY, SAMPLE_COUNTS, sampleArea, sampleAreaLookup } from "./fixtures/sample-areas.js"
import { sampleLeaseAnswers, sampleLeases, sampleListings, sampleScoutAnswers } from "./fixtures/sample-listings.js"
import { loadDemoQuestionnaire } from "../src/adapters/fixtures/demo-questionnaire.js"
import { MockRunner, developerText, type MockScript } from "../src/adapters/inference/mock-runner.js"
import { demoRoomScript } from "../src/adapters/inference/scripts/demo-script.js"
import { FAST_PACE } from "../src/adapters/server/research-routes.js"
import { ResearchSession } from "../src/application/research/research-session.js"

const noSignal = new AbortController().signal

describe("location data (domain, plain code)", () => {
  it("every count carries an osm source that names the metric and the query place", () => {
    const area = sampleArea("listing-01")
    for (const m of OSM_METRICS) {
      expect(area.counts[m].value).toBe(SAMPLE_COUNTS[m])
      expect(validateSource(area.counts[m].source)).toMatchObject({ kind: "osm", field: m })
      expect(area.counts[m].source.ref).toContain(`within ${AREA_RADIUS_M} m`)
    }
  })

  it("rejects counts that are not whole numbers of 0 or more, and missing coordinates", () => {
    expect(() => sampleArea("x", { ...SAMPLE_COUNTS, food: -1 })).toThrow(DomainError)
    expect(() => sampleArea("x", { ...SAMPLE_COUNTS, transit: 2.5 })).toThrow(DomainError)
    expect(() => createAreaData({ candidateId: "x", place: "p", precision: "street", geocodeRef: "way/1", lat: Number.NaN, lon: 1, counts: SAMPLE_COUNTS })).toThrow(DomainError)
  })

  it("scores per business type: competition lowers a cafe, transit and offices raise it (assumptions, not demand)", () => {
    const quiet = scoreLocation(sampleArea("a", { ...SAMPLE_COUNTS, food: 2 }), "cafe_food")
    const crowded = scoreLocation(sampleArea("b", { ...SAMPLE_COUNTS, food: 30 }), "cafe_food")
    expect(quiet.score).toBeGreaterThan(crowded.score)
    expect(crowded.parts.find((p) => p.metric === "food")).toMatchObject({ score: 0, effect: "minus" })
    const office = scoreLocation(sampleArea("c"), "office_studio")
    expect(office.parts.map((p) => p.metric)).toEqual(["transit", "parking", "food"])
    for (const p of [...quiet.parts, ...office.parts]) expect(() => validateSource(p.source)).not.toThrow()
  })

  it("normalises a typed district to a known one, never inventing a place", () => {
    const ns = DISTRICTS["Novi Sad"].map((d) => d.name)
    expect(normalizeDistrict("grbavici", ns)).toBe("Grbavica")
    expect(normalizeDistrict("na Grbavici", ns)).toBe("Grbavica")
    expect(normalizeDistrict("GRBAVICA", ns)).toBe("Grbavica")
    expect(normalizeDistrict("Limanu 2", ns)).toBe("Liman 2")
    expect(normalizeDistrict("Podbari", ns)).toBe("Podbara")
    expect(normalizeDistrict("Atlantida", ns)).toBeNull()
  })

  it("the Overpass query counts every metric around the point, with the radius", () => {
    const q = overpassQuery(45.25, 19.84)
    expect(q.match(/out count;/g)).toHaveLength(OSM_METRICS.length)
    expect(q).toContain(`around:${AREA_RADIUS_M},45.250000,19.840000`)
  })
})

describe("noisy work and land use (domain, plain code)", () => {
  it("noisy work is read from the business description (assumption list, English and Serbian)", () => {
    expect(noisyBusiness("Small carpentry workshop making kitchen cabinets").noisy).toBe(true)
    expect(noisyBusiness("Stolarska radionica, izrada nameštaja").noisy).toBe(true)
    expect(noisyBusiness("Car repair and tyre service").noisy).toBe(true)
    expect(noisyBusiness("Specialty coffee bar with breakfast").noisy).toBe(false)
    expect(noisyBusiness("Accounting office for 4 people").noisy).toBe(false)
  })

  it("classifies the zone from the land use: the area the address lies in first, then homes, then industry", () => {
    expect(classifyZone(INDUSTRY)).toBe("industrial")
    expect(classifyZone(HOUSING)).toBe("residential")
    expect(classifyZone({ ...HOUSING, residentialBuildings: 5, commercialAreas: 2 })).toBe("business")
    expect(classifyZone({ ...HOUSING, residentialBuildings: 5, industrialBuildings: 4 })).toBe("industrial")
    expect(classifyZone({ ...HOUSING, residentialBuildings: 5, commercialAreas: 0 })).toBe("mixed")
    expect(classifyZone({ ...HOUSING, atPoint: [{ landuse: "retail", ref: "way/3" }] })).toBe("business")
  })

  it("noisy work: dense housing is a point to check, an industrial zone is a plus; a quiet business is never judged", () => {
    const carpentry = "Carpentry workshop with machines"
    const fewParking = { ...SAMPLE_COUNTS, parking: 0 }
    const housing = sampleArea("a", fewParking, HOUSING)
    const industry = sampleArea("b", fewParking, INDUSTRY)
    expect(noiseCheck(housing, carpentry)).toMatchObject({ zone: "residential", concern: true })
    expect(noiseCheck(industry, carpentry)).toMatchObject({ zone: "industrial", concern: false })
    expect(noiseCheck(housing, "Specialty coffee bar")).toBeNull()
    expect(noiseCheck(sampleArea("c"), carpentry)).toBeNull() // land use unknown: no judgement
    const inIndustry = scoreLocation(industry, "workshop", carpentry)
    const inHousing = scoreLocation(housing, "workshop", carpentry)
    expect(inIndustry.parts.find((p) => p.metric === "zone")).toMatchObject({ score: 1, effect: "plus" })
    expect(inHousing.parts.some((p) => p.metric === "zone")).toBe(false) // a point to check instead, not scored twice
    expect(inIndustry.score).toBeGreaterThan(inHousing.score)
    expect(scoreLocation(industry, "workshop", "Tailor and alterations").parts.some((p) => p.metric === "zone")).toBe(false)
    expect(validateSource(inIndustry.parts.find((p) => p.metric === "zone")!.source)).toMatchObject({ kind: "osm", field: "landuse" })
  })

  it("parses the Overpass land use answer and asks for it in one query around the point", () => {
    const q = landuseQuery(45.25, 19.84)
    expect(q).toContain("is_in(45.250000,19.840000)")
    expect(q.match(/out count;/g)).toHaveLength(2)
    const parsed = parseLanduse([
      { type: "area", id: 2_400_000_123, tags: { landuse: "industrial" } },
      { type: "way", id: 5, tags: { landuse: "residential" } },
      { type: "way", id: 6, tags: { landuse: "retail" } },
      { type: "count", tags: { total: "17" } },
      { type: "count", tags: { total: "2" } },
    ])
    expect(parsed).toEqual({ atPoint: [{ landuse: "industrial", ref: "way/123" }], residentialAreas: 1, industrialAreas: 0, commercialAreas: 1, residentialBuildings: 17, industrialBuildings: 2 })
    expect(() => sampleArea("x", SAMPLE_COUNTS, { ...HOUSING, residentialBuildings: -1 })).toThrow(DomainError)
  })
})

describe("seed area fixture (fetched once from OpenStreetMap; no network in tests)", () => {
  it.runIf(existsSync(SEED_AREAS_FILE))("covers every seeded listing, with the ODbL attribution", async () => {
    const file = JSON.parse(readFileSync(SEED_AREAS_FILE, "utf8")) as { attribution: string; listings: Record<string, string> }
    expect(file.attribution).toContain("OpenStreetMap contributors")
    const lookup = fixtureAreaLookup()
    const { listings } = seedCatalogue()
    let found = 0
    for (const space of listings) {
      expect(file.listings[space.id]).toBeDefined()
      const area = await lookup(space.id, listingFromSpaceListing(space), noSignal)
      if (area) found++
    }
    expect(found).toBe(listings.length)
  })
})

describe("Location analyst (keyless, scripted model)", () => {
  async function run(opts: { locationStep?: number; script?: (inner: MockScript) => MockScript } = {}) {
    const { profile, requirements } = loadDemoQuestionnaire()
    const inner = demoRoomScript({ scout: sampleScoutAnswers(), lease: sampleLeaseAnswers() }, { ...FAST_PACE, locationStep: opts.locationStep ?? 20 })
    const s = new ResearchSession({ id: "loc", mode: "demo", model: "mock", runner: new MockRunner({ script: opts.script ? opts.script(inner) : inner }), listings: sampleListings(), leases: sampleLeases(), profile, requirements, areaLookup: sampleAreaLookup })
    const start = Date.now()
    while (s.status !== "done" && Date.now() - start < 10_000) await new Promise((r) => setTimeout(r, 20))
    return s
  }
  const ofType = (s: ResearchSession, type: string) => s.events.filter((e) => e.type === type)

  it("runs one loop per candidate next to Finance and Lease, and explains only sourced counts", async () => {
    const s = await run()
    const explained = ofType(s, "location.explained").map((e) => e.candidateId)
    expect(explained.length).toBeGreaterThanOrEqual(6) // every candidate that was not rejected before its loop ended
    const started = ofType(s, "loop.started")
    const agentsOf = (id: string) => new Set(started.filter((e) => e.candidateId === id).map((e) => e.agent))
    expect(agentsOf("listing-01")).toEqual(new Set(["Finance analyst", "Lease reader", "Location analyst", "Premises inspector"]))
    expect(s.events.some((e) => e.type === "report.ready")).toBe(true)
  })

  it("an explanation with a number the tool never returned is sent back once, then the loop gives up", async () => {
    const invent: (inner: MockScript) => MockScript = (inner) => async (input) => {
      const reply = await inner(input)
      if (!developerText(input).startsWith("You are the Location analyst") || !("text" in reply)) return reply
      return { text: JSON.stringify({ explanation: "About 1234 people walk past every day." }) }
    }
    const s = await run({ script: invent })
    const rejected = ofType(s, "location.explanation_rejected")
    expect(rejected.length).toBeGreaterThan(0)
    expect(String(rejected[0]!.data?.reason)).toContain("1234")
    expect(ofType(s, "location.failed").length).toBeGreaterThan(0)
    expect(ofType(s, "location.explained")).toHaveLength(0)
  })

  it("noisy work in dense housing becomes a point to check before signing (code), never a hard flag", async () => {
    const { profile, requirements } = loadDemoQuestionnaire()
    const noisy = BusinessProfile.create({ ...profile.input, description: "Small carpentry workshop with saws and sanders" })
    const inner = demoRoomScript({ scout: sampleScoutAnswers(), lease: sampleLeaseAnswers() }, { ...FAST_PACE, locationStep: 20 })
    const s = new ResearchSession({ id: "noise", mode: "demo", model: "mock", runner: new MockRunner({ script: inner }), listings: sampleListings(), leases: sampleLeases(), profile: noisy, requirements, areaLookup: async (id) => sampleArea(id, SAMPLE_COUNTS, HOUSING) })
    const start = Date.now()
    while (s.status !== "done" && Date.now() - start < 10_000) await new Promise((r) => setTimeout(r, 20))
    const state = (s as unknown as { rt: { state: { findings: { id: string; severity: string; checkBeforeSigning?: string }[] } } }).rt.state
    const noise = state.findings.filter((f) => f.id.endsWith(":location:noise_near_homes"))
    expect(noise.length).toBeGreaterThan(0)
    for (const f of noise) expect(f).toMatchObject({ severity: "soft", checkBeforeSigning: "noise: check local rules and neighbours" })
    expect(ofType(s, "candidate.rejected").every((e) => !String(e.data?.rule ?? "").includes("noise"))).toBe(true)
  })

  it("a hard flag from another agent stops the Location analyst's loop on that candidate", async () => {
    const s = await run({ locationStep: 400 }) // slower than the Lease reader, so the flag lands while it works
    const cut = ofType(s, "loop.cancelled").filter((e) => e.agent === "Location analyst")
    expect(cut.map((e) => e.candidateId)).toContain("listing-07")
    expect(ofType(s, "location.explained").map((e) => e.candidateId)).not.toContain("listing-07")
  })
})

describe("area lookup (adapters)", () => {
  it("uses the fixture for a seeded listing and calls the live lookup only for other listings", async () => {
    const calls: string[] = []
    const fixture: AreaLookup = async (id, listing) => (listing.ref === "listing-ns001" ? sampleArea(id) : null)
    const live: AreaLookup = async (id) => {
      calls.push(id)
      return sampleArea(id)
    }
    const lookup = areaLookup(fixture, live)
    const seeded = listingFromSpaceListing(seedCatalogue().listings.find((l) => l.id === "listing-ns001")!)
    expect(await lookup("listing-ns001", seeded, noSignal)).not.toBeNull()
    expect(calls).toEqual([])
    expect(await lookup("listing-outside", { ...seeded, ref: "listing-outside" }, noSignal)).not.toBeNull()
    expect(calls).toEqual(["listing-outside"])
    expect(await areaLookup(fixture, null)("listing-outside", { ...seeded, ref: "listing-outside" }, noSignal)).toBeNull() // keyless: no live lookup
  })
})
