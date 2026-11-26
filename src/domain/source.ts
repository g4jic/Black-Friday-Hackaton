import { DomainError } from "./errors.js"

/**
 * Where a value comes from. Every number SuiteSpot shows carries one.
 * - listing: a listing text the user pasted or a demo fixture ("pasted-3", "demo-02") + field + quote (the exact
 *   excerpt of the text the value was taken from), or a listing page URL (mode B, only with the site's permission)
 * - osm: an OpenStreetMap element ("node/123") or the Overpass query that produced it
 * - lease: a lease document id (+ clause)
 * - profile: an answer the user gave in the questionnaire (+ field)
 * - assumption: a labelled SuiteSpot assumption from config/weights.json (+ field), user can change it
 * - calc: a value computed by code; ref names the formula, inputs are the sources of its operands
 * - estimate: a range computed by code from comparables; ref names the method, inputs are the comparables
 */
export type SourceKind = "listing" | "osm" | "lease" | "profile" | "assumption" | "calc" | "estimate"

export type SourceRef = {
  readonly kind: SourceKind
  readonly ref: string
  readonly field?: string
  readonly clause?: string
  /** Exact excerpt of the source text the value was taken from (required for listing texts). */
  readonly quote?: string
  /** The source is the text itself, which does NOT state this field (no quote possible). Needs `field`. */
  readonly missing?: boolean
  readonly inputs?: readonly SourceRef[]
}

/** Id of a listing text: "pasted-<n>" (user paste) or "demo-<id>" (synthetic fixture). */
export const LISTING_TEXT_ID = /^(pasted|demo)-[a-z0-9-]+$/

/** Per quote part. A quote may have up to MAX_QUOTE_PARTS parts, each found verbatim in the text. */
export const MAX_QUOTE_LENGTH = 200
export const MAX_QUOTE_PARTS = 3
/** The stored quote joins the parts with " ... ". */
export const QUOTE_PART_SEPARATOR = " ... "
export const MAX_SOURCE_QUOTE_LENGTH = MAX_QUOTE_LENGTH * MAX_QUOTE_PARTS + QUOTE_PART_SEPARATOR.length * (MAX_QUOTE_PARTS - 1)

export type Sourced<T> = { readonly value: T; readonly source: SourceRef }

const KINDS: readonly SourceKind[] = ["listing", "osm", "lease", "profile", "assumption", "calc", "estimate"]

/** Validates a source and returns it, or throws DomainError("invalid_source"). */
export function validateSource(source: unknown): SourceRef {
  const s = source as Partial<SourceRef> | null | undefined
  if (!s || typeof s !== "object") throw new DomainError("invalid_source", "Source is missing")
  if (!s.kind || !KINDS.includes(s.kind)) throw new DomainError("invalid_source", `Unknown source kind "${String(s.kind)}"`)
  if (typeof s.ref !== "string" || s.ref.trim() === "") throw new DomainError("invalid_source", "Source ref is empty")
  switch (s.kind) {
    case "listing":
      if (LISTING_TEXT_ID.test(s.ref)) {
        if (s.missing === true) {
          if (!s.field) throw new DomainError("invalid_source", "A 'not stated' listing source must name the field")
          break
        }
        if (typeof s.quote !== "string" || s.quote.trim() === "") {
          throw new DomainError("invalid_source", `Listing text source "${s.ref}" must carry a quote from the text`)
        }
        if (s.quote.length > MAX_SOURCE_QUOTE_LENGTH) throw new DomainError("invalid_source", `Quote is longer than ${MAX_SOURCE_QUOTE_LENGTH} characters`)
        break
      }
      if (!/^https?:\/\/\S+$/i.test(s.ref)) {
        throw new DomainError("invalid_source", `Listing source must be a listing text id (pasted-<n>, demo-<id>) or an http(s) URL, got "${s.ref}"`)
      }
      break
    case "lease":
      if (!s.clause) throw new DomainError("invalid_source", "Lease source must name the clause")
      break
    case "profile":
    case "assumption":
      if (!s.field) throw new DomainError("invalid_source", `${s.kind} source must name the field`)
      break
    case "calc":
    case "estimate":
      if (!s.inputs || s.inputs.length === 0) throw new DomainError("invalid_source", `${s.kind} source must list its inputs`)
      s.inputs.forEach(validateSource)
      break
    case "osm":
      break
  }
  return s as SourceRef
}

export function sourced<T>(value: T, source: SourceRef): Sourced<T> {
  return { value, source: validateSource(source) }
}

/** A value computed by code from other sourced values. */
export function calc<T>(value: T, formula: string, inputs: readonly Sourced<unknown>[]): Sourced<T> {
  return sourced(value, { kind: "calc", ref: formula, inputs: inputs.map((i) => i.source) })
}
