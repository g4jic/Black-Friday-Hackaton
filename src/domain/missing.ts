/**
 * A value or figure we do not have: the source does not state it, or an input to a calculation is missing.
 * Shown as "missing data" in the report, never estimated and never filled with a guess.
 */
export type MissingData = { readonly status: "missing_data"; readonly missing: readonly string[] }

export function isMissingData(x: unknown): x is MissingData {
  return typeof x === "object" && x !== null && (x as MissingData).status === "missing_data"
}

/** MissingData for one named field, for example missingData("area"). */
export function missingData(...fields: string[]): MissingData {
  return Object.freeze({ status: "missing_data", missing: Object.freeze([...fields]) })
}
