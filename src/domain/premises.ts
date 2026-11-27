import { extractQuotedFields, type QuotedFieldSpec, type UnverifiedField } from "./quoted-extraction.js"
import { isMissingData, type MissingData } from "./missing.js"
import type { BusinessType } from "./profile.js"
import type { SourceRef, Sourced } from "./source.js"

const bool = { kind: "boolean" } as const

/**
 * What the Premises inspector reports about the space itself, each value with a quote from the listing or the lease
 * draft. It never judges: code below decides what suits the business and what to check before signing.
 */
export const PREMISES_FIELDS = [
  { name: "floor", type: { kind: "enum", values: ["basement", "ground", "upper"] }, what: "which floor the space is on: basement, ground floor, or an upper floor" },
  { name: "storefront", type: bool, what: "does the space have a shop window or a storefront facing the street" },
  { name: "parking", type: bool, what: "is parking available for customers, staff or deliveries" },
  { name: "heating", type: { kind: "text" }, what: "how the space is heated, as written" },
  { name: "kitchenVentilation", type: bool, what: "is there kitchen ventilation or an exhaust duct" },
  { name: "waterAndDrain", type: bool, what: "is there a water connection and a drain suitable for a kitchen or a bar" },
  { name: "needsRenovation", type: bool, what: "does the space need renovation or refurbishment before it can be used" },
  { name: "stepFreeAccess", type: bool, what: "is the entrance step-free (accessible without stairs)" },
] as const satisfies readonly QuotedFieldSpec[]

export type PremisesFieldName = (typeof PREMISES_FIELDS)[number]["name"]
type F<T> = Sourced<T> | MissingData

export type PremisesFacts = {
  readonly candidateId: string
  readonly floor: F<"basement" | "ground" | "upper">
  readonly storefront: F<boolean>
  readonly parking: F<boolean>
  readonly heating: F<string>
  readonly kitchenVentilation: F<boolean>
  readonly waterAndDrain: F<boolean>
  readonly needsRenovation: F<boolean>
  readonly stepFreeAccess: F<boolean>
  readonly unverified: readonly UnverifiedField[]
}

/** The texts the Premises inspector reads: the listing (its id is the listing ref) and, when there is one, the lease draft. */
export type PremisesTexts = { readonly listingRef: string; readonly listingText: string; readonly leaseId: string | null; readonly leaseText: string | null }

export const PREMISES_LEASE_MARKER = "\n\nLEASE DRAFT:\n"

/** One document for the model (listing, then the lease draft), so every quote can be checked against what it read. */
export function premisesDocument(t: PremisesTexts): string {
  return t.leaseText ? `${t.listingText}${PREMISES_LEASE_MARKER}${t.leaseText}` : t.listingText
}

/**
 * Checks the Premises inspector's answer like every other extraction: each value must come with a quote that is in
 * the text. The source is the listing or the lease draft, whichever holds the quote.
 */
export function buildPremises(candidateId: string, texts: PremisesTexts, answer: unknown, options: { partial?: boolean } = {}): PremisesFacts {
  const doc = premisesDocument(texts)
  const listingPart = texts.listingText.toLowerCase().replace(/\s+/g, " ")
  const { fields, unverified } = extractQuotedFields(doc, PREMISES_FIELDS, answer, {
    textId: `premises-${candidateId}`,
    sourceFor: (field, quote): SourceRef => {
      const first = quote.split(/\s*(?:\.\.\.|…)\s*/)[0]!.toLowerCase().replace(/\s+/g, " ")
      return listingPart.includes(first) || !texts.leaseId
        ? { kind: "listing", ref: texts.listingRef, field, quote }
        : { kind: "lease", ref: texts.leaseId, clause: field, quote }
    },
    partial: options.partial,
  })
  return Object.freeze({ candidateId, ...fields, unverified }) as unknown as PremisesFacts
}

type Check = { readonly name: string; readonly field: PremisesFieldName; readonly good: (v: unknown) => boolean; readonly okText: string; readonly badText: string; readonly checkBeforeSigning: string }

const CHECKS = {
  groundFloor: { name: "ground_floor", field: "floor", good: (v) => v === "ground", okText: "on the ground floor", badText: "not on the ground floor", checkBeforeSigning: "whether customers can reach the space easily and whether signs are allowed" },
  storefront: { name: "storefront", field: "storefront", good: (v) => v === true, okText: "has a storefront", badText: "has no storefront", checkBeforeSigning: "how customers will find the space without a shop window" },
  parking: { name: "parking", field: "parking", good: (v) => v === true, okText: "parking is available", badText: "no parking", checkBeforeSigning: "where customers, staff and deliveries can park" },
  heating: { name: "heating_stated", field: "heating", good: (v) => typeof v === "string" && v.trim().length > 0, okText: "the heating is stated", badText: "the heating is not stated", checkBeforeSigning: "how the space is heated and what it costs" },
  ventilation: { name: "kitchen_ventilation", field: "kitchenVentilation", good: (v) => v === true, okText: "has kitchen ventilation", badText: "has no kitchen ventilation", checkBeforeSigning: "whether an exhaust duct can be installed and who pays for it" },
  water: { name: "water_and_drain", field: "waterAndDrain", good: (v) => v === true, okText: "has water and a drain", badText: "has no water and drain for a kitchen or bar", checkBeforeSigning: "whether water and a drain can be added and at what cost" },
  noRenovation: { name: "no_renovation", field: "needsRenovation", good: (v) => v === false, okText: "needs no renovation", badText: "needs renovation", checkBeforeSigning: "what the renovation includes, who pays and how long it takes" },
  stepFree: { name: "step_free", field: "stepFreeAccess", good: (v) => v === true, okText: "has step-free access", badText: "has no step-free access", checkBeforeSigning: "whether every customer can enter (stairs at the entrance)" },
} as const satisfies Record<string, Check>

/**
 * SuiteSpot assumptions (shown on the Assumptions screen): which premises checks matter for each type of business.
 * A check the listing and the lease do not mention is unknown (missing data), never assumed good or bad.
 */
export const PREMISES_ASSUMPTIONS = {
  description: "Checks of the space itself that matter for this type of business, from what the listing and the lease draft state",
  checks: {
    cafe_food: ["groundFloor", "storefront", "ventilation", "water", "noRenovation", "stepFree"],
    retail: ["groundFloor", "storefront", "noRenovation", "stepFree", "parking"],
    office_studio: ["noRenovation", "parking", "heating"],
    workshop: ["groundFloor", "parking", "noRenovation"],
  } satisfies Record<BusinessType, readonly (keyof typeof CHECKS)[]>,
  checkText: Object.fromEntries(Object.entries(CHECKS).map(([k, c]) => [k, c.okText])) as Record<keyof typeof CHECKS, string>,
} as const

/** Rule names of premises concerns: the checks part does not count them a second time (they lower the premises part). */
export const PREMISES_CONCERN_RULES: readonly string[] = Object.values(CHECKS).map((c) => `premises_${c.name}`)

export type PremisesResult = {
  /** Low end: unknown checks count as 0. */
  readonly score: number
  /** High end: unknown checks count as 1. */
  readonly scoreHigh: number
  readonly known: number
  readonly total: number
  readonly parts: readonly { readonly name: string; readonly ok: boolean; readonly text: string; readonly source: SourceRef }[]
  /** Checks the texts do not mention, by field name. */
  readonly unknown: readonly PremisesFieldName[]
  /** What to check before signing (soft flags), decided here. Never a hard flag. */
  readonly concerns: readonly { readonly rule: string; readonly claim: string; readonly checkBeforeSigning: string; readonly source: SourceRef }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Code decides: scores the space for the business and lists the concerns. Deterministic. */
export function evaluatePremises(facts: PremisesFacts, businessType: BusinessType): PremisesResult {
  const names = PREMISES_ASSUMPTIONS.checks[businessType] as readonly (keyof typeof CHECKS)[]
  const parts: { name: string; ok: boolean; text: string; source: SourceRef }[] = []
  const unknown: PremisesFieldName[] = []
  const concerns: { rule: string; claim: string; checkBeforeSigning: string; source: SourceRef }[] = []
  for (const key of names) {
    const check: Check = CHECKS[key]
    const f = facts[check.field] as F<unknown>
    if (isMissingData(f)) {
      unknown.push(check.field)
      continue
    }
    const ok = check.good(f.value)
    parts.push({ name: check.name, ok, text: `The space ${ok ? check.okText : check.badText}`, source: f.source })
    if (!ok) concerns.push({ rule: `premises_${check.name}`, claim: `The space ${check.badText}`, checkBeforeSigning: check.checkBeforeSigning, source: f.source })
  }
  const good = parts.filter((p) => p.ok).length
  const total = names.length
  return { score: round2(good / total), scoreHigh: round2((good + unknown.length) / total), known: parts.length, total, parts, unknown, concerns }
}
