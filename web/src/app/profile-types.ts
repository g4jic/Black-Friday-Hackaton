/**
 * The business profile's types and choices, with no browser access (settings.ts keeps the profile in localStorage
 * and re-exports these), so the profile rules can be tested in Node.
 */
export type BusinessType = "cafe_food" | "retail" | "office_studio" | "workshop"
export type Currency = "EUR" | "RSD" | "USD"

/**
 * The business profile from the onboarding ("Find a space") and Settings. null: not given yet (the questionnaire asks
 * for it). mustHaves and districts are not domain fields: they go into the business description that the live agents
 * read (see businessDescription in business-profile.ts).
 */
export type Settings = {
  businessType: BusinessType
  city: string
  monthlyBudget: number | null
  currency: Currency
  expectedMonthlyRevenue: number | null
  areaMinM2: number | null
  areaMaxM2: number | null
  leaseMonths: number | null
  /** Percent (1..100), as typed; the questionnaire sends it as a share (0..1). */
  grossMarginPercent: number | null
  districts: string
  mustHaves: MustHave[]
}

/** "Must have" choices on the business profile (they become words in the business description, not rules in code). */
export const MUST_HAVES = [
  "Storefront window",
  "Ground floor",
  "Ventilation or extraction",
  "Own entrance",
  "Parking nearby",
  "Step-free access",
  "Outdoor seating allowed",
] as const
export type MustHave = (typeof MUST_HAVES)[number]

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  cafe_food: "Cafe or food",
  retail: "Retail shop",
  office_studio: "Office or studio",
  workshop: "Small workshop",
}

export const CURRENCIES: Currency[] = ["EUR", "RSD", "USD"]

export const DEFAULT_SETTINGS: Settings = {
  businessType: "cafe_food",
  city: "Novi Sad",
  monthlyBudget: null,
  currency: "EUR",
  expectedMonthlyRevenue: null,
  areaMinM2: null,
  areaMaxM2: null,
  leaseMonths: null,
  grossMarginPercent: null,
  districts: "",
  mustHaves: [],
}

