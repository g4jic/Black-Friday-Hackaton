import { AreaM2 } from "./area.js"
import { DomainError, type DomainErrorCode } from "./errors.js"
import { missingData, unverifiedData, type MissingData } from "./missing.js"
import { Money, type Currency } from "./money.js"
import { MAX_QUOTE_LENGTH, MAX_QUOTE_PARTS, QUOTE_PART_SEPARATOR, calc, sourced, type SourceRef, type Sourced } from "./source.js"

/**
 * Shared rules for every agent that reads a text (a listing, a lease) and returns fields with quotes.
 * Plain code, no model: a found value must carry a quote (one to three parts, each found verbatim in the text), and
 * a number must appear in its own quote. A field the text does not state becomes MissingData.
 */
export type QuotedFieldType =
  | { readonly kind: "text" }
  | { readonly kind: "enum"; readonly values: readonly string[] }
  /** An amount, or (when rentMultiple) a number of months of rent ("jedna kirija"): code computes that amount. */
  | { readonly kind: "money"; readonly rentMultiple?: boolean }
  | { readonly kind: "area" }
  /** A plain number as written in the text (for example a percentage: 3 for "3%"). */
  | { readonly kind: "number" }
  /** A period as written ("36 meseci", "10 godina"): value + unit; code converts it to months. */
  | { readonly kind: "duration" }
  | { readonly kind: "boolean" }

export type QuotedFieldSpec = { readonly name: string; readonly type: QuotedFieldType; readonly what: string }

/** "Two months of rent", as the text says it. Code turns it into an amount once the rent is known. */
export type RentMultiple = { readonly monthsOfRent: number }

export function isRentMultiple(v: unknown): v is RentMultiple {
  return typeof v === "object" && v !== null && typeof (v as RentMultiple).monthsOfRent === "number"
}

export type QuotedFields = Record<string, Sourced<unknown> | MissingData>
export type UnverifiedField = { readonly field: string; readonly reason: string }

const CURRENCIES: readonly Currency[] = ["EUR", "RSD", "USD"]
/** Splits "part one ... part two" (three dots or the ellipsis character) into its parts. */
const QUOTE_PARTS_SPLIT = /\s*(?:\.\.\.|…)\s*/

/** Lower case, one space between words, same quote characters: so a quote matches the text despite spacing. */
export function normalizeText(s: string): string {
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

/** Serbian number words for small counts ("jedne mesečne zakupnine", "dve kirije", "tri zakupnine"). */
const NUMBER_WORDS: Record<number, readonly string[]> = {
  1: ["jedan", "jedna", "jedne", "jednu", "jednog", "jednom", "jedno"],
  2: ["dva", "dve", "dvije", "dvaju", "dvema"],
  3: ["tri", "triju"],
  4: ["četiri", "cetiri"],
  5: ["pet"],
  6: ["šest", "sest"],
  12: ["dvanaest"],
}

const inQuote = (quote: string, value: number) =>
  numbersIn(quote).some((n) => Math.abs(n - value) < 0.005) ||
  (NUMBER_WORDS[value] ?? []).some((w) => normalizeText(quote).split(/[^\p{L}]+/u).includes(w))

export type ExtractionOptions = {
  /** Id of the text, used in error messages ("demo-03", "lease-demo-07"). */
  readonly textId: string
  /** Builds the source of one value from the field name and its quote. */
  readonly sourceFor: (field: string, quote: string) => SourceRef
  /**
   * Last attempt: keep the fields that pass and turn each failing field into MissingData marked "unverified"
   * instead of rejecting the whole answer. Invalid JSON is still rejected.
   */
  readonly partial?: boolean
}

type Problem = { field: string; code: DomainErrorCode; message: string }

export function extractQuotedFields(
  text: string,
  specs: readonly QuotedFieldSpec[],
  answer: unknown,
  options: ExtractionOptions,
): { fields: QuotedFields; unverified: UnverifiedField[] } {
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
  const normalized = normalizeText(text)
  const problems: Problem[] = []
  const fields: QuotedFields = {}

  for (const spec of specs) {
    const f = record[spec.name] as Record<string, unknown> | undefined
    const fail = (code: DomainErrorCode, message: string) => problems.push({ field: spec.name, code, message })
    if (!f || typeof f !== "object" || typeof f.found !== "boolean") {
      fail("invalid_extraction", 'expected an object with "found" true or false')
      continue
    }
    const isMultiple = spec.type.kind === "money" && f.monthsOfRent !== undefined && f.monthsOfRent !== null
    const valueKey = isMultiple ? "monthsOfRent" : spec.type.kind === "money" ? "amount" : "value"
    if (!f.found) {
      if (f[valueKey] !== null && f[valueKey] !== undefined) fail("invalid_extraction", "found is false but a value is given")
      else fields[spec.name] = missingData(spec.name)
      continue
    }
    // A quote is one string whose parts are joined with " ... " (or a list of parts); code checks each part.
    const rawParts = Array.isArray(f.quote) ? f.quote : typeof f.quote === "string" ? f.quote.split(QUOTE_PARTS_SPLIT) : []
    const parts = rawParts.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean)
    if (parts.length === 0) {
      fail("value_without_source", "value has no quote from the text")
      continue
    }
    if (parts.length > MAX_QUOTE_PARTS) {
      fail("invalid_extraction", `a quote may have at most ${MAX_QUOTE_PARTS} parts`)
      continue
    }
    const tooLong = parts.find((p) => p.length > MAX_QUOTE_LENGTH)
    if (tooLong) {
      fail("invalid_extraction", `a quote part is longer than ${MAX_QUOTE_LENGTH} characters`)
      continue
    }
    const absent = parts.find((p) => !normalized.includes(normalizeText(p)))
    if (absent) {
      fail("invalid_extraction", `quote "${absent}" does not appear in the text`)
      continue
    }
    const quote = parts.join(QUOTE_PART_SEPARATOR)
    const all = parts.join(" ")
    const source = options.sourceFor(spec.name, quote)
    const value = f[valueKey]
    try {
      switch (spec.type.kind) {
        case "text":
          if (typeof value !== "string" || value.trim() === "") throw new Error("value must be a non-empty string")
          fields[spec.name] = sourced(value.trim(), source)
          break
        case "enum": {
          const allowed = spec.type.values
          const match = typeof value === "string" ? allowed.find((v) => v.toLowerCase() === value.toLowerCase()) : undefined
          if (!match) throw new Error(`value must be one of ${allowed.join(", ")}`)
          fields[spec.name] = sourced(match, source)
          break
        }
        case "boolean":
          if (typeof value !== "boolean") throw new Error("value must be true or false")
          fields[spec.name] = sourced(value, source)
          break
        case "money": {
          if (isMultiple) {
            if (!spec.type.rentMultiple) throw new Error("this field takes an amount, not months of rent")
            if (typeof value !== "number" || !(value > 0) || !Number.isInteger(value)) throw new Error("monthsOfRent must be a whole number of at least 1")
            if (!inQuote(all, value)) throw new Error(`monthsOfRent ${value} does not appear in its quote`)
            fields[spec.name] = sourced<RentMultiple>({ monthsOfRent: value }, source)
            break
          }
          const currency = typeof f.currency === "string" ? (f.currency.toUpperCase() as Currency) : undefined
          if (typeof value !== "number" || !(value > 0)) throw new Error("amount must be a positive number")
          if (!currency || !CURRENCIES.includes(currency)) throw new Error(`currency must be one of ${CURRENCIES.join(", ")}`)
          if (!inQuote(all, value)) throw new Error(`amount ${value} does not appear in its quote`)
          fields[spec.name] = sourced(Money.of(value, currency), source)
          break
        }
        case "area":
          if (typeof value !== "number" || !(value > 0)) throw new Error("value must be a positive number of m2")
          if (!inQuote(all, value)) throw new Error(`value ${value} does not appear in its quote`)
          fields[spec.name] = sourced(AreaM2.of(value), source)
          break
        case "number":
          if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("value must be a number of at least 0")
          if (!inQuote(all, value)) throw new Error(`value ${value} does not appear in its quote`)
          fields[spec.name] = sourced(value, source)
          break
        case "duration": {
          const unit = f.unit
          if (typeof value !== "number" || !(value > 0)) throw new Error("value must be a positive number")
          if (unit !== "months" && unit !== "years") throw new Error('unit must be "months" or "years"')
          if (!inQuote(all, value)) throw new Error(`value ${value} does not appear in its quote`)
          // Unit conversion is code, not the model: the stored value is always in months.
          fields[spec.name] = sourced(unit === "years" ? value * 12 : value, source)
          break
        }
      }
    } catch (error) {
      fail("invalid_extraction", (error as Error).message)
    }
  }

  if (problems.length > 0 && !options.partial) {
    const code = problems.every((p) => p.code === "value_without_source") ? "value_without_source" : "invalid_extraction"
    throw new DomainError(code, `Extraction rejected for ${options.textId}: ${problems.map((p) => `${p.field}: ${p.message}`).join("; ")}`)
  }
  const unverified = problems.map((p) => ({ field: p.field, reason: p.message }))
  for (const u of unverified) fields[u.field] = unverifiedData(u.field, u.reason)
  return { fields, unverified }
}

/**
 * Turns "N months of rent" into an amount: code multiplies the sourced rent, so the result is a calc with both
 * quotes as inputs. Without a rent it stays MissingData (unverified), never a guess.
 */
export function amountFromRentMultiple(field: string, value: Sourced<RentMultiple>, rent: Sourced<Money> | MissingData): Sourced<Money> | MissingData {
  if ("status" in rent) return unverifiedData(field, `stated as ${value.value.monthsOfRent} month(s) of rent, but the rent is not stated`)
  return calc(rent.value.multiply(value.value.monthsOfRent), `${field} = ${value.value.monthsOfRent} x monthly rent`, [value, rent])
}
