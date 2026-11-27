import { BUSINESS_TYPE_LABELS, MUST_HAVES, type BusinessType, type MustHave, type Settings } from "./profile-types"

/**
 * The business profile form of the onboarding ("Find a space") and Settings: the fields as typed, the same checks as
 * the domain (src/domain/profile.ts, BusinessProfile.create; tests/business-profile.test.ts proves they agree) and the
 * business description the live agents read. No browser access, so it is tested in Node.
 */
export type ProfileFields = {
  businessType: BusinessType
  city: string
  districts: string
  areaMinM2: string
  areaMaxM2: string
  monthlyBudget: string
  expectedMonthlyRevenue: string
  grossMarginPercent: string
  leaseMonths: string
  mustHaves: MustHave[]
}
export type ProfileField = Exclude<keyof ProfileFields, "mustHaves">
export type ProfileProblems = Partial<Record<ProfileField, string>>
export type CheckedProfile = Omit<Settings, "currency">

const text = (n: number | null) => (n === null ? "" : String(n))

export function toProfileFields(s: Settings): ProfileFields {
  return {
    businessType: s.businessType,
    city: s.city,
    districts: s.districts,
    areaMinM2: text(s.areaMinM2),
    areaMaxM2: text(s.areaMaxM2),
    monthlyBudget: text(s.monthlyBudget),
    expectedMonthlyRevenue: text(s.expectedMonthlyRevenue),
    grossMarginPercent: text(s.grossMarginPercent),
    leaseMonths: text(s.leaseMonths),
    mustHaves: [...s.mustHaves],
  }
}

/** The "Fill with example" values: a synthetic cafe in Novi Sad (not a real business). */
export const EXAMPLE_PROFILE: ProfileFields = {
  businessType: "cafe_food",
  city: "Novi Sad",
  districts: "Liman, Grbavica, Centar",
  areaMinM2: "50",
  areaMaxM2: "90",
  monthlyBudget: "1500",
  expectedMonthlyRevenue: "9000",
  grossMarginPercent: "",
  leaseMonths: "36",
  mustHaves: ["Storefront window", "Ground floor", "Ventilation or extraction"],
}

const parse = (s: string): number | null => (s.trim() === "" ? null : Number(s.trim().replace(",", ".")))

/**
 * The domain's rules, field by field. requireAll (the onboarding's "Save"): every field the domain requires must be
 * there. Without it (Settings) an empty field is allowed (it stays "not given"), but a filled one must still pass.
 */
export function checkProfileFields(f: ProfileFields, { requireAll }: { requireAll: boolean }): { profile: CheckedProfile } | { problems: ProfileProblems } {
  const problems: ProfileProblems = {}
  const value = (field: ProfileField, missing: string): number | null => {
    const n = parse(f[field])
    if (n === null && requireAll) problems[field] = missing
    else if (n !== null && !Number.isFinite(n)) problems[field] = "Enter a number."
    return n !== null && Number.isFinite(n) ? n : null
  }
  if (!(f.businessType in BUSINESS_TYPE_LABELS)) problems.businessType = "Choose a business type."
  if (!f.city.trim()) problems.city = "City is required."
  const areaMin = value("areaMinM2", "Enter the smallest area you need.")
  const areaMax = value("areaMaxM2", "Enter the largest area you need.")
  const budget = value("monthlyBudget", "Enter your monthly budget for the space.")
  const revenue = value("expectedMonthlyRevenue", "Enter the revenue you expect in a month.")
  const margin = value("grossMarginPercent", "")
  const lease = value("leaseMonths", "Enter the lease length in months.")
  delete problems.grossMarginPercent // optional in the domain too
  if (areaMin !== null && !(areaMin > 0)) problems.areaMinM2 = "The area must be positive."
  if (areaMax !== null && !(areaMax > 0)) problems.areaMaxM2 = "The area must be positive."
  if (areaMin !== null && areaMax !== null && areaMin > 0 && areaMax < areaMin) problems.areaMaxM2 = "The largest area must not be smaller than the smallest."
  if (budget !== null && !(budget > 0)) problems.monthlyBudget = "The monthly budget must be positive."
  if (revenue !== null && !(revenue >= 0)) problems.expectedMonthlyRevenue = "The expected revenue must not be negative."
  if (parse(f.grossMarginPercent) !== null && !(margin !== null && margin > 0 && margin <= 100))
    problems.grossMarginPercent = "The gross margin is a percentage above 0 and at most 100, or empty."
  if (lease !== null && !(Number.isInteger(lease) && lease >= 1)) problems.leaseMonths = "The lease length must be a whole number of months."
  if (Object.keys(problems).length > 0) return { problems }
  return {
    profile: {
      businessType: f.businessType,
      city: f.city.trim(),
      districts: f.districts.trim(),
      areaMinM2: areaMin,
      areaMaxM2: areaMax,
      monthlyBudget: budget,
      expectedMonthlyRevenue: revenue,
      grossMarginPercent: margin,
      leaseMonths: lease,
      mustHaves: MUST_HAVES.filter((m) => f.mustHaves.includes(m)),
    },
  }
}

/**
 * The business description sent with a live run (the questionnaire's "What your business does", editable there):
 * the must haves and the preferred districts in words, which the live agents read. Empty when neither is given, so
 * the questionnaire behaves as before.
 */
export function businessDescription(s: Pick<Settings, "businessType" | "mustHaves" | "districts">): string {
  const parts: string[] = []
  if (s.mustHaves.length > 0) parts.push(`Must have: ${s.mustHaves.map((m) => m.toLowerCase()).join(", ")}.`)
  if (s.districts.trim()) parts.push(`Preferred districts: ${s.districts.trim().replace(/[.\s]+$/, "")}.`)
  return parts.length === 0 ? "" : `${BUSINESS_TYPE_LABELS[s.businessType]}. ${parts.join(" ")}`
}
