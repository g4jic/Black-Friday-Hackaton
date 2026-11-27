import { describe, expect, it } from "vitest"
import { BusinessProfile, type BusinessProfileInput } from "../src/domain/profile.js"
import { businessDescription, checkProfileFields, EXAMPLE_PROFILE, type ProfileFields } from "../web/src/app/business-profile.js"
import { DEFAULT_SETTINGS } from "../web/src/app/profile-types.js"
import { spaceExtrasDescription } from "../web/src/app/space-extras.js"

const filled: ProfileFields = { ...EXAMPLE_PROFILE, grossMarginPercent: "65" }

/** What the domain says about the same answers (the fields the onboarding does not ask get valid values). */
function domainAccepts(f: ProfileFields): boolean {
  const n = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(",", ".")))
  const input: BusinessProfileInput = {
    businessType: f.businessType,
    description: "x",
    headcount: 1,
    areaMinM2: n(f.areaMinM2),
    areaMaxM2: n(f.areaMaxM2),
    currency: "EUR",
    monthlyBudget: n(f.monthlyBudget),
    expectedMonthlyRevenue: n(f.expectedMonthlyRevenue),
    ...(f.grossMarginPercent.trim() ? { grossMarginRate: n(f.grossMarginPercent) / 100 } : {}),
    walkInCustomers: true,
    leaseMonths: n(f.leaseMonths),
    city: f.city,
    fitOutBudget: 0,
    equipmentBudget: 0,
  }
  try {
    BusinessProfile.create(input)
    return true
  } catch {
    return false
  }
}

describe("business profile form (onboarding Find a space and Settings)", () => {
  const cases: [string, Partial<ProfileFields>][] = [
    ["the example", {}],
    ["no city", { city: "  " }],
    ["zero minimum area", { areaMinM2: "0" }],
    ["max area below min", { areaMinM2: "80", areaMaxM2: "60" }],
    ["equal areas", { areaMinM2: "60", areaMaxM2: "60" }],
    ["zero budget", { monthlyBudget: "0" }],
    ["negative revenue", { expectedMonthlyRevenue: "-1" }],
    ["zero revenue", { expectedMonthlyRevenue: "0" }],
    ["margin 0", { grossMarginPercent: "0" }],
    ["margin 100", { grossMarginPercent: "100" }],
    ["margin 101", { grossMarginPercent: "101" }],
    ["no margin", { grossMarginPercent: "" }],
    ["half a month", { leaseMonths: "12.5" }],
    ["zero months", { leaseMonths: "0" }],
    ["text in a number", { monthlyBudget: "abc" }],
    ["missing revenue", { expectedMonthlyRevenue: "" }],
    ["decimal comma", { monthlyBudget: "1500,50" }],
  ]
  it.each(cases)("accepts and rejects exactly like the domain: %s", (_name, patch) => {
    const f = { ...filled, ...patch }
    expect("profile" in checkProfileFields(f, { requireAll: true })).toBe(domainAccepts(f))
  })

  it("Settings may leave fields empty, but a filled field must still pass", () => {
    const empty: ProfileFields = { ...filled, monthlyBudget: "", expectedMonthlyRevenue: "", areaMinM2: "", areaMaxM2: "", leaseMonths: "" }
    expect(checkProfileFields(empty, { requireAll: true })).toMatchObject({ problems: { monthlyBudget: expect.any(String), leaseMonths: expect.any(String) } })
    expect(checkProfileFields(empty, { requireAll: false })).toMatchObject({ profile: { monthlyBudget: null, leaseMonths: null } })
    expect(checkProfileFields({ ...empty, monthlyBudget: "-5" }, { requireAll: false })).toMatchObject({ problems: { monthlyBudget: expect.any(String) } })
  })

  it("saves numbers, trims text and keeps only known must haves", () => {
    const result = checkProfileFields({ ...filled, city: " Novi Sad ", mustHaves: ["Ground floor", "Helipad" as never] }, { requireAll: true })
    expect(result).toEqual({
      profile: { businessType: "cafe_food", city: "Novi Sad", districts: "Liman, Grbavica, Centar", areaMinM2: 50, areaMaxM2: 90, monthlyBudget: 1500, expectedMonthlyRevenue: 9000, grossMarginPercent: 65, leaseMonths: 36, mustHaves: ["Ground floor"] },
    })
  })

  it("must haves and districts become the description the live agents read; none: empty, as before", () => {
    expect(businessDescription({ businessType: "cafe_food", mustHaves: ["Storefront window", "Ventilation or extraction"], districts: "Liman, Grbavica." })).toBe(
      "Cafe or food. Must have: storefront window, ventilation or extraction. Preferred districts: Liman, Grbavica.",
    )
    expect(businessDescription({ businessType: "retail", mustHaves: [], districts: "Centar" })).toBe("Retail shop. Preferred districts: Centar.")
    expect(businessDescription(DEFAULT_SETTINGS)).toBe("")
  })

  it("storefront window and parking become words in the listing description", () => {
    expect(spaceExtrasDescription({ storefront: "yes", parking: "Public parking in front." })).toBe("Storefront window: yes. Parking: Public parking in front.")
    expect(spaceExtrasDescription({ storefront: "no", parking: " " })).toBe("Storefront window: no.")
    expect(spaceExtrasDescription({ storefront: "", parking: "" })).toBeNull()
  })
})
