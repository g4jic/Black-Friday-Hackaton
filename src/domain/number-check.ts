/**
 * "No invented numbers" for agent explanations: every number an agent writes must be one the code gave it
 * (a calculator result, a listing value, a questionnaire answer), allowing for formatting and rounding.
 */

/** Small counts (months, years, "2 rooms") are always allowed. */
export const ALWAYS_ALLOWED_UP_TO = 12

/** Every way a number may reasonably be written: as is, rounded, and as a percentage of a rate. */
export function numberVariants(value: number): number[] {
  const out = [value, Math.round(value), Math.round(value * 10) / 10, Math.round(value * 100) / 100]
  if (Math.abs(value) <= 1) out.push(value * 100, Math.round(value * 100), Math.round(value * 1000) / 10)
  return out
}

/**
 * The possible values of each number token in a text. "1,310" may be 1310 (English) or 1.31 (Serbian); "1.310"
 * may be 1310 (Serbian) or 1.31 (English); a token is fine if ANY reading is allowed.
 */
export function numberTokens(text: string): { token: string; readings: number[] }[] {
  const out: { token: string; readings: number[] }[] = []
  for (const m of text.matchAll(/\d+(?:[.,  ]\d+)*/g)) {
    const token = m[0].replace(/[  ]$/, "")
    const readings = new Set<number>()
    readings.add(Number(token.replace(/[.,  ]/g, ""))) // all separators are thousands
    const lastSep = Math.max(token.lastIndexOf("."), token.lastIndexOf(","))
    if (lastSep > 0) {
      const intPart = token.slice(0, lastSep).replace(/[.,  ]/g, "")
      readings.add(Number(`${intPart}.${token.slice(lastSep + 1)}`)) // the last separator is the decimal point
    }
    out.push({ token, readings: [...readings].filter(Number.isFinite) })
  }
  return out
}

/** Numbers in the text that match none of the allowed values. Empty = every number has a source. */
export function unsourcedNumbers(text: string, allowed: readonly number[]): string[] {
  const variants = allowed.flatMap(numberVariants)
  const ok = (r: number) => (Number.isInteger(r) && r >= 0 && r <= ALWAYS_ALLOWED_UP_TO) || variants.some((v) => Math.abs(v - r) <= Math.max(0.01, Math.abs(v) * 0.0005))
  return numberTokens(text)
    .filter((t) => !t.readings.some(ok))
    .map((t) => t.token)
}
