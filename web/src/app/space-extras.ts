/**
 * "Storefront window" and "Parking" on the onboarding's "Add your first space". The listing has no such fields, so
 * they become words in the listing description, which the Premises inspector reads (the same as a landlord writing
 * them there). No browser access, so it is tested in Node.
 */
export type Storefront = "" | "yes" | "no"

export function spaceExtrasDescription({ storefront, parking }: { storefront: Storefront; parking: string }): string | null {
  const parts: string[] = []
  if (storefront === "yes") parts.push("Storefront window: yes.")
  if (storefront === "no") parts.push("Storefront window: no.")
  const p = parking.trim().replace(/[.\s]+$/, "")
  if (p) parts.push(`Parking: ${p}.`)
  return parts.length > 0 ? parts.join(" ") : null
}
