import { describe, expect, it } from "vitest"
import { loadDemoQuestionnaire } from "../src/adapters/fixtures/demo-questionnaire.js"
import { FAST_PACE } from "../src/adapters/server/research-routes.js"
import { buildServer } from "../src/adapters/server/server.js"
import { generateSeed } from "../src/adapters/seed/generate-listings.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
import { seedLeaseAnswers } from "../src/adapters/seed/seed-lease-answers.js"
import type { WireEvent } from "../src/application/research/wire.js"
import {
  BUDGET_TOLERANCE,
  BusinessProfile,
  DomainError,
  MAX_LISTINGS,
  buildLease,
  evaluateLease,
  leaseTextOf,
  listingFromSpaceListing,
  matchListings,
  districtKey,
  parsePreferredDistricts,
  validateSource,
} from "../src/domain/index.js"

const seed = generateSeed()
const { listings } = seedCatalogue(seed)
const demoProfile = loadDemoQuestionnaire().profile

describe("SuiteSpot listings as candidates (built by code from the form)", () => {
  it("a form source names a SuiteSpot listing and a field; no quote needed", () => {
    expect(validateSource({ kind: "listing", ref: "listing-ns001", field: "rentMonthly", form: true })).toBeTruthy()
    expect(() => validateSource({ kind: "listing", ref: "listing-ns001", form: true })).toThrow(DomainError)
    expect(() => validateSource({ kind: "listing", ref: "pasted-1", field: "rentMonthly", form: true })).toThrow(DomainError)
    // A pasted text still needs a quote.
    expect(() => validateSource({ kind: "listing", ref: "pasted-1", field: "rentMonthly" })).toThrow(DomainError)
  })

  it("every form value carries its field as the source; heating and parking are missing, never guessed", () => {
    const space = listings[0]!
    const listing = listingFromSpaceListing(space)
    expect(listing.ref).toBe(space.id)
    expect(listing.rentMonthly).toMatchObject({ source: { kind: "listing", ref: space.id, field: "rentMonthly", form: true } })
    expect((listing.rentMonthly as { value: { amount: number } }).value.amount).toBe(space.props.rentMonthly)
    expect(listing.heating).toMatchObject({ status: "missing_data" })
    expect(listing.text).toContain("SYNTHETIC DEMO LISTING")
  })

  it("Find spaces: same city, area in range, the right use, within budget plus tolerance; at most 8, closest to budget first", () => {
    const matched = matchListings(listings, demoProfile)
    const q = demoProfile.input
    expect(matched.length).toBeGreaterThan(0)
    expect(matched.length).toBeLessThanOrEqual(MAX_LISTINGS)
    const monthly = (l: (typeof matched)[number]) => l.props.rentMonthly + l.props.serviceChargeMonthly
    for (const l of matched) {
      expect(l.props.city).toBe(q.city)
      expect(l.props.areaM2).toBeGreaterThanOrEqual(q.areaMinM2)
      expect(l.props.areaM2).toBeLessThanOrEqual(q.areaMaxM2)
      expect(l.props.permittedUses).toContain(q.businessType)
      expect(monthly(l)).toBeLessThanOrEqual(q.monthlyBudget * (1 + BUDGET_TOLERANCE))
    }
    const gaps = matched.map((l) => Math.abs(monthly(l) - q.monthlyBudget))
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b))
    expect(matchListings(listings, demoProfile).map((l) => l.id)).toEqual(matched.map((l) => l.id)) // deterministic
    const nowhere = BusinessProfile.create({ ...demoProfile.input, city: "Kragujevac" })
    expect(matchListings(listings, nowhere)).toEqual([])
  })

  it("preferred districts come first but never filter: the hard filters are the same, other districts still follow", () => {
    // a wide questionnaire, so more spaces match than the limit and the preference decides who gets in
    const wide = BusinessProfile.create({ ...demoProfile.input, areaMinM2: 20, areaMaxM2: 400, monthlyBudget: 5000 })
    const all = listings.filter((l) => l.props.published && l.props.city === wide.input.city && l.props.permittedUses.includes(wide.input.businessType))
    const plain = matchListings(listings, wide)
    expect(plain).toHaveLength(MAX_LISTINGS)
    // a district that the plain order leaves out entirely, so the preference has to bring it in
    const district = all.map((l) => l.props.district).find((d) => !plain.some((l) => l.props.district === d))!
    expect(district).toBeTruthy()
    const matched = matchListings(listings, wide, [`  ${district.toUpperCase()} `])
    const inDistrict = matched.filter((l) => l.props.district === district).length
    expect(inDistrict).toBeGreaterThan(0)
    // the district's spaces lead, the others still follow
    expect(matched.slice(0, inDistrict).every((l) => l.props.district === district)).toBe(true)
    expect(matched.slice(inDistrict).every((l) => l.props.district !== district)).toBe(true)
    // without a preference the order is the plain one; an unknown district changes nothing
    expect(matchListings(listings, wide, ["Nowhere"]).map((l) => l.id)).toEqual(matchListings(listings, wide).map((l) => l.id))
  })

  it("preferred districts are parsed from text or a list: trimmed, accents ignored, duplicates and empties dropped", () => {
    expect(parsePreferredDistricts("Liman, Grbavica; ,liman\nCentar")).toEqual(["Liman", "Grbavica", "Centar"])
    expect(parsePreferredDistricts(["Savski venac", 7, "  "])).toEqual(["Savski venac"])
    expect(parsePreferredDistricts(undefined)).toEqual([])
    expect(districtKey("  Šumice  Đeram ")).toBe("sumice djeram")
    expect(parsePreferredDistricts(Array.from({ length: 30 }, (_, i) => `D${i}`))).toHaveLength(10)
  })

  it("the scripted Lease reader answers pass the same quote checks as a real model, and the rules find the bad terms", () => {
    const answers = seedLeaseAnswers(seed)
    for (const l of seed.listings.filter((x) => x.leaseQuotes)) {
      const space = listings.find((s) => s.id === l.id)!
      const clauses = buildLease(leaseTextOf(space)!, answers[`lease-${l.id}`]) // strict: throws on any bad quote
      const rules = evaluateLease(clauses, "test").hardFlags.map((f) => f.rule)
      if (l.traits.includes("unlimited_rent_increase") && l.leaseQuotes!.indexation) expect(rules, l.id).toContain("unlimited_rent_increase")
    }
  })
})

describe("server: the keyless demo searches the seeded catalogue", () => {
  it("runs Find spaces end to end with the demo questionnaire: candidates from the catalogue, ranked, audited report", async () => {
    const app = await buildServer({ demoPace: FAST_PACE })
    const post = await app.inject({ method: "POST", url: "/api/research", payload: { source: "demo" } })
    expect(post.statusCode).toBe(201)
    const { id, listings: count, synthetic } = post.json() as { id: string; listings: number; synthetic: boolean }
    expect(count).toBe(matchListings(listings, demoProfile).length)
    expect(synthetic).toBe(true)
    const sse = await app.inject({ method: "GET", url: `/api/research/${id}/events` })
    const events = sse.body
      .split("\n\n")
      .filter((b) => b.includes("data: "))
      .map((b) => JSON.parse(b.split("\n").find((l) => l.startsWith("data: "))!.slice(6)) as WireEvent)
    expect(events.filter((e) => e.type === "candidate.found")).toHaveLength(count)
    expect(events.some((e) => e.type === "listings.submitted")).toBe(false) // no Scout: the form is structured
    expect(events.some((e) => e.type === "lease.read")).toBe(true)
    expect(events.some((e) => e.type === "ranking.done")).toBe(true)
    expect(events.at(-1)).toMatchObject({ type: "research.done" })
    const report = await app.inject({ method: "GET", url: `/api/research/${id}/report` })
    expect(report.statusCode).toBe(200)
    await app.close()
  }, 30_000)

  it("permitted use is checked on every evaluation: an office listing evaluated for a cafe is rejected by code", async () => {
    const space = listings.find((l) => l.id === "listing-ns049")!
    expect(space.props.permittedUses).not.toContain("cafe_food")
    const app = await buildServer({ demoPace: FAST_PACE })
    const post = await app.inject({ method: "POST", url: "/api/research", payload: { source: "listing", listingId: "listing-ns049" } })
    const { id } = post.json() as { id: string }
    const sse = await app.inject({ method: "GET", url: `/api/research/${id}/events` })
    const events = sse.body
      .split("\n\n")
      .filter((b) => b.includes("data: "))
      .map((b) => JSON.parse(b.split("\n").find((l) => l.startsWith("data: "))!.slice(6)) as WireEvent)
    expect(events[0]).toMatchObject({ type: "research.started", data: { mode: "demo", answers: "scripted" } })
    const rejected = events.find((e) => e.type === "candidate.rejected")
    expect(rejected).toMatchObject({ candidateId: "listing-ns049" })
    const snapshot = events.filter((e) => e.type === "candidate.snapshot" && e.candidateId === "listing-ns049").at(-1) as unknown as { data: { candidate: { status: string; rejection: { rule: string; reason: string; source: { inputs: { field?: string; form?: boolean }[] } } } } }
    expect(snapshot.data.candidate.status).toBe("rejected")
    expect(snapshot.data.candidate.rejection.rule).toBe("permitted_use_excludes_business")
    expect(snapshot.data.candidate.rejection.reason).toMatch(/^Permitted use does not include your business type/)
    expect(snapshot.data.candidate.rejection.source.inputs).toContainEqual(expect.objectContaining({ field: "permittedUses", form: true }))
    expect(events.some((e) => e.type === "ranking.done")).toBe(true)
    await app.close()
  })

  it("Evaluate for my business: one demo listing without a key; search needs live mode", async () => {
    const app = await buildServer({ demoPace: FAST_PACE })
    const one = await app.inject({ method: "POST", url: "/api/research", payload: { source: "listing", listingId: "listing-ns001" } })
    expect(one.statusCode).toBe(201)
    expect(one.json()).toMatchObject({ listings: 1 })
    const unknown = await app.inject({ method: "POST", url: "/api/research", payload: { source: "listing", listingId: "listing-zz999" } })
    expect(unknown.statusCode).toBe(400)
    const search = await app.inject({ method: "POST", url: "/api/research", payload: { source: "search" } })
    expect(search.statusCode).toBe(400)
    await app.close()
  })
})
