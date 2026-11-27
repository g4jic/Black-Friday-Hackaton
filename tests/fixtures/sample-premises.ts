import { buildPremises, type PremisesFacts, type PremisesTexts } from "../../src/domain/index.js"

/** A SYNTHETIC listing text that states every premises feature (tests never call a model). */
export const SAMPLE_PREMISES_TEXT =
  "Lokal u prizemlju sa izlogom ka ulici. Parking ispred objekta. Grejanje: centralno. Postoji ventilacija za kuhinju. Priključak za vodu i odvod. Useljiv odmah, bez renoviranja. Ulaz bez stepenika."

/** The quoted answer the Premises inspector would give for SAMPLE_PREMISES_TEXT: every check is stated and good. */
export const samplePremisesAnswer = () => ({
  floor: { found: true, value: "ground", quote: "Lokal u prizemlju" },
  storefront: { found: true, value: true, quote: "sa izlogom ka ulici" },
  parking: { found: true, value: true, quote: "Parking ispred objekta" },
  heating: { found: true, value: "centralno", quote: "Grejanje: centralno" },
  kitchenVentilation: { found: true, value: true, quote: "Postoji ventilacija za kuhinju" },
  waterAndDrain: { found: true, value: true, quote: "Priključak za vodu i odvod" },
  needsRenovation: { found: true, value: false, quote: "bez renoviranja" },
  stepFreeAccess: { found: true, value: true, quote: "Ulaz bez stepenika" },
})

/** Premises facts for a candidate whose listing text is SAMPLE_PREMISES_TEXT (checked by the same code as a real run). */
export function samplePremises(candidateId: string): PremisesFacts {
  const texts: PremisesTexts = { listingRef: candidateId, listingText: SAMPLE_PREMISES_TEXT, leaseId: null, leaseText: null }
  return buildPremises(candidateId, texts, samplePremisesAnswer())
}
