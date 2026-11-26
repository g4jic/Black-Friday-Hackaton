import { DomainError } from "./errors.js"

/**
 * Where a value comes from. Every number SuiteSpot shows carries one.
 * - listing: a public listing page URL (+ field)
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
  readonly inputs?: readonly SourceRef[]
}

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
      if (!/^https?:\/\/\S+$/i.test(s.ref)) throw new DomainError("invalid_source", `Listing source must be an http(s) URL, got "${s.ref}"`)
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
