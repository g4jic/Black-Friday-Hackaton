import type { CandidateDTO } from "./types"

/**
 * Human labels for a candidate, built only from fields the Scout extracted (never invented).
 * Pure functions: tested in tests/candidate-label.test.ts.
 */

const textField = (c: CandidateDTO, key: string): string | null => {
  const v = c.fields[key]?.value
  return v?.kind === "text" && v.value.trim() ? v.value.trim() : null
}

export const areaM2 = (c: CandidateDTO): number | null => {
  const v = c.fields.area?.value
  return v?.kind === "area" ? v.m2 : null
}

/** The neighbourhood: the first part of the address that is not the city ("Novi Sad, Liman 2, ..." gives "Liman 2"). */
export function neighbourhood(c: CandidateDTO): string | null {
  const address = textField(c, "address")
  if (!address) return null
  const city = textField(c, "city")?.toLowerCase()
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean)
  return parts.find((p) => p.toLowerCase() !== city && !/^\d{5}$/.test(p)) ?? parts[0] ?? null
}

/** "Liman 2 · 72 m2"; "Liman 2 · area unknown" when the area is not stated; then the area alone, then "Listing N". */
export function candidateShortName(c: CandidateDTO | undefined, listingNumber: number): string {
  if (!c) return `Listing ${listingNumber}`
  const place = neighbourhood(c)
  const area = areaM2(c)
  const areaText = area !== null ? `${Math.round(area)} m2` : null
  if (place && areaText) return `${place} · ${areaText}`
  if (place) return `${place} · area unknown`
  return areaText ?? `Listing ${listingNumber}`
}

/** "Liman 2, Novi Sad" for the location line. */
export function candidateLocation(c: CandidateDTO): string | null {
  const place = neighbourhood(c)
  const city = textField(c, "city")
  if (place && city && place.toLowerCase() !== city.toLowerCase()) return `${place}, ${city}`
  return place ?? city
}
