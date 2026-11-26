import { generateSeed, type Seed, type SeedListing } from "./generate-listings.js"

/**
 * Scripted Lease reader answers for the seeded lease drafts, for keyless demo runs and tests. The generator kept the
 * exact sentence of every clause it wrote (leaseQuotes), so the answer quotes the draft verbatim and reads the value
 * from that sentence. It is still only a scripted "model": buildLease (code) checks every quote against the draft and
 * every number against its quote, exactly as for a real model's answer.
 */
const NOT_FOUND = { found: false } as const
const firstNumber = (s: string) => Number(/\d+/.exec(s.replace(/(\d)\.(\d{3})/g, "$1$2"))?.[0])

function answerFor(l: SeedListing): Record<string, unknown> {
  const q = l.leaseQuotes!
  const f = (value: unknown, quote: string) => ({ found: true, value, quote })
  const answer: Record<string, unknown> = {
    term: NOT_FOUND,
    tenantMayTerminateEarly: NOT_FOUND,
    noticePeriod: NOT_FOUND,
    earlyExitPenalty: NOT_FOUND,
    indexationKind: NOT_FOUND,
    indexationRatePercent: NOT_FOUND,
    deposit: NOT_FOUND,
    personalGuarantee: NOT_FOUND,
    tenantPaysStructuralRepairs: NOT_FOUND,
    permittedUse: NOT_FOUND,
  }
  if (q.term) answer.term = { found: true, value: firstNumber(q.term), unit: q.term.includes("godina") ? "years" : "months", quote: q.term }
  if (q.notice) {
    const mayExit = !q.notice.includes("nema pravo")
    answer.tenantMayTerminateEarly = f(mayExit, q.notice)
    if (mayExit) answer.noticePeriod = { found: true, value: firstNumber(q.notice), unit: "months", quote: q.notice }
  }
  if (q.indexation) {
    const ix = q.indexation
    const kind = ix.includes("jednostrano") ? "landlord_unilateral" : ix.includes("indeksom") ? "cpi" : ix.includes("fiksna") ? "none" : "fixed_rate"
    answer.indexationKind = f(kind, ix)
    if (kind === "fixed_rate") answer.indexationRatePercent = f(firstNumber(ix), ix)
  }
  if (q.deposit) answer.deposit = { found: true, amount: firstNumber(q.deposit), currency: "EUR", quote: q.deposit }
  if (q.structuralRepairs) answer.tenantPaysStructuralRepairs = f(q.structuralRepairs.startsWith("Zakupac o svom trošku"), q.structuralRepairs)
  if (q.permittedUse) answer.permittedUse = f(q.permittedUse.replace(/^Prostor se izdaje za /, "").replace(/\.$/, ""), q.permittedUse)
  return answer
}

/** Scripted answers keyed by lease id ("lease-listing-ns014"), one per seeded listing that has a lease draft. */
export function seedLeaseAnswers(seed: Seed = generateSeed()): Record<string, unknown> {
  return Object.fromEntries(seed.listings.filter((l) => l.leaseQuotes).map((l) => [`lease-${l.id}`, answerFor(l)]))
}
