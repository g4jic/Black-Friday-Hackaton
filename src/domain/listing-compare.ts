import type { AreaM2 } from "./area.js"
import type { Listing } from "./listing-extraction.js"
import type { Money } from "./money.js"
import { isMissingData } from "./missing.js"
import type { SourceRef, Sourced } from "./source.js"

/**
 * "Evaluate an outside listing" with a pasted listing text: the user typed the terms, and the Scout read the same
 * listing from its text. Plain code compares the two. Every difference is a point to check before signing, with
 * both sources: the typed field and the quote from the text. Nothing here decides which one is right.
 */
export const COMPARED_FIELDS = ["rentMonthly", "serviceChargeMonthly", "deposit", "area", "city"] as const
export type ComparedField = (typeof COMPARED_FIELDS)[number]

export type ListingMismatch = { readonly field: ComparedField; readonly claim: string; readonly checkBeforeSigning: string; readonly source: SourceRef }

const FIELD_WORDS: Record<ComparedField, string> = {
  rentMonthly: "monthly rent",
  serviceChargeMonthly: "monthly costs",
  deposit: "deposit",
  area: "area",
  city: "city",
}

/** Whole amounts are compared; a difference under 1 (rounding) is not a mismatch. */
const MONEY_TOLERANCE = 1
const AREA_TOLERANCE_M2 = 1

const fmtMoney = (m: Money) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(m.amount))} ${m.currency}`
const plainCity = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/belgrade/, "beograd")
    .trim()

/** Both sources of a difference: the formula, then the typed field and the text quote as its inputs. */
const both = (typed: Sourced<unknown>, read: Sourced<unknown>): SourceRef => ({ kind: "calc", ref: "typed field compared with the pasted listing text", inputs: [typed.source, read.source] })

export function compareTypedWithText(typed: Listing, read: Listing): ListingMismatch[] {
  const out: ListingMismatch[] = []
  for (const field of COMPARED_FIELDS) {
    const a = typed[field]
    const b = read[field]
    if (isMissingData(a) || isMissingData(b)) continue // the text does not state it: nothing to compare
    const say = (typedText: string, readText: string) =>
      out.push({
        field,
        claim: `The listing text says ${FIELD_WORDS[field]} ${readText}, but the typed terms say ${typedText}`,
        checkBeforeSigning: `which ${FIELD_WORDS[field]} is right: ${readText} (listing text) or ${typedText} (typed)`,
        source: both(a, b),
      })
    if (field === "area") {
      const x = (a.value as AreaM2).value
      const y = (b.value as AreaM2).value
      if (Math.abs(x - y) > AREA_TOLERANCE_M2) say(`${x} m²`, `${y} m²`)
    } else if (field === "city") {
      if (plainCity(String(a.value)) !== plainCity(String(b.value)) && !plainCity(String(b.value)).includes(plainCity(String(a.value)))) say(String(a.value), String(b.value))
    } else {
      const x = a.value as Money
      const y = b.value as Money
      if (x.currency !== y.currency || Math.abs(x.amount - y.amount) >= MONEY_TOLERANCE) say(fmtMoney(x), fmtMoney(y))
    }
  }
  return out
}
