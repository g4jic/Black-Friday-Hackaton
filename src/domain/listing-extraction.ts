import type { AreaM2 } from "./area.js"
import type { ListingText } from "./listing-text.js"
import { isMissingData, missingData, type MissingData } from "./missing.js"
import type { Money } from "./money.js"
import { amountFromRentMultiple, extractQuotedFields, isRentMultiple, type QuotedFieldSpec, type RentMultiple, type UnverifiedField } from "./quoted-extraction.js"
import type { Sourced } from "./source.js"

export type ListingKind = "rent" | "sale"

/** A listing value: found in the text with its source and quote, or MissingData. Never a guess. */
export type Field<T> = Sourced<T> | MissingData

/** A listing as SuiteSpot knows it. Every value points to the listing text (field + quote) or is MissingData. */
export type Listing = {
  /** Listing text id ("pasted-2", "demo-04") or, in mode B with permission, the listing page URL. */
  readonly ref: string
  /** The listing text with contact data removed. Other agents (Premises inspector, Auditor) read it. */
  readonly text: string
  readonly synthetic: boolean
  readonly title: Field<string>
  readonly kind: Field<ListingKind>
  readonly city: Field<string>
  readonly address: Field<string>
  readonly rentMonthly: Field<Money>
  readonly area: Field<AreaM2>
  /** An amount from the text, or computed by code from "N months of rent" (source calc). */
  readonly deposit: Field<Money>
  readonly serviceChargeMonthly: Field<Money>
  readonly floor: Field<string>
  readonly heating: Field<string>
  readonly parking: Field<string>
  /** Fields the Scout stated but code could not verify: MissingData now, "check before signing" in the report. */
  readonly unverified: readonly UnverifiedField[]
}

const text = { kind: "text" } as const
const money = { kind: "money" } as const

/** The fields the Scout extracts, in order. The JSON schema in the application layer is built from this list. */
export const LISTING_FIELDS = [
  { name: "title", type: text, what: "the listing headline" },
  { name: "kind", type: { kind: "enum", values: ["rent", "sale"] }, what: "rent or sale" },
  { name: "city", type: text, what: "city" },
  { name: "address", type: text, what: "street or neighbourhood" },
  { name: "rentMonthly", type: money, what: "monthly rent" },
  { name: "area", type: { kind: "area" }, what: "floor area in m2" },
  { name: "deposit", type: { kind: "money", rentMultiple: true }, what: "deposit: an amount, or a number of months of rent" },
  { name: "serviceChargeMonthly", type: money, what: "monthly service charge or building costs" },
  { name: "floor", type: text, what: "floor (ground floor, first floor, ...)" },
  { name: "heating", type: text, what: "heating type" },
  { name: "parking", type: text, what: "parking" },
] as const satisfies readonly (QuotedFieldSpec & { name: Exclude<keyof Listing, "ref" | "text" | "synthetic" | "unverified"> })[]

export type ListingFieldName = (typeof LISTING_FIELDS)[number]["name"]

/**
 * Turns the Scout's structured answer into a Listing. Every value is checked against the listing text by
 * extractQuotedFields. Strict by default (any problem throws, so the Scout can fix it); with partial the failing
 * fields become unverified MissingData and the rest is kept.
 */
export function buildListing(listingText: ListingText, answer: unknown, options: { partial?: boolean } = {}): Listing {
  const { fields, unverified } = extractQuotedFields(listingText.text, LISTING_FIELDS, answer, {
    textId: listingText.id,
    sourceFor: (field, quote) => ({ kind: "listing", ref: listingText.id, field, quote }),
    partial: options.partial,
  })
  const deposit = fields.deposit
  if (deposit && !isMissingData(deposit) && isRentMultiple(deposit.value)) {
    fields.deposit = amountFromRentMultiple("deposit", deposit as Sourced<RentMultiple>, fields.rentMonthly as Field<Money>)
  }
  const stillUnverified = [...unverified]
  if (isMissingData(fields.deposit) && fields.deposit.unverified && !stillUnverified.some((u) => u.field === "deposit")) {
    stillUnverified.push({ field: "deposit", reason: fields.deposit.unverified })
  }
  return Object.freeze({ ref: listingText.id, text: listingText.text, synthetic: listingText.synthetic, ...fields, unverified: stillUnverified }) as unknown as Listing
}

/** A listing with every field missing. For tests and for mode B stubs. */
export function emptyListing(ref: string, text = "", synthetic = true): Listing {
  const fields = Object.fromEntries(LISTING_FIELDS.map((f) => [f.name, missingData(f.name)]))
  return Object.freeze({ ref, text, synthetic, ...fields, unverified: [] }) as unknown as Listing
}
