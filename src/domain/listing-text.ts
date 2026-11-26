import { DomainError } from "./errors.js"
import { LISTING_TEXT_ID } from "./source.js"

/** Mode A takes 1 to 8 listings per research run (decided 26 Nov). */
export const MIN_LISTINGS = 1
export const MAX_LISTINGS = 8
export const MAX_LISTING_TEXT_LENGTH = 20_000

/**
 * The text of one listing, as pasted by the user or loaded from a synthetic fixture, with contact data already
 * removed. The raw text with phone numbers or emails never leaves createListingBatch.
 */
export type ListingText = {
  readonly id: string
  readonly text: string
  readonly synthetic: boolean
  /** How many contacts were removed (counts only, never the values). */
  readonly removed: { readonly phones: number; readonly emails: number }
}

export type ListingTextInput = { readonly text: string; readonly id?: string; readonly synthetic?: boolean }

export const PHONE_PLACEHOLDER = "[phone removed]"
export const EMAIL_PLACEHOLDER = "[email removed]"

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
/**
 * Phone candidates: start with "+" or a leading 0 (Serbian style: +381 64 123 4567, 064/123-4567, 021 456 789),
 * then digits with spaces, slashes, dashes or brackets. Dots are not separators here, so dates (01.12.2026) and
 * prices (1.200 EUR) never match. A candidate counts as a phone only with 8 to 13 digits.
 */
const PHONE_CANDIDATE = /(?<![\w.,])(?:\+|0)[\d \t/()-]{6,}\d(?!\d)/g

/** Removes phone numbers and emails from a listing text. Pure; returns the cleaned text and counts. */
export function redactContacts(raw: string): { text: string; phones: number; emails: number } {
  let emails = 0
  let phones = 0
  let text = raw.replace(EMAIL, () => {
    emails++
    return EMAIL_PLACEHOLDER
  })
  text = text.replace(PHONE_CANDIDATE, (match) => {
    const digits = match.replace(/\D/g, "").length
    if (digits < 8 || digits > 13) return match
    phones++
    return PHONE_PLACEHOLDER
  })
  return { text, phones, emails }
}

/**
 * Validates one research run's listing texts (1 to 8, none empty, unique ids) and removes contact data from each
 * before anything else sees it. Ids default to "pasted-1", "pasted-2", ...
 */
export function createListingBatch(inputs: readonly ListingTextInput[]): ListingText[] {
  if (inputs.length < MIN_LISTINGS || inputs.length > MAX_LISTINGS) {
    throw new DomainError("invalid_listing_batch", `A research run takes ${MIN_LISTINGS} to ${MAX_LISTINGS} listings, got ${inputs.length}`)
  }
  const seen = new Set<string>()
  return inputs.map((input, i) => {
    const id = input.id ?? `pasted-${i + 1}`
    if (!LISTING_TEXT_ID.test(id)) throw new DomainError("invalid_listing_batch", `Invalid listing id "${id}"`)
    if (seen.has(id)) throw new DomainError("invalid_listing_batch", `Duplicate listing id "${id}"`)
    seen.add(id)
    if (typeof input.text !== "string" || input.text.trim() === "") {
      throw new DomainError("invalid_listing_batch", `Listing ${i + 1} is empty`)
    }
    if (input.text.length > MAX_LISTING_TEXT_LENGTH) {
      throw new DomainError("invalid_listing_batch", `Listing ${i + 1} is longer than ${MAX_LISTING_TEXT_LENGTH} characters`)
    }
    const { text, phones, emails } = redactContacts(input.text)
    return Object.freeze({ id, text: text.trim(), synthetic: input.synthetic ?? false, removed: Object.freeze({ phones, emails }) })
  })
}
