import { DomainError } from "./errors.js"
import type { IndexationKind } from "./lease.js"
import { MAX_LISTING_TEXT_LENGTH } from "./listing-text.js"
import type { BusinessType } from "./profile.js"

/**
 * A commercial space a landlord publishes on SuiteSpot. Unlike a pasted listing (free text read by the Scout), every
 * value here is a structured field the landlord typed, so plain code can use it with the field as its source.
 * Contact data is NOT part of the listing: it lives in ListingContact and is only revealed on request.
 */

/** Cities SuiteSpot launches in. A swappable list, not a rule about the world. */
export const SUPPORTED_CITIES = ["Novi Sad", "Beograd"] as const
export type SupportedCity = (typeof SUPPORTED_CITIES)[number]

export const PERMITTED_USES: readonly BusinessType[] = ["cafe_food", "retail", "office_studio", "workshop"]

/** How the rent may change during the lease (the same kinds the Lease reader reads from a draft). */
export type ListingIndexation = { readonly kind: "none" } | { readonly kind: "cpi" } | { readonly kind: "fixed_rate"; readonly ratePercent: number } | { readonly kind: "landlord_unilateral" }

/** May the tenant end the lease before the minimum term ends, and with how much notice. */
export type EarlyTermination = { readonly allowed: true; readonly noticeMonths: number } | { readonly allowed: false }

export type SpaceListingInput = {
  readonly title: string
  readonly city: string
  /** Part of the city ("Liman 2", "Vračar"). */
  readonly district: string
  /** Street only, no house number. */
  readonly street: string
  readonly areaM2: number
  /** -1 basement, 0 ground floor, 1 first floor, ... */
  readonly floor: number
  /** All amounts are EUR per month (rent, monthly costs) or EUR once (deposit). */
  readonly rentMonthly: number
  readonly serviceChargeMonthly: number
  readonly deposit: number
  readonly minimumTermMonths: number
  readonly earlyTermination: EarlyTermination
  readonly indexation: ListingIndexation
  readonly permittedUses: readonly BusinessType[]
  readonly tenantPaysStructuralRepairs: boolean
  /** Optional: the landlord's lease draft, as text. */
  readonly leaseDraft?: string | null
  readonly description?: string | null
  /** Optional: a link to a photo (http or https). */
  readonly imageUrl?: string | null
}

export type SpaceListingProps = SpaceListingInput & {
  readonly id: string
  readonly ownerId: string
  readonly isDemo: boolean
  readonly published: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export type ListingProblem = { readonly field: string; readonly message: string }

/** Every field problem at once, so a form can show them next to the fields. */
export class ListingValidationError extends DomainError {
  constructor(readonly problems: readonly ListingProblem[]) {
    super("invalid_listing", `The listing is not complete: ${problems.map((p) => `${p.field}: ${p.message}`).join("; ")}`)
    this.name = "ListingValidationError"
  }
}

export const LISTING_LIMITS = {
  titleMin: 5,
  titleMax: 120,
  textMax: 200,
  areaMinM2: 5,
  areaMaxM2: 5000,
  floorMin: -2,
  floorMax: 40,
  amountMax: 1_000_000,
  termMaxMonths: 360,
  noticeMaxMonths: 36,
  indexationMaxPercent: 50,
  descriptionMax: 4000,
  leaseDraftMax: MAX_LISTING_TEXT_LENGTH,
  urlMax: 2048,
} as const

const INDEXATION_KINDS: readonly IndexationKind[] = ["none", "cpi", "fixed_rate", "landlord_unilateral"]

function optionalText(value: string | null | undefined): string | null {
  const t = value?.trim() ?? ""
  return t === "" ? null : t
}

/** Checks every field and returns the cleaned input, or throws ListingValidationError with all problems. */
export function validateListingInput(input: SpaceListingInput): SpaceListingInput {
  const problems: ListingProblem[] = []
  const fail = (field: string, message: string) => problems.push({ field, message })
  const L = LISTING_LIMITS
  const text = (field: string, value: unknown, min: number, max: number) => {
    const t = typeof value === "string" ? value.trim() : ""
    if (t.length < min) fail(field, min <= 1 ? "is required" : `must have at least ${min} characters`)
    else if (t.length > max) fail(field, `must have at most ${max} characters`)
    return t
  }
  const number = (field: string, value: unknown, min: number, max: number, integer: boolean) => {
    if (typeof value !== "number" || !Number.isFinite(value)) fail(field, "is required")
    else if (integer && !Number.isInteger(value)) fail(field, "must be a whole number")
    else if (value < min || value > max) fail(field, `must be between ${min} and ${max}`)
    return value as number
  }

  const title = text("title", input.title, L.titleMin, L.titleMax)
  const city = text("city", input.city, 1, L.textMax)
  if (city && !(SUPPORTED_CITIES as readonly string[]).includes(city)) fail("city", `must be one of ${SUPPORTED_CITIES.join(", ")}`)
  const district = text("district", input.district, 1, L.textMax)
  const street = text("street", input.street, 1, L.textMax)
  number("areaM2", input.areaM2, L.areaMinM2, L.areaMaxM2, false)
  number("floor", input.floor, L.floorMin, L.floorMax, true)
  number("rentMonthly", input.rentMonthly, 1, L.amountMax, false)
  number("serviceChargeMonthly", input.serviceChargeMonthly, 0, L.amountMax, false)
  number("deposit", input.deposit, 0, L.amountMax, false)
  number("minimumTermMonths", input.minimumTermMonths, 1, L.termMaxMonths, true)

  const exit = input.earlyTermination as Partial<{ allowed: boolean; noticeMonths: number }> | undefined
  if (!exit || typeof exit.allowed !== "boolean") fail("earlyTermination", "is required")
  else if (exit.allowed) number("earlyTermination.noticeMonths", exit.noticeMonths, 0, L.noticeMaxMonths, true)

  const ix = input.indexation as Partial<{ kind: IndexationKind; ratePercent: number }> | undefined
  if (!ix || !INDEXATION_KINDS.includes(ix.kind as IndexationKind)) fail("indexation", "is required")
  else if (ix.kind === "fixed_rate") number("indexation.ratePercent", ix.ratePercent, 0, L.indexationMaxPercent, false)

  const uses = Array.isArray(input.permittedUses) ? [...new Set(input.permittedUses)] : []
  if (uses.length === 0) fail("permittedUses", "choose at least one")
  else if (uses.some((u) => !PERMITTED_USES.includes(u))) fail("permittedUses", "contains an unknown use")
  if (typeof input.tenantPaysStructuralRepairs !== "boolean") fail("tenantPaysStructuralRepairs", "is required")

  const leaseDraft = optionalText(input.leaseDraft)
  if (leaseDraft && leaseDraft.length > L.leaseDraftMax) fail("leaseDraft", `must have at most ${L.leaseDraftMax} characters`)
  const description = optionalText(input.description)
  if (description && description.length > L.descriptionMax) fail("description", `must have at most ${L.descriptionMax} characters`)
  const imageUrl = optionalText(input.imageUrl)
  if (imageUrl) {
    let ok = imageUrl.length <= L.urlMax
    try {
      const u = new URL(imageUrl)
      ok = ok && (u.protocol === "http:" || u.protocol === "https:") && !u.username && !u.password
    } catch {
      ok = false
    }
    if (!ok) fail("imageUrl", "must be a plain http(s) address")
  }

  if (problems.length > 0) throw new ListingValidationError(problems)
  return Object.freeze({
    title,
    city,
    district,
    street,
    areaM2: input.areaM2,
    floor: input.floor,
    rentMonthly: input.rentMonthly,
    serviceChargeMonthly: input.serviceChargeMonthly,
    deposit: input.deposit,
    minimumTermMonths: input.minimumTermMonths,
    earlyTermination: Object.freeze(exit!.allowed ? { allowed: true as const, noticeMonths: exit!.noticeMonths! } : { allowed: false as const }),
    indexation: Object.freeze(ix!.kind === "fixed_rate" ? { kind: "fixed_rate" as const, ratePercent: ix!.ratePercent! } : { kind: ix!.kind as Exclude<IndexationKind, "fixed_rate"> }),
    permittedUses: Object.freeze(uses),
    tenantPaysStructuralRepairs: input.tenantPaysStructuralRepairs,
    leaseDraft,
    description,
    imageUrl,
  })
}

/** The listing entity. Only its owner may change or delete it; demo listings cannot be changed by anyone. */
export class SpaceListing {
  private constructor(readonly props: Readonly<SpaceListingProps>) {}

  static create(input: SpaceListingInput, meta: { id: string; ownerId: string; isDemo?: boolean; now: string }): SpaceListing {
    if (!meta.ownerId.trim()) throw new DomainError("invalid_listing", "A listing needs an owner")
    const clean = validateListingInput(input)
    return new SpaceListing(Object.freeze({ ...clean, id: meta.id, ownerId: meta.ownerId, isDemo: meta.isDemo ?? false, published: true, createdAt: meta.now, updatedAt: meta.now }))
  }

  /** Rebuilds a stored listing (validated again, so a broken row never enters the app). */
  static rehydrate(props: SpaceListingProps): SpaceListing {
    const clean = validateListingInput(props)
    return new SpaceListing(Object.freeze({ ...props, ...clean }))
  }

  get id(): string {
    return this.props.id
  }

  get ownerId(): string {
    return this.props.ownerId
  }

  isOwnedBy(actorId: string): boolean {
    return this.props.ownerId === actorId
  }

  /** Throws when the actor may not change this listing. */
  assertCanChange(actorId: string): void {
    if (!this.isOwnedBy(actorId)) throw new DomainError("not_listing_owner", "Only the owner who published this listing can change or delete it")
  }

  update(input: SpaceListingInput, actorId: string, now: string): SpaceListing {
    this.assertCanChange(actorId)
    const clean = validateListingInput(input)
    return new SpaceListing(Object.freeze({ ...this.props, ...clean, updatedAt: now }))
  }

  toJSON(): SpaceListingProps {
    return this.props
  }
}

/** How a landlord can be reached. Shown only after "Show contact", and only with the landlord's consent. */
export type ListingContactInput = { readonly phone?: string | null; readonly email?: string | null; readonly consentToPublish: boolean }
export type ListingContact = { readonly listingId: string; readonly name: string; readonly phone: string | null; readonly email: string | null }

const PHONE = /^\+381 ?\d{2} ?\d{3} ?\d{2} ?\d{2,3}$|^0\d{2}[ /-]?\d{3}[ -]?\d{3,4}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function createListingContact(listingId: string, name: string, input: ListingContactInput): ListingContact {
  const problems: ListingProblem[] = []
  const phone = optionalText(input.phone)
  const email = optionalText(input.email)?.toLowerCase() ?? null
  if (!phone && !email) problems.push({ field: "contact", message: "give a phone number, an email or both" })
  if (phone && !PHONE.test(phone)) problems.push({ field: "contact.phone", message: "use a Serbian number, for example +381 64 123 45 67" })
  if (email && (!EMAIL.test(email) || email.length > 254)) problems.push({ field: "contact.email", message: "is not a valid email address" })
  if (input.consentToPublish !== true) problems.push({ field: "contact.consentToPublish", message: "you must agree that the contact is shown publicly" })
  if (!name.trim()) problems.push({ field: "contact.name", message: "is required" })
  if (problems.length > 0) throw new ListingValidationError(problems)
  return Object.freeze({ listingId, name: name.trim(), phone, email })
}

/** A demo phone is shown partly masked: "+381 64 *** ** 37". It may look real, so it is never shown in full. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  const local = digits.startsWith("381") ? digits.slice(3) : digits.replace(/^0/, "")
  return `+381 ${local.slice(0, 2)} *** ** ${local.slice(-2)}`
}

export const FLOOR_LABELS: Record<string, string> = { "-2": "second basement", "-1": "basement", "0": "ground floor" }
export function floorLabel(floor: number): string {
  return FLOOR_LABELS[String(floor)] ?? `floor ${floor}`
}
