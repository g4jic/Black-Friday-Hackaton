/** Prints a summary of the synthetic seed (counts, price ranges, a few samples), to review it: npm run seed:report */
import { createHash } from "node:crypto"
import { generateSeed } from "../src/adapters/seed/generate-listings.js"
import { seedCatalogue } from "../src/adapters/seed/seed-catalogue.js"
const seed = generateSeed()
seedCatalogue(seed)
const L = seed.listings
const count = (t: string) => L.filter((l) => l.traits.includes(t as never)).length
console.log("hash", createHash("sha256").update(JSON.stringify(seed)).digest("hex").slice(0, 16))
console.log("NS", L.filter((l) => l.input.city === "Novi Sad").length, "BG", L.filter((l) => l.input.city === "Beograd").length)
const areas = L.map((l) => l.input.areaM2); console.log("area", Math.min(...areas), Math.max(...areas))
for (const t of ["locked_in_without_exit","unlimited_rent_increase","tenant_pays_structural_repairs","long_notice","no_lease_draft","draft_missing_clauses","draft_differs_from_form","no_description"]) console.log(t, count(t))
console.log("floors", JSON.stringify(Object.entries(L.reduce((m: Record<string, number>, l) => ((m[l.input.floor] = (m[l.input.floor] ?? 0) + 1), m), {}))))
console.log("phone only", L.filter(l=>l.contact.phone&&!l.contact.email).length, "email only", L.filter(l=>!l.contact.phone&&l.contact.email).length, "both", L.filter(l=>l.contact.phone&&l.contact.email).length)
for (const l of [L[0], L[3], L[57]]) console.log(JSON.stringify({ id: l!.id, ...l!.input, leaseDraft: l!.input.leaseDraft?.slice(0, 900), contact: l!.contact, traits: l!.traits }, null, 1))
for (const c of ["Novi Sad","Beograd"]) { const xs = L.filter(l=>l.input.city===c).map(l=>Math.round(l.input.rentMonthly/l.input.areaM2*10)/10).sort((a,b)=>a-b); console.log(c, "eur/m2 min", xs[0], "median", xs[25], "max", xs.at(-1)) }
console.log(seed.owners.slice(0, 8).map((o) => `${o.fullName} <${o.email}>`).join("\n"))
