/**
 * TEST-ONLY SYNTHETIC DATA. Invented listings and lease drafts, not real properties or contracts. They are owned by
 * the tests (never shown in the app) and cover one role each:
 *   listing-01 complete listing with a fair lease draft (should rank first)
 *   listing-02 over the budget (hard flag by the Finance tool), deposit as "three rents"
 *   listing-03 informal text, area missing
 *   listing-04 risky lease: long notice, personal guarantee, tenant pays structural repairs, 60 months, fixed 4%
 *   listing-05 office on the first floor, no lease draft
 *   listing-06 cheap, no lease draft
 *   listing-07 lease locked in without exit and unlimited rent increase (hard flags), deposit "one rent"
 *   listing-08 no rent given
 * The scripted Scout and Lease reader answers are the same shape as the live structured output; plain code checks
 * every quote in them against these texts.
 */
import { createLeaseText, type LeaseText, type ListingTextInput } from "../../src/domain/index.js"

const LABEL = "SYNTHETIC TEST DATA - invented listing, not a real property."
const LEASE_LABEL = "SYNTHETIC TEST DATA - invented lease draft, not a real contract."

const LISTING_TEXTS: Record<string, string> = {
  "listing-01": `${LABEL}

Lokal 72 m2 na Sajmištu, pogodan za kafić

Lokacija: Novi Sad, Sajmište, ulica Hajduk Veljkova
Površina: 72 m2
Mesečna cena: 1.250 € mesečno
Depozit: 2.500 €
Troškovi zgrade: 60 € mesečno
Sprat: prizemlje, ulaz sa ulice, izlog
Grejanje: gas, sopstveni kotao
Parking: javni parking uz objekat

Prostor je renoviran, ima priključak za vodu i odvod, toalet za goste i magacin.`,
  "listing-02": `${LABEL}

PRESTIŽNA LOKACIJA - lokal u Dunavskoj ulici, Novi Sad

Najprometniji deo centra, stalni protok pešaka.
58m2 u prizemlju, staklena fasada.
Mesečna zakupnina 3.200 EUR. Depozit tri zakupnine.
Grejanje: gradska toplana.
Bez parkinga.`,
  "listing-03": `${LABEL}

dajem lokal kod pijace na adicama, novi sad. dobar za pekaru ili brzu hranu.
cena 900e. trofazna struja. bez agencije.`,
  "listing-04": `${LABEL}

Lokal 88 m2 sa dvorišnim parkingom - Satelit, Novi Sad

Izdaje se poslovni prostor na Satelitu, Ulica Seljačkih buna. Ranije je bio restoran, ostala je ventilacija.

Podaci:
- Kvadratura: 88 m2
- Kirija: 1.400 EUR/mesec
- Depozit: 1.400 EUR
- Prizemlje i galerija
- Grejanje: TA peći
- Parking: u dvorištu zgrade`,
  "listing-05": `${LABEL}

Kancelarija 65 m2, Bulevar cara Lazara, Novi Sad

Kancelarijski prostor na prvom spratu poslovne zgrade, tri prostorije i kuhinjica.

Cena: 1.100 EUR mesečno + PDV
Troškovi održavanja: 85 EUR mesečno
Grejanje: centralno
Parking: dva mesta u garaži

Bez izloga i bez ulaza sa ulice.`,
  "listing-06": `${LABEL}

IZDAJEM LOKAL ROTKVARIJA NOVI SAD 50 M2

POVRŠINA 50 M2, PRIZEMLJE, IZLOG NA ULICU.
CENA 700 EUR MESEČNO.
POTREBNO KREČENJE.
GREJANJE NA STRUJU. PARKING NA ULICI.`,
  "listing-07": `${LABEL}

Klisa - lokal za izdavanje

* 80 m2, prizemlje, izlog
* kirija 1 050 eur mesečno
* depozit: jedna kirija
* grejanje: etažno na gas
* parking ispred lokala
* Temerinski put, Novi Sad`,
  "listing-08": `${LABEL}

Lokal 60 m2, Salajka, Novi Sad

Izdaje se lokal na Salajci, Ulica Save Kovačevića. Površina 60 m2, prizemlje, izlog.
Cena po dogovoru.
Grejanje: centralno.
Parking u ulici.`,
}

const LEASE_TEXTS: Record<string, string> = {
  "listing-01": `${LEASE_LABEL}

UGOVOR O ZAKUPU POSLOVNOG PROSTORA (NACRT)
Lokal 72 m2, Sajmište, ulica Hajduk Veljkova, Novi Sad

Član 1. Namena
Prostor se koristi za ugostiteljsku delatnost (kafić).

Član 2. Trajanje
Ugovor se zaključuje na period od 36 meseci od dana primopredaje.

Član 3. Zakupnina
Mesečna zakupnina iznosi 1.250 EUR i usklađuje se jednom godišnje sa indeksom potrošačkih cena Republičkog zavoda za statistiku.

Član 4. Depozit
Zakupac uplaćuje depozit od 2.500 EUR, koji se vraća po isteku ugovora.

Član 5. Otkaz
Zakupac može otkazati ugovor pre isteka roka, uz otkazni rok od 3 meseca.

Član 6. Održavanje
Investiciono održavanje (krov, fasada, instalacije) snosi zakupodavac.`,
  "listing-04": `${LEASE_LABEL}

UGOVOR O ZAKUPU (nacrt zakupodavca)
Poslovni prostor 88 m2, Satelit, Novi Sad

1. Prostor se izdaje za obavljanje ugostiteljske delatnosti.
2. Ugovor traje pet godina, odnosno 60 meseci, od dana potpisivanja.
3. Zakupnina iznosi 1.400 EUR mesečno i povećava se svake godine za 4% u odnosu na prethodnu godinu.
4. Depozit iznosi 1.400 EUR.
5. Zakupac može raskinuti ugovor pre isteka roka uz otkazni rok od 6 meseci.
6. Direktor zakupca lično jemči za sve obaveze zakupca.
7. Zakupac o svom trošku snosi sve popravke na objektu, uključujući krov, zidove i instalacije.`,
  "listing-07": `${LEASE_LABEL}

UGOVOR O ZAKUPU POSLOVNOG PROSTORA
Lokal 80 m2, Klisa, Temerinski put, Novi Sad

Član 1. Prostor se daje u zakup za trgovinsku i ugostiteljsku delatnost.
Član 2. Ugovor se zaključuje na period od 10 (deset) godina.
Član 3. Zakupac nema pravo da otkaže ugovor pre isteka ugovorenog roka.
Član 4. Mesečna zakupnina iznosi 1.050 EUR. Zakupodavac ima pravo da jednostrano promeni visinu zakupnine u bilo kom trenutku, bez ograničenja.
Član 5. Zakupac uplaćuje depozit u visini jedne mesečne zakupnine.
Član 6. Investiciono održavanje snosi zakupodavac.`,
}

const f = (value: unknown, quote: string) => ({ found: true, value, quote })
const money = (amount: number, quote: string) => ({ found: true, amount, currency: "EUR", quote })
const none = { found: false }

const SCOUT_ANSWERS: Record<string, unknown> = {
  "listing-01": {
    title: f("Lokal 72 m2 na Sajmištu, pogodan za kafić", "Lokal 72 m2 na Sajmištu, pogodan za kafić"),
    kind: f("rent", "Mesečna cena"),
    city: f("Novi Sad", "Lokacija: Novi Sad"),
    address: f("Sajmište, ulica Hajduk Veljkova", "Sajmište, ulica Hajduk Veljkova"),
    rentMonthly: money(1250, "Mesečna cena: 1.250 € mesečno"),
    area: f(72, "Površina: 72 m2"),
    deposit: money(2500, "Depozit: 2.500 €"),
    serviceChargeMonthly: money(60, "Troškovi zgrade: 60 € mesečno"),
    floor: f("prizemlje", "Sprat: prizemlje"),
    heating: f("gas, sopstveni kotao", "Grejanje: gas, sopstveni kotao"),
    parking: f("javni parking uz objekat", "Parking: javni parking uz objekat"),
  },
  "listing-02": {
    title: f("PRESTIŽNA LOKACIJA - lokal u Dunavskoj ulici, Novi Sad", "PRESTIŽNA LOKACIJA - lokal u Dunavskoj ulici, Novi Sad"),
    kind: f("rent", "Mesečna zakupnina 3.200 EUR"),
    city: f("Novi Sad", "Dunavskoj ulici, Novi Sad"),
    address: f("Dunavska ulica, centar", "lokal u Dunavskoj ulici"),
    rentMonthly: money(3200, "Mesečna zakupnina 3.200 EUR"),
    area: f(58, "58m2 u prizemlju"),
    deposit: { found: true, monthsOfRent: 3, quote: "Depozit tri zakupnine." },
    serviceChargeMonthly: none,
    floor: f("prizemlje", "58m2 u prizemlju"),
    heating: f("gradska toplana", "Grejanje: gradska toplana"),
    parking: f("bez parkinga", "Bez parkinga."),
  },
  "listing-03": {
    title: f("dajem lokal kod pijace na adicama", "dajem lokal kod pijace na adicama, novi sad"),
    kind: f("rent", "dajem lokal"),
    city: f("Novi Sad", "na adicama, novi sad"),
    address: f("Adice, kod pijace", "lokal kod pijace na adicama"),
    rentMonthly: money(900, "cena 900e"),
    area: none,
    deposit: none,
    serviceChargeMonthly: none,
    floor: none,
    heating: none,
    parking: none,
  },
  "listing-04": {
    title: f("Lokal 88 m2 sa dvorišnim parkingom - Satelit, Novi Sad", "Lokal 88 m2 sa dvorišnim parkingom - Satelit, Novi Sad"),
    kind: f("rent", "Izdaje se poslovni prostor"),
    city: f("Novi Sad", "Satelit, Novi Sad"),
    address: f("Satelit, Ulica Seljačkih buna", "na Satelitu, Ulica Seljačkih buna"),
    rentMonthly: money(1400, "Kirija: 1.400 EUR/mesec"),
    area: f(88, "Kvadratura: 88 m2"),
    deposit: money(1400, "Depozit: 1.400 EUR"),
    serviceChargeMonthly: none,
    floor: f("prizemlje i galerija", "Prizemlje i galerija"),
    heating: f("TA peći", "Grejanje: TA peći"),
    parking: f("u dvorištu zgrade", "Parking: u dvorištu zgrade"),
  },
  "listing-05": {
    title: f("Kancelarija 65 m2, Bulevar cara Lazara, Novi Sad", "Kancelarija 65 m2, Bulevar cara Lazara, Novi Sad"),
    kind: f("rent", "1.100 EUR mesečno"),
    city: f("Novi Sad", "Bulevar cara Lazara, Novi Sad"),
    address: f("Bulevar cara Lazara", "Bulevar cara Lazara, Novi Sad"),
    rentMonthly: money(1100, "Cena: 1.100 EUR mesečno + PDV"),
    area: f(65, "Kancelarija 65 m2"),
    deposit: none,
    serviceChargeMonthly: money(85, "Troškovi održavanja: 85 EUR mesečno"),
    floor: f("prvi sprat", "na prvom spratu poslovne zgrade"),
    heating: f("centralno", "Grejanje: centralno"),
    parking: f("dva mesta u garaži", "Parking: dva mesta u garaži"),
  },
  "listing-06": {
    title: f("IZDAJEM LOKAL ROTKVARIJA NOVI SAD 50 M2", "IZDAJEM LOKAL ROTKVARIJA NOVI SAD 50 M2"),
    kind: f("rent", "IZDAJEM LOKAL"),
    city: f("Novi Sad", "ROTKVARIJA NOVI SAD"),
    address: f("Rotkvarija", "ROTKVARIJA NOVI SAD"),
    rentMonthly: money(700, "CENA 700 EUR MESEČNO."),
    area: f(50, "POVRŠINA 50 M2"),
    deposit: none,
    serviceChargeMonthly: none,
    floor: f("prizemlje", "PRIZEMLJE, IZLOG NA ULICU"),
    heating: f("na struju", "GREJANJE NA STRUJU"),
    parking: f("na ulici", "PARKING NA ULICI"),
  },
  "listing-07": {
    title: f("Klisa - lokal za izdavanje", "Klisa - lokal za izdavanje"),
    kind: f("rent", "lokal za izdavanje"),
    city: f("Novi Sad", "Temerinski put, Novi Sad"),
    address: f("Klisa, Temerinski put", "Temerinski put, Novi Sad"),
    rentMonthly: money(1050, "kirija 1 050 eur mesečno"),
    area: f(80, "80 m2, prizemlje, izlog"),
    deposit: { found: true, monthsOfRent: 1, quote: "depozit: jedna kirija" },
    serviceChargeMonthly: none,
    floor: f("prizemlje", "80 m2, prizemlje"),
    heating: f("etažno na gas", "grejanje: etažno na gas"),
    parking: f("ispred lokala", "parking ispred lokala"),
  },
  "listing-08": {
    title: f("Lokal 60 m2, Salajka, Novi Sad", "Lokal 60 m2, Salajka, Novi Sad"),
    kind: f("rent", "Izdaje se lokal na Salajci"),
    city: f("Novi Sad", "Salajka, Novi Sad"),
    address: f("Salajka, Ulica Save Kovačevića", "Ulica Save Kovačevića"),
    rentMonthly: none,
    area: f(60, "Površina 60 m2"),
    deposit: none,
    serviceChargeMonthly: none,
    floor: f("prizemlje", "Površina 60 m2, prizemlje"),
    heating: f("centralno", "Grejanje: centralno."),
    parking: f("u ulici", "Parking u ulici."),
  },
}

const LEASE_ANSWERS: Record<string, unknown> = {
  "lease-listing-01": {
    term: { found: true, value: 36, unit: "months", quote: "na period od 36 meseci" },
    tenantMayTerminateEarly: f(true, "Zakupac može otkazati ugovor pre isteka roka"),
    noticePeriod: { found: true, value: 3, unit: "months", quote: "uz otkazni rok od 3 meseca" },
    earlyExitPenalty: none,
    indexationKind: f("cpi", "usklađuje se jednom godišnje sa indeksom potrošačkih cena"),
    indexationRatePercent: none,
    deposit: money(2500, "depozit od 2.500 EUR"),
    personalGuarantee: none,
    tenantPaysStructuralRepairs: f(false, "Investiciono održavanje (krov, fasada, instalacije) snosi zakupodavac."),
    permittedUse: f("ugostiteljska delatnost (kafić)", "Prostor se koristi za ugostiteljsku delatnost (kafić)."),
  },
  "lease-listing-04": {
    term: { found: true, value: 60, unit: "months", quote: "odnosno 60 meseci" },
    tenantMayTerminateEarly: f(true, "Zakupac može raskinuti ugovor pre isteka roka"),
    noticePeriod: { found: true, value: 6, unit: "months", quote: "uz otkazni rok od 6 meseci" },
    earlyExitPenalty: none,
    indexationKind: f("fixed_rate", "povećava se svake godine za 4%"),
    indexationRatePercent: f(4, "povećava se svake godine za 4%"),
    deposit: money(1400, "Depozit iznosi 1.400 EUR."),
    personalGuarantee: f(true, "Direktor zakupca lično jemči za sve obaveze zakupca"),
    tenantPaysStructuralRepairs: f(true, "Zakupac o svom trošku snosi sve popravke na objektu, uključujući krov, zidove i instalacije."),
    permittedUse: f("ugostiteljska delatnost", "Prostor se izdaje za obavljanje ugostiteljske delatnosti."),
  },
  "lease-listing-07": {
    term: { found: true, value: 10, unit: "years", quote: "na period od 10 (deset) godina" },
    tenantMayTerminateEarly: f(false, "Zakupac nema pravo da otkaže ugovor pre isteka ugovorenog roka."),
    noticePeriod: none,
    earlyExitPenalty: none,
    indexationKind: f("landlord_unilateral", "Zakupodavac ima pravo da jednostrano promeni visinu zakupnine u bilo kom trenutku, bez ograničenja"),
    indexationRatePercent: none,
    deposit: { found: true, monthsOfRent: 1, quote: "depozit u visini jedne mesečne zakupnine" },
    personalGuarantee: none,
    tenantPaysStructuralRepairs: f(false, "Investiciono održavanje snosi zakupodavac."),
    permittedUse: f("trgovinska i ugostiteljska delatnost", "za trgovinsku i ugostiteljsku delatnost"),
  },
}

/** The 8 test listings as raw text inputs (the same shape as a user paste), in id order. */
export function sampleListings(): ListingTextInput[] {
  return Object.entries(LISTING_TEXTS).map(([id, text]) => ({ id, text, synthetic: true }))
}

export function sampleListing(id: string): ListingTextInput {
  const text = LISTING_TEXTS[id]
  if (!text) throw new Error(`No sample listing "${id}"`)
  return { id, text, synthetic: true }
}

/** The 3 test lease drafts (for listing-01, listing-04 and listing-07). */
export function sampleLeases(): LeaseText[] {
  return Object.entries(LEASE_TEXTS).map(([id, text]) => createLeaseText(id, text, true))
}

export function sampleScoutAnswers(): Record<string, unknown> {
  return structuredClone(SCOUT_ANSWERS)
}

export function sampleLeaseAnswers(): Record<string, unknown> {
  return structuredClone(LEASE_ANSWERS)
}

/** The test data as a demo catalogue for the server (the app itself has none built in). */
export const SAMPLE_CATALOGUE = {
  listings: sampleListings,
  leases: sampleLeases,
  scoutAnswers: sampleScoutAnswers,
  leaseAnswers: sampleLeaseAnswers,
}
