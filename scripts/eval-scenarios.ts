/**
 * Quality check of the agents (P4): ten varied outside listings evaluated by the running server with the real model.
 * Usage: start the server with ANTHROPIC_API_KEY (`npm run dev`), then `npx tsx scripts/eval-scenarios.ts`.
 * Costs about $0.05 to $0.10 per scenario. Prints one table row per scenario (markdown) for PROGRESS.md.
 */
export {}

const API = process.env.SUITESPOT_API ?? "http://localhost:3000"

type Uses = ("cafe_food" | "retail" | "office_studio" | "workshop")[]
type Listing = {
  title: string; city: "Novi Sad" | "Beograd"; district: string; street: string; areaM2: number; floor: number
  rentMonthly: number; serviceChargeMonthly: number; deposit: number; minimumTermMonths: number
  earlyTermination: { allowed: true; noticeMonths: number } | { allowed: false }
  indexation: { kind: "none" | "cpi" | "landlord_unilateral" } | { kind: "fixed_rate"; ratePercent: number }
  permittedUses: Uses; tenantPaysStructuralRepairs: boolean
}

const cafe = { businessType: "cafe_food", description: "Specialty coffee bar with a small kitchen, take-away and about 20 seats", headcount: 3, areaMinM2: 50, areaMaxM2: 90, currency: "EUR", monthlyBudget: 1500, expectedMonthlyRevenue: 9000, grossMarginRate: 0.65, walkInCustomers: true, leaseMonths: 36, city: "Novi Sad", fitOutBudget: 15000, equipmentBudget: 20000 }
const office = { ...cafe, businessType: "office_studio", description: "Design studio, five people, client meetings", headcount: 5, areaMinM2: 35, areaMaxM2: 70, monthlyBudget: 1200, expectedMonthlyRevenue: 12000, grossMarginRate: 0.8, walkInCustomers: false, city: "Beograd", fitOutBudget: 5000, equipmentBudget: 8000 }
const shop = { ...cafe, businessType: "retail", description: "Small shop for local food products", headcount: 2, areaMinM2: 40, areaMaxM2: 90, monthlyBudget: 1400, expectedMonthlyRevenue: 10000, grossMarginRate: 0.35, city: "Novi Sad", fitOutBudget: 8000, equipmentBudget: 6000 }
const workshop = { ...cafe, businessType: "workshop", description: "Furniture repair workshop", headcount: 2, areaMinM2: 60, areaMaxM2: 150, monthlyBudget: 1000, expectedMonthlyRevenue: 6000, grossMarginRate: 0.5, walkInCustomers: false, city: "Beograd", fitOutBudget: 4000, equipmentBudget: 10000 }

const base: Listing = {
  title: "Lokal 58 m2 Liman 2", city: "Novi Sad", district: "Liman 2", street: "Bulevar cara Lazara", areaM2: 58, floor: 0,
  rentMonthly: 950, serviceChargeMonthly: 60, deposit: 1900, minimumTermMonths: 36, earlyTermination: { allowed: true, noticeMonths: 3 },
  indexation: { kind: "cpi" }, permittedUses: ["cafe_food", "retail"], tenantPaysStructuralRepairs: false,
}
const goodLease = (use: string, rent: number, deposit: number) =>
  `UGOVOR O ZAKUPU POSLOVNOG PROSTORA. Clan 1: Prostor se izdaje za obavljanje delatnosti: ${use}. Clan 2: Mesecna zakupnina iznosi ${rent} EUR. Clan 3: Depozit iznosi ${deposit} EUR. Clan 4: Ugovor se zakljucuje na 36 meseci. Zakupac moze otkazati ugovor uz otkazni rok od 3 meseca. Clan 5: Zakupnina se uskladjuje jednom godisnje sa indeksom potrosackih cena. Clan 6: Troskove odrzavanja konstrukcije, krova i instalacija snosi zakupodavac.`

type Scenario = { id: string; expect: string; profile: object; listing: Listing; leaseDraft?: string }
const SCENARIOS: Scenario[] = [
  { id: "1 cafe NS, good lease", expect: "good, top score", profile: cafe, listing: base, leaseDraft: goodLease("ugostiteljstvo (kafic)", 950, 1900) },
  { id: "2 cafe NS, over budget", expect: "budget hard flag", profile: cafe, listing: { ...base, rentMonthly: 1650, serviceChargeMonthly: 150, deposit: 3300 }, leaseDraft: goodLease("ugostiteljstvo (kafic)", 1650, 3300) },
  { id: "3 cafe NS, office use only", expect: "permitted use hard flag", profile: cafe, listing: { ...base, permittedUses: ["office_studio"] }, leaseDraft: goodLease("kancelarijsko poslovanje", 950, 1900).replace("ugostiteljstvo", "kancelarija") },
  {
    id: "4 cafe NS, locked in + landlord raises rent", expect: "hard flags: no exit, unlimited increase", profile: cafe,
    listing: { ...base, minimumTermMonths: 60, earlyTermination: { allowed: false }, indexation: { kind: "landlord_unilateral" } },
    leaseDraft: "UGOVOR O ZAKUPU. Clan 1: Prostor se izdaje za ugostiteljsku delatnost. Clan 2: Zakupnina iznosi 950 EUR mesecno. Clan 3: Ugovor se zakljucuje na 60 meseci i zakupac ga ne moze otkazati pre isteka roka. Clan 4: Zakupodavac moze u svakom trenutku jednostrano izmeniti visinu zakupnine. Clan 5: Depozit iznosi 1900 EUR.",
  },
  { id: "5 cafe NS, no lease draft", expect: "lower confidence, questions to ask", profile: cafe, listing: { ...base, title: "Lokal 70 m2 Grbavica", district: "Grbavica", areaM2: 70, rentMonthly: 1100 } },
  {
    id: "6 office BG, good", expect: "good", profile: office,
    listing: { ...base, title: "Kancelarija 48 m2 Vracar", city: "Beograd", district: "Vracar", street: "Kalenićeva", areaM2: 48, floor: 2, rentMonthly: 900, serviceChargeMonthly: 80, deposit: 1800, permittedUses: ["office_studio"] },
    leaseDraft: goodLease("kancelarijsko poslovanje", 900, 1800),
  },
  {
    id: "7 office BG, harsh lease", expect: "concerns: guarantee, penalty, structural, 8% a year", profile: office,
    listing: { ...base, title: "Kancelarija 55 m2 Novi Beograd", city: "Beograd", district: "Novi Beograd", street: "Omladinskih brigada", areaM2: 55, floor: 4, rentMonthly: 950, serviceChargeMonthly: 100, deposit: 2850, permittedUses: ["office_studio"], indexation: { kind: "fixed_rate", ratePercent: 8 }, tenantPaysStructuralRepairs: true, earlyTermination: { allowed: true, noticeMonths: 6 } },
    leaseDraft: "UGOVOR O ZAKUPU. Clan 1: Prostor se izdaje za kancelarijsko poslovanje. Clan 2: Zakupnina iznosi 950 EUR mesecno i povecava se za 8% svake godine. Clan 3: Depozit iznosi tri mesecne zakupnine. Clan 4: Direktor zakupca licno jemci za sve obaveze zakupca. Clan 5: Zakupac moze otkazati ugovor uz otkazni rok od 6 meseci, uz penal od 6 mesecnih zakupnina. Clan 6: Sve popravke, ukljucujuci krov, zidove i instalacije, snosi zakupac. Clan 7: Ugovor se zakljucuje na 36 meseci.",
  },
  {
    id: "8 shop NS, good", expect: "good", profile: shop,
    listing: { ...base, title: "Lokal 65 m2 Centar", district: "Centar", street: "Zmaj Jovina", areaM2: 65, rentMonthly: 1100, serviceChargeMonthly: 70, deposit: 2200, permittedUses: ["retail"] },
    leaseDraft: goodLease("trgovina na malo", 1100, 2200),
  },
  { id: "9 shop NS, too big", expect: "area outside the range, lower score", profile: shop, listing: { ...base, title: "Lokal 140 m2 Novo naselje", district: "Novo naselje", areaM2: 140, rentMonthly: 1000, permittedUses: ["retail"] }, leaseDraft: goodLease("trgovina na malo", 1000, 1900) },
  {
    id: "10 workshop BG, vague lease", expect: "missing data, low confidence", profile: workshop,
    listing: { ...base, title: "Radionica 110 m2 Zemun", city: "Beograd", district: "Zemun", street: "Batajnicki drum", areaM2: 110, floor: -1, rentMonthly: 800, serviceChargeMonthly: 40, deposit: 1600, permittedUses: ["workshop"] },
    leaseDraft: "Ugovor o zakupu radionice u Zemunu. Zakupnina se placa mesecno. Ostali uslovi po dogovoru.",
  },
]

type Wire = { type: string; data?: Record<string, unknown> }

async function run(s: Scenario): Promise<string> {
  const started = await fetch(`${API}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "live", source: "outside", profile: s.profile, outside: { listing: s.listing, ...(s.leaseDraft ? { leaseDraft: s.leaseDraft } : {}) } }),
  })
  const body = (await started.json()) as { id?: string; error?: string }
  if (!body.id) return `| ${s.id} | ${s.expect} | refused: ${body.error} | | | |`
  const events: Wire[] = []
  const stream = await fetch(`${API}/api/research/${body.id}/events`)
  const reader = stream.body!.getReader()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += new TextDecoder().decode(value)
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""
    for (const part of parts) {
      const data = part.split("\n").find((l) => l.startsWith("data:"))
      if (data) events.push(JSON.parse(data.slice(5)) as Wire)
    }
    if (events.some((e) => e.type === "research.done")) break
  }
  const of = (type: string) => events.filter((e) => e.type === type).map((e) => e.data ?? {})
  const scored = of("candidate.scored")[0]
  const rejected = of("candidate.rejected").length > 0
  const cancelled = [...new Set(of("loop.cancelled").map((p) => String(p.rule)))]
  const lease = of("lease.read").at(-1)
  const hard = [...new Set([...cancelled, ...((lease?.hardFlags as string[] | undefined) ?? [])])]
  const concerns = ((lease?.concerns as string[] | undefined) ?? [])
  const report = (await (await fetch(`${API}/api/research/${body.id}/report`)).json()) as { sections?: { recommendation?: { text: string }[] } }
  const line = (report.sections?.recommendation?.[0]?.text ?? "").replace(/\|/g, "/").slice(0, 160)
  const score = scored ? `${scored.score}${scored.scoreHigh !== scored.score ? `-${scored.scoreHigh}` : ""} (${scored.confidence}), ${scored.verdict}` : "-"
  return `| ${s.id} | ${s.expect} | ${rejected ? "rejected, not_recommended" : score} | ${hard.join(", ") || "-"} | ${concerns.join(", ") || "-"} | ${line} |`
}

const only = process.argv.slice(2)
console.log("| Scenario | Expected | Score (confidence), verdict | Hard flags | Concerns | First report sentence |")
console.log("|---|---|---|---|---|---|")
// One at a time: the server runs one live research at a time.
for (const s of SCENARIOS.filter((x) => only.length === 0 || only.some((o) => x.id.startsWith(o + " ")))) console.log(await run(s))
