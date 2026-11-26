/**
 * SYNTHETIC SEED: 100 invented commercial listings (50 Novi Sad, 50 Beograd) and 100 invented demo landlords.
 * Plain code, no model, a fixed seed: every run gives exactly the same result. The same output fills the local store
 * and Supabase (npm run seed:supabase). No real companies, no house numbers (street and part of town only), emails on
 * example.com, phones in a realistic format that the UI only ever shows partly masked.
 *
 * Prices per m2 per part of town are OUR SYNTHETIC ASSUMPTION for the demo (a plausible order of magnitude), not
 * market data. The README says so.
 *
 * FROZEN after approval: changing this file changes the catalogue. tests/seed.test.ts pins its fingerprint.
 */
import type { BusinessType, ListingContactInput, ListingIndexation, SpaceListingInput, SupportedCity } from "../../domain/index.js"

export const SEED = 20261126

/** mulberry32: a tiny deterministic PRNG. */
function prng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!
  const chance = (p: number) => next() < p
  return { next, int, pick, chance }
}
type Rng = ReturnType<typeof prng>

type District = { readonly name: string; readonly eurPerM2: readonly [number, number]; readonly streets: readonly string[] }

/** Synthetic rent per m2 per month (EUR) for a 50 to 80 m2 ground-floor shop; other sizes and floors adjust below. */
export const DISTRICTS: Record<SupportedCity, readonly District[]> = {
  "Novi Sad": [
    { name: "Centar", eurPerM2: [18, 26], streets: ["Zmaj Jovina", "Dunavska", "Pašićeva", "Njegoševa", "Laze Telečkog"] },
    { name: "Stari grad", eurPerM2: [15, 22], streets: ["Jevrejska", "Svetozara Miletića", "Modene", "Ignjata Pavlasa"] },
    { name: "Liman 1", eurPerM2: [13, 17], streets: ["Bulevar cara Lazara", "Fruškogorska", "Ćirpanova"] },
    { name: "Liman 2", eurPerM2: [12, 16], streets: ["Narodnog fronta", "Balzakova", "Ilije Ognjanovića"] },
    { name: "Liman 3", eurPerM2: [11, 15], streets: ["Bulevar despota Stefana", "Braće Ribnikar", "Puškinova"] },
    { name: "Grbavica", eurPerM2: [11, 14], streets: ["Gogoljeva", "Radnička", "Ive Lole Ribara", "Šekspirova"] },
    { name: "Podbara", eurPerM2: [10, 13], streets: ["Kosovska", "Đorđa Rajkovića", "Vuka Karadžića"] },
    { name: "Rotkvarija", eurPerM2: [10, 13], streets: ["Kisačka", "Hadži Ruvimova", "Temerinska"] },
    { name: "Detelinara", eurPerM2: [9, 12], streets: ["Bulevar Jaše Tomića", "Rumenačka", "Janka Čmelika"] },
    { name: "Novo naselje", eurPerM2: [9, 12], streets: ["Bulevar Slobodana Jovanovića", "Seljačkih buna", "Gagarinova"] },
    { name: "Satelit", eurPerM2: [8, 11], streets: ["Seljačkih buna", "Kornelija Stankovića", "Vere Pavlović"] },
    { name: "Telep", eurPerM2: [8, 10], streets: ["Ive Andrića", "Kanadska", "Mileve Marić"] },
    { name: "Adice", eurPerM2: [7, 9], streets: ["Kopaonička", "Podunavska", "Cara Dušana"] },
    { name: "Klisa", eurPerM2: [6, 9], streets: ["Temerinski put", "Partizanska", "Sentandrejski put"] },
  ],
  Beograd: [
    { name: "Stari grad", eurPerM2: [26, 36], streets: ["Knez Mihailova", "Kralja Petra", "Čika Ljubina", "Kosančićev venac"] },
    { name: "Vračar", eurPerM2: [22, 30], streets: ["Njegoševa", "Kalenićeva", "Maksima Gorkog", "Kursulina"] },
    { name: "Dorćol", eurPerM2: [20, 28], streets: ["Cara Dušana", "Strahinjića bana", "Dobračina", "Gospodar Jevremova"] },
    { name: "Savski venac", eurPerM2: [20, 27], streets: ["Nemanjina", "Kneza Miloša", "Sarajevska"] },
    { name: "Novi Beograd", eurPerM2: [15, 22], streets: ["Bulevar Mihajla Pupina", "Jurija Gagarina", "Omladinskih brigada", "Nehruova"] },
    { name: "Palilula", eurPerM2: [12, 16], streets: ["Takovska", "Starine Novaka", "Cvijićeva"] },
    { name: "Zemun", eurPerM2: [12, 16], streets: ["Glavna", "Gospodska", "Ugrinovačka", "Prvomajska"] },
    { name: "Zvezdara", eurPerM2: [11, 15], streets: ["Bulevar kralja Aleksandra", "Dimitrija Tucovića", "Vojislava Ilića"] },
    { name: "Voždovac", eurPerM2: [11, 15], streets: ["Ustanička", "Vojvode Stepe", "Braće Jerković"] },
    { name: "Banovo brdo", eurPerM2: [11, 14], streets: ["Požeška", "Pere Velimirovića", "Trgovačka"] },
    { name: "Karaburma", eurPerM2: [9, 12], streets: ["Mije Kovačevića", "Ivana Milutinovića", "Marijane Gregoran"] },
    { name: "Mirijevo", eurPerM2: [8, 11], streets: ["Mirijevski bulevar", "Vitezova Karađorđeve zvezde", "Matice srpske"] },
  ],
}

const MALE = ["Marko", "Nikola", "Stefan", "Milan", "Aleksandar", "Nemanja", "Dragan", "Zoran", "Miloš", "Dušan", "Lazar", "Vladimir", "Ivan", "Petar", "Đorđe", "Bojan", "Goran", "Srđan", "Uroš", "Filip", "Luka", "Dejan", "Branislav", "Saša"] as const
const FEMALE = ["Milica", "Jelena", "Ana", "Marija", "Jovana", "Ivana", "Dragana", "Snežana", "Tamara", "Teodora", "Katarina", "Sanja", "Mirjana", "Biljana", "Nataša", "Gordana", "Sara", "Tijana", "Vesna", "Ljiljana", "Nevena", "Danijela", "Maja", "Kristina"] as const
const SURNAMES = ["Jovanović", "Petrović", "Nikolić", "Marković", "Đorđević", "Stojanović", "Ilić", "Stanković", "Pavlović", "Milošević", "Popović", "Todorović", "Kostić", "Mitrović", "Ristić", "Savić", "Lukić", "Tomić", "Kovačević", "Simić", "Obradović", "Vasić", "Živković", "Marić", "Radovanović", "Lazić", "Babić", "Đurić", "Milić", "Antić", "Krstić", "Bogdanović", "Mladenović", "Filipović", "Vuković", "Janković", "Stefanović", "Cvetković", "Pešić", "Zorić"] as const

export type SeedOwner = {
  /** Stable key, also the local owner id ("demo-owner-001"). Supabase gets its own user id for the same email. */
  readonly key: string
  readonly fullName: string
  readonly email: string
}

/** The exact excerpt of the lease draft for each clause it contains (what a perfect Lease reader would quote). */
export type LeaseDraftQuotes = Partial<Record<"term" | "notice" | "indexation" | "deposit" | "structuralRepairs" | "permittedUse" | "serviceCharge", string>>

export type SeedListing = {
  readonly id: string
  readonly ownerKey: string
  readonly createdAt: string
  readonly input: SpaceListingInput
  readonly contact: ListingContactInput
  /** null when the listing has no lease draft. Not stored in the database; used for scripted test answers. */
  readonly leaseQuotes: LeaseDraftQuotes | null
  /** What is deliberately bad or missing in this listing (for the seed report and tests). */
  readonly traits: readonly SeedTrait[]
}

export type SeedTrait =
  | "locked_in_without_exit"
  | "unlimited_rent_increase"
  | "tenant_pays_structural_repairs"
  | "long_notice"
  | "no_lease_draft"
  | "draft_missing_clauses"
  | "draft_differs_from_form"
  | "no_description"

const ascii = (s: string) =>
  s
    .replace(/[Đđ]/g, (c) => (c === "Đ" ? "Dj" : "dj"))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

const eur = (n: number) => n.toLocaleString("de-DE")
/** "N months" after "od" (genitive): 1 meseca, 3 meseca, 6 meseci, 24 meseca. */
const months = (n: number) => `${n} ${n % 10 >= 1 && n % 10 <= 4 && (n < 11 || n > 14) ? "meseca" : "meseci"}`
const round = (n: number, step: number) => Math.max(step, Math.round(n / step) * step)

const USE_TEXT: Record<BusinessType, string> = {
  cafe_food: "ugostiteljsku delatnost",
  retail: "trgovinu na malo",
  office_studio: "kancelarijsko poslovanje",
  workshop: "zanatsku delatnost",
}

function owners(rng: Rng, count: number): SeedOwner[] {
  const used = new Map<string, number>()
  return Array.from({ length: count }, (_, i) => {
    const first = rng.chance(0.5) ? rng.pick(MALE) : rng.pick(FEMALE)
    const last = rng.pick(SURNAMES)
    const base = `${ascii(first)}.${ascii(last)}`
    const n = (used.get(base) ?? 0) + 1
    used.set(base, n)
    return { key: `demo-owner-${String(i + 1).padStart(3, "0")}`, fullName: `${first} ${last}`, email: `${base}${n > 1 ? n : ""}@example.com` }
  })
}

function phone(rng: Rng): string {
  const d = (k: number) => Array.from({ length: k }, () => rng.int(0, 9)).join("")
  return `+381 6${rng.pick([0, 1, 2, 3, 4, 5, 6, 9])} ${d(3)} ${d(2)} ${d(2)}`
}

function area(rng: Rng): number {
  const r = rng.next()
  if (r < 0.3) return rng.int(20, 45)
  if (r < 0.7) return rng.int(46, 90)
  if (r < 0.9) return rng.int(91, 160)
  return rng.int(161, 300)
}

function floor(rng: Rng): number {
  const r = rng.next()
  if (r < 0.6) return 0
  if (r < 0.7) return -1
  if (r < 0.88) return 1
  return rng.int(2, 6)
}

function uses(rng: Rng, fl: number): BusinessType[] {
  if (fl === 0) return rng.pick<BusinessType[]>([["cafe_food", "retail"], ["retail"], ["cafe_food"], ["retail", "office_studio"], ["cafe_food", "retail", "office_studio"]])
  if (fl < 0) return rng.pick<BusinessType[]>([["workshop", "retail"], ["workshop"], ["retail"]])
  return rng.pick<BusinessType[]>([["office_studio"], ["office_studio", "workshop"], ["office_studio", "retail"]])
}

const FEATURES = {
  ground: ["izlog prema ulici", "direktan ulaz sa ulice", "dva izloga", "staklena fasada"],
  any: ["klima uređaj", "trofazna struja", "toalet", "manji magacin", "priključak za vodu i odvod", "alarm i video nadzor", "laminat", "renoviran pre dve godine"],
  upper: ["lift u zgradi", "tri odvojene prostorije", "čajna kuhinja", "recepcija u prizemlju"],
}

function description(rng: Rng, fl: number, us: BusinessType[]): string {
  const own = fl === 0 ? [rng.pick(FEATURES.ground)] : fl > 0 ? [rng.pick(FEATURES.upper)] : []
  const extra = [...new Set([rng.pick(FEATURES.any), rng.pick(FEATURES.any)])]
  const fit = us.map((u) => ({ cafe_food: "kafić ili pekaru", retail: "prodavnicu", office_studio: "kancelariju ili studio", workshop: "radionicu" })[u]).join(", ")
  return `Oprema i pogodnosti: ${[...own, ...extra].join(", ")}. Pogodan za ${fit}. Useljiv ${rng.pick(["odmah", "od prvog narednog meseca", "po dogovoru"])}.`
}

function title(rng: Rng, a: number, fl: number, district: string): string {
  const kind = fl > 0 ? rng.pick(["Kancelarija", "Poslovni prostor"]) : fl < 0 ? rng.pick(["Poslovni prostor", "Magacinski prostor"]) : rng.pick(["Lokal", "Ulični lokal", "Poslovni prostor"])
  return rng.pick([`${kind} ${a} m2, ${district}`, `Izdaje se ${kind.toLowerCase()} ${a} m2 - ${district}`, `${kind} ${a} m2 u delu grada ${district}`])
}

/** A lease draft built from clauses; returns the text and the exact quote of every clause it contains. */
function leaseDraft(rng: Rng, l: SpaceListingInput, opts: { omit: readonly (keyof LeaseDraftQuotes)[]; differ: boolean }): { text: string; quotes: LeaseDraftQuotes } {
  const quotes: LeaseDraftQuotes = {}
  const lines: string[] = []
  const add = (key: keyof LeaseDraftQuotes | null, sentence: string) => {
    if (key && opts.omit.includes(key)) return
    if (key) quotes[key] = sentence
    lines.push(`Član ${lines.length + 1}. ${sentence}`)
  }
  add("permittedUse", `Prostor se izdaje za ${l.permittedUses.map((u) => USE_TEXT[u]).join(" i ")}.`)
  add("term", l.minimumTermMonths === 120 ? "Ugovor se zaključuje na period od 10 (deset) godina." : `Ugovor se zaključuje na period od ${months(l.minimumTermMonths)} od dana primopredaje prostora.`)
  const ix: ListingIndexation = opts.differ && l.indexation.kind === "cpi" ? { kind: "landlord_unilateral" } : l.indexation
  const rentLine = `Mesečna zakupnina iznosi ${eur(l.rentMonthly)} EUR.`
  const ixLine: Record<ListingIndexation["kind"], string> = {
    cpi: "Zakupnina se usklađuje jednom godišnje sa indeksom potrošačkih cena koji objavljuje Republički zavod za statistiku.",
    fixed_rate: `Zakupnina se povećava svake godine za ${ix.kind === "fixed_rate" ? ix.ratePercent : 0}% u odnosu na prethodnu godinu.`,
    none: "Zakupnina je fiksna tokom celog trajanja ugovora.",
    landlord_unilateral: "Zakupodavac ima pravo da jednostrano promeni visinu zakupnine u bilo kom trenutku, bez ograničenja.",
  }
  if (opts.omit.includes("indexation")) add(null, rentLine)
  else {
    quotes.indexation = ixLine[ix.kind]
    lines.push(`Član ${lines.length + 1}. ${rentLine} ${ixLine[ix.kind]}`)
  }
  if (l.serviceChargeMonthly > 0) add("serviceCharge", `Pored zakupnine, zakupac plaća zajedničke troškove od ${eur(l.serviceChargeMonthly)} EUR mesečno.`)
  add("deposit", `Zakupac pri potpisivanju uplaćuje depozit od ${eur(l.deposit)} EUR, koji se vraća po isteku ugovora.`)
  const exit = l.earlyTermination
  const notice = exit.allowed ? (opts.differ && l.indexation.kind !== "cpi" ? exit.noticeMonths + 3 : exit.noticeMonths) : 0
  add(
    "notice",
    exit.allowed ? `Zakupac može otkazati ugovor i pre isteka roka, uz otkazni rok od ${months(notice)}.` : "Zakupac nema pravo da otkaže ugovor pre isteka ugovorenog roka.",
  )
  add(
    "structuralRepairs",
    l.tenantPaysStructuralRepairs
      ? "Zakupac o svom trošku snosi sve popravke na objektu, uključujući krov, zidove i instalacije."
      : "Tekuće održavanje snosi zakupac. Investiciono održavanje (krov, fasada, instalacije) snosi zakupodavac.",
  )
  const header = rng.pick(["UGOVOR O ZAKUPU POSLOVNOG PROSTORA (NACRT)", "UGOVOR O ZAKUPU (nacrt zakupodavca)", "NACRT UGOVORA O ZAKUPU POSLOVNOG PROSTORA"])
  const subject = `Predmet: poslovni prostor ${l.areaM2} m2, ${l.district}, ulica ${l.street}, ${l.city}`
  return { text: [`SYNTHETIC DEMO DATA - invented lease draft, not a real contract.`, "", header, subject, "", ...lines].join("\n"), quotes }
}

export type Seed = { readonly owners: readonly SeedOwner[]; readonly listings: readonly SeedListing[] }

/** The whole seed. Deterministic: the same seed always gives the same 100 owners and 100 listings. */
export function generateSeed(): Seed {
  const rng = prng(SEED)
  const people = owners(rng, 100)
  const listings: SeedListing[] = []
  const cities: [SupportedCity, string][] = [["Novi Sad", "ns"], ["Beograd", "bg"]]
  for (const [city, code] of cities) {
    for (let i = 1; i <= 50; i++) {
      const index = listings.length
      const district = rng.pick(DISTRICTS[city])
      const a = area(rng)
      const fl = floor(rng)
      const us = uses(rng, fl)
      // Bigger spaces and spaces off the street cost less per m2.
      const sizeFactor = a <= 45 ? 1.12 : a <= 90 ? 1 : a <= 160 ? 0.88 : 0.78
      const floorFactor = fl === 0 ? 1 : fl < 0 ? 0.6 : 0.8
      const perM2 = district.eurPerM2[0] + rng.next() * (district.eurPerM2[1] - district.eurPerM2[0])
      const rent = round(a * perM2 * sizeFactor * floorFactor, 10)
      const traits: SeedTrait[] = []

      const locked = rng.chance(0.08)
      const unilateral = !locked && rng.chance(0.12)
      const structural = rng.chance(0.14)
      const longNotice = !locked && rng.chance(0.1)
      if (locked) traits.push("locked_in_without_exit")
      if (unilateral) traits.push("unlimited_rent_increase")
      if (structural) traits.push("tenant_pays_structural_repairs")
      if (longNotice) traits.push("long_notice")

      const ixRoll = rng.next()
      const indexation: ListingIndexation = unilateral
        ? { kind: "landlord_unilateral" }
        : ixRoll < 0.55
          ? { kind: "cpi" }
          : ixRoll < 0.82
            ? { kind: "fixed_rate", ratePercent: rng.pick([2, 3, 3, 4, 5]) }
            : { kind: "none" }
      const base: SpaceListingInput = {
        title: title(rng, a, fl, district.name),
        city,
        district: district.name,
        street: rng.pick(district.streets),
        areaM2: a,
        floor: fl,
        rentMonthly: rent,
        serviceChargeMonthly: rng.chance(0.15) ? 0 : round(a * (0.4 + rng.next() * 1.1), 5),
        deposit: rent * rng.pick([1, 1, 2, 2, 2, 3]),
        minimumTermMonths: locked ? 120 : rng.pick([12, 24, 24, 36, 36, 36, 60]),
        earlyTermination: locked ? { allowed: false } : { allowed: true, noticeMonths: longNotice ? rng.pick([6, 9, 12]) : rng.pick([1, 2, 3, 3, 3]) },
        indexation,
        permittedUses: us,
        tenantPaysStructuralRepairs: structural,
        description: null,
        imageUrl: null,
        leaseDraft: null,
      }
      const withDescription = rng.chance(0.75)
      if (!withDescription) traits.push("no_description")
      const withDraft = rng.chance(0.7)
      let leaseQuotes: LeaseDraftQuotes | null = null
      let draftText: string | null = null
      if (withDraft) {
        const omitRoll = rng.next()
        const omit: (keyof LeaseDraftQuotes)[] = omitRoll < 0.12 ? ["indexation"] : omitRoll < 0.22 ? ["notice"] : omitRoll < 0.27 ? ["indexation", "deposit"] : []
        const differ = !locked && omit.length === 0 && rng.chance(0.12)
        if (omit.length > 0) traits.push("draft_missing_clauses")
        if (differ) traits.push("draft_differs_from_form")
        const draft = leaseDraft(rng, base, { omit, differ })
        leaseQuotes = draft.quotes
        draftText = draft.text
      } else traits.push("no_lease_draft")

      const channel = rng.next()
      const owner = people[index]!
      listings.push({
        id: `listing-${code}${String(i).padStart(3, "0")}`,
        ownerKey: owner.key,
        createdAt: new Date(Date.UTC(2026, 10, 1 + (index % 25), 8 + (index % 10), (index * 7) % 60)).toISOString(),
        input: { ...base, description: withDescription ? description(rng, fl, us) : null, leaseDraft: draftText },
        contact: { phone: channel < 0.8 ? phone(rng) : null, email: channel >= 0.3 ? owner.email : null, consentToPublish: true },
        leaseQuotes,
        traits,
      })
    }
  }
  return { owners: people, listings }
}
