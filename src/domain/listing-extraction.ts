import { AreaM2 } from "./area.js"
import { DomainError, type DomainErrorCode } from "./errors.js"
import type { ListingText } from "./listing-text.js"
import { missingData, type MissingData } from "./missing.js"
import { Money, type Currency } from "./money.js"
import { MAX_QUOTE_LENGTH, sourced, type Sourced } from "./source.js"

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
  readonly deposit: Field<Money>
  readonly serviceChargeMonthly: Field<Money>
  readonly floor: Field<string>
  readonly heating: Field<string>
  readonly parking: Field<string>
}

type FieldType = "text" | "kind" | "money" | "area"

/** The fields the Scout extracts, in order. The JSON schema in the application layer mirrors this list. */
export const LISTING_FIELDS = [
  { name: "title", type: "text", what: "the listing headline" },
  { name: "kind", type: "kind", what: "rent or sale" },
  { name: "city", type: "text", what: "city" },
  { name: "address", type: "text", what: "street or neighbourhood" },
  { name: "rentMonthly", type: "money", what: "monthly rent" },
  { name: "area", type: "area", what: "floor area in m2" },
  { name: "deposit", type: "money", what: "deposit as an amount" },
  { name: "serviceChargeMonthly", type: "money", what: "monthly service charge or building costs" },
  { name: "floor", type: "text", what: "floor (ground floor, first floor, ...)" },
  { name: "heating", type: "text", what: "heating type" },
  { name: "parking", type: "text", what: "parking" },
] as const satisfies readonly { name: keyof Listing; type: FieldType; what: string }[]

export type ListingFieldName = (typeof LISTING_FIELDS)[number]["name"]

const CURRENCIES: readonly Currency[] = ["EUR", "RSD", "USD"]

/** Lower case, one space between words, same quote characters: so a quote matches the text despite spacing. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * All numbers written in a quote, Serbian style: "1.250" and "1 250" are 1250, "72,5" is 72.5,
 * "1.250,50" is 1250.5.
 */
export function numbersIn(quote: string): number[] {
  const out: number[] = []
  for (const m of quote.matchAll(/\d{1,3}(?:[. ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g)) {
    const token = m[0]
    const grouped = /^\d{1,3}(?:[. ]\d{3})+(?:,\d+)?$/.test(token)
    const value = grouped ? Number(token.replace(/[. ]/g, "").replace(",", ".")) : Number(token.replace(",", "."))
    if (Number.isFinite(value)) out.push(value)
  }
  return out
}

type Problem = { code: DomainErrorCode; message: string }

/**
 * Turns the Scout's structured answer into a Listing. Plain code, no model: every found value must carry a quote,
 * the quote must appear in the listing text, and a number must appear in its own quote. A field the text does not
 * state becomes MissingData. Any problem throws one DomainError that lists all problems, so the Scout can fix
 * them in one retry.
 */
export function buildListing(listingText: ListingText, answer: unknown): Listing {
  let raw: unknown = answer
  if (typeof answer === "string") {
    try {
      raw = JSON.parse(answer)
    } catch {
      throw new DomainError("invalid_extraction", "The answer is not valid JSON")
    }
  }
  if (!raw || typeof raw !== "object") throw new DomainError("invalid_extraction", "The answer must be a JSON object")
  const record = raw as Record<string, unknown>
  const text = normalize(listingText.text)
  const problems: Problem[] = []
  const fields: Record<string, Field<unknown>> = {}

  for (const spec of LISTING_FIELDS) {
    const f = record[spec.name] as Record<string, unknown> | undefined
    const fail = (code: DomainErrorCode, message: string) => problems.push({ code, message: `${spec.name}: ${message}` })
    if (!f || typeof f !== "object" || typeof f.found !== "boolean") {
      fail("invalid_extraction", 'expected an object with "found" true or false')
      continue
    }
    const valueKey = spec.type === "money" ? "amount" : "value"
    if (!f.found) {
      if (f[valueKey] !== null && f[valueKey] !== undefined) fail("invalid_extraction", "found is false but a value is given")
      else fields[spec.name] = missingData(spec.name)
      continue
    }
    const quote = typeof f.quote === "string" ? f.quote.trim() : ""
    if (!quote) {
      fail("value_without_source", "value has no quote from the listing text")
      continue
    }
    if (quote.length > MAX_QUOTE_LENGTH) {
      fail("invalid_extraction", `quote is longer than ${MAX_QUOTE_LENGTH} characters`)
      continue
    }
    if (!text.includes(normalize(quote))) {
      fail("invalid_extraction", `quote "${quote}" does not appear in the listing text`)
      continue
    }
    const source = { kind: "listing" as const, ref: listingText.id, field: spec.name, quote }
    const value = f[valueKey]
    try {
      switch (spec.type) {
        case "text":
          if (typeof value !== "string" || value.trim() === "") throw new Error("value must be a non-empty string")
          fields[spec.name] = sourced(value.trim(), source)
          break
        case "kind":
          if (value !== "rent" && value !== "sale") throw new Error('value must be "rent" or "sale"')
          fields[spec.name] = sourced(value, source)
          break
        case "money": {
          const currency = f.currency as Currency
          if (typeof value !== "number" || !(value > 0)) throw new Error("amount must be a positive number")
          if (!CURRENCIES.includes(currency)) throw new Error(`currency must be one of ${CURRENCIES.join(", ")}`)
          if (!numbersIn(quote).some((n) => Math.abs(n - value) < 0.005)) throw new Error(`amount ${value} does not appear in its quote`)
          fields[spec.name] = sourced(Money.of(value, currency), source)
          break
        }
        case "area":
          if (typeof value !== "number" || !(value > 0)) throw new Error("value must be a positive number of m2")
          if (!numbersIn(quote).some((n) => Math.abs(n - value) < 0.005)) throw new Error(`value ${value} does not appear in its quote`)
          fields[spec.name] = sourced(AreaM2.of(value), source)
          break
      }
    } catch (error) {
      fail("invalid_extraction", (error as Error).message)
    }
  }

  if (problems.length > 0) {
    const code = problems.every((p) => p.code === "value_without_source") ? "value_without_source" : "invalid_extraction"
    throw new DomainError(code, `Extraction rejected for ${listingText.id}: ${problems.map((p) => p.message).join("; ")}`)
  }
  return Object.freeze({ ref: listingText.id, text: listingText.text, synthetic: listingText.synthetic, ...fields }) as Listing
}

/** A listing with every field missing. For tests and for mode B stubs. */
export function emptyListing(ref: string, text = "", synthetic = true): Listing {
  const fields = Object.fromEntries(LISTING_FIELDS.map((f) => [f.name, missingData(f.name)]))
  return Object.freeze({ ref, text, synthetic, ...fields }) as Listing
}
