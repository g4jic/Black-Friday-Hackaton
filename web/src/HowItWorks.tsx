import { useEffect, useState, type ReactNode } from "react"
import { humanError } from "./app/api-fetch"
import { Pill } from "./ui"

/** The subset of /api/assumptions this page shows (the same constants the code runs on). */
type Assumptions = {
  ranking: {
    weights: Record<string, number>
    cost: { fullScoreAtOrBelow: number; zeroScoreAt: number }
    rentShare: { checkAbove: number; basis: string }
    confidence: Record<string, string>
  }
  hardFlags: { budgetTolerance: number; maxTermWithoutExitMonths: number }
  leaseConcerns: { maxNoticeMonths: number; maxFixedIndexationPercent: number }
  location: { radiusM: number; rules: Record<string, ({ metric: string } & ({ kind: "more_is_better"; fullAt: number } | { kind: "competition"; fullAtOrBelow: number; zeroAt: number }))[]>; metricText: Record<string, string>; businessText: Record<string, string> }
  noise: { description: string; denseHomesAtLeast: number; industrialBuildingsAtLeast: number }
  buy: {
    description: string
    priceEurPerM2: { source: { ref: string; url: string } }
    interestRatePerYear: { value: number; source: string; url: string }
    downPaymentShare: { value: number; source: string }
    loanYears: { value: number; source: string }
    transferTaxRate: { value: number; source: string }
    propertyTaxRatePerYear: { value: number; source: string }
    buyingFeesRate: { value: number; source: string }
    cashReturnPerYear: { value: number; source: string; url: string }
    maintenanceRatePerYear: { value: number; source: string }
    priceChange: string
    notIncluded: string
  }
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`

const WEIGHT_TEXT: Record<string, [string, string]> = {
  cost: ["Cost", "the full monthly cost against your budget"],
  area: ["Area", "how close the size is to the size you need"],
  lease: ["Lease terms", "early exit, notice period and rent increases"],
  location: ["Location", "what is around the address, for your type of business"],
  premises: ["The space", "what the listing says about the space itself"],
  checks: ["Points to check", "each open point to check before signing lowers the score"],
}

const TEAM: { name: string; text: string; code?: boolean }[] = [
  { name: "Scout", text: "Reads each listing and picks out the facts: rent, size, address, terms." },
  { name: "Lease reader", text: "Reads the lease terms: notice, early exit, rent increases, guarantees." },
  { name: "Finance analyst", text: "Explains the numbers: full monthly cost, money to move in, what leaving early costs." },
  { name: "Location analyst", text: "Reads the map data around the address and says what it means for your business." },
  { name: "Premises inspector", text: "Reports what the listing says about the space, with the exact words it found." },
  { name: "Ranker", text: "Scores and orders the spaces with fixed rules.", code: true },
  { name: "Report writer", text: "Writes the short report, using only the checked facts." },
  { name: "Auditor", text: "Checks every number in the report against its source and removes anything it cannot find.", code: true },
]

/** "How it works": the score, the team, the verdicts and every assumption with its source. Read from the server. */
export function HowItWorksPage() {
  const [a, setA] = useState<Assumptions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setError(null)
    fetch("/api/assumptions")
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as Assumptions & { error?: string }
        if (!r.ok) throw new Error(body.error ?? "This page could not be loaded.")
        setA(body)
      })
      .catch((e: unknown) => setError(humanError(e)))
  }, [attempt])
  if (error)
    return (
      <Card title="How it works">
        <p role="alert">{error}</p>
        <button type="button" onClick={() => setAttempt(attempt + 1)} className="mt-4 inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]">
          Try again
        </button>
      </Card>
    )
  if (!a) return <Card title="How it works">Loading...</Card>
  const r = a.ranking
  const b = a.buy
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="About the data" className="lg:col-span-2">
        <p className="max-w-[80ch]">
          Every listing, landlord, contact and business on SuiteSpot in this version is synthetic: 100 generated listings in Novi Sad and Beograd,
          made for this prototype. Prices per m2 follow public 2025-2026 ranges; area data is real public OpenStreetMap data. Offers, leases and
          rent payments are real records in the app, but no real money moves: payments are simulated, or Stripe in test mode. Before launch, the
          founders agree the first listings with landlords so the platform is not empty. Not financial or legal advice.
        </p>
      </Card>
      <Card title="Your score, out of 100">
        <p className="mb-3">Each space gets a score from fixed rules, the same for everyone. The parts:</p>
        <ul className="space-y-2">
          {Object.entries(r.weights).map(([k, w]) => (
            <li key={k} className="flex items-baseline gap-3">
              <span className="tnum w-8 shrink-0 text-right font-semibold text-ink">{w}</span>
              <span>
                <span className="font-medium text-ink">{WEIGHT_TEXT[k]?.[0] ?? k}</span>: {WEIGHT_TEXT[k]?.[1] ?? ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3">
          Cost gets full points at {pct(r.cost.fullScoreAtOrBelow)} of your budget or less and none at {pct(r.cost.zeroScoreAt)}. When something is not known, it shows as missing and is never guessed.
        </p>
      </Card>

      <Card title="Who works on your research">
        <p className="mb-3">They work on every space at the same time and share what they find, so one finding can stop the others early.</p>
        <ul className="space-y-2">
          {TEAM.map((m) => (
            <li key={m.name}>
              <span className="font-medium text-ink">{m.name}</span>
              {m.code && <span className="ml-1.5 text-xs text-ink-3">(fixed rules)</span>}: {m.text}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Verdicts and tags">
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2">
            <Pill variant="positive">Good</Pill>
            <span>No deal breaker and nothing to check before signing.</span>
          </li>
          <li className="flex items-start gap-2">
            <Pill variant="soft">Check before signing</Pill>
            <span>Worth a look, with named points to check first.</span>
          </li>
          <li className="flex items-start gap-2">
            <Pill variant="hard">Not recommended</Pill>
            <span>A deal breaker was found; the space is stopped and not ranked.</span>
          </li>
        </ul>
        <p className="mt-4 font-medium text-ink">Deal breakers</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>The monthly cost is more than {pct(a.hardFlags.budgetTolerance)} over your budget.</li>
          <li>You cannot leave early and the lease runs longer than {a.hardFlags.maxTermWithoutExitMonths} months.</li>
          <li>The landlord may raise the rent at will.</li>
        </ul>
        <p className="mt-3 font-medium text-ink">Points to check before signing</p>
        <p className="mt-1">
          Notice longer than {a.leaseConcerns.maxNoticeMonths} months, a fixed rent increase above {a.leaseConcerns.maxFixedIndexationPercent}% a year, a personal guarantee, structural repairs paid by you, an early exit penalty, noisy work next to homes, and rent above {pct(r.rentShare.checkAbove)} of your expected revenue.
        </p>
        <p className="mt-3 font-medium text-ink">Confidence</p>
        <ul className="mt-1 space-y-1">
          {Object.entries(r.confidence).map(([k, v]) => (
            <li key={k}>
              <span className="font-medium text-ink capitalize">{k}</span>: {v}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Our assumptions and their sources">
        <p className="mb-3">Where no published figure exists, the number is our own assumption and is labelled so.</p>
        <ul className="space-y-2.5">
          <Assumption label={`Rent share check: above ${pct(r.rentShare.checkAbove)} of expected revenue`} source={r.rentShare.basis} />
          <Assumption
            label={`Noise: dense housing from ${a.noise.denseHomesAtLeast} homes within ${a.location.radiusM} m; an industrial zone from ${a.noise.industrialBuildingsAtLeast} industrial buildings`}
            source="SuiteSpot assumption, applied to OpenStreetMap land use"
          />
          <Assumption label={`Location: what is mapped within ${a.location.radiusM} m of the address`} source="SuiteSpot assumption; OpenStreetMap does not measure foot traffic or revenue" />
        </ul>
        <p className="mt-4 font-medium text-ink">Lease or buy a similar space</p>
        <p className="mt-1 mb-2">{b.description}</p>
        <ul className="space-y-2.5">
          <Assumption label="Price per m2 by part of town" source={b.priceEurPerM2.source.ref} url={b.priceEurPerM2.source.url} />
          <Assumption label={`Loan interest ${pct(b.interestRatePerYear.value)} a year`} source={b.interestRatePerYear.source} url={b.interestRatePerYear.url} />
          <Assumption label={`Down payment ${pct(b.downPaymentShare.value)}, loan over ${b.loanYears.value} years`} source={`${b.downPaymentShare.source}. ${b.loanYears.source}`} />
          <Assumption label={`Transfer tax ${pct(b.transferTaxRate.value)}, property tax ${pct(b.propertyTaxRatePerYear.value)} a year`} source={`${b.transferTaxRate.source}. ${b.propertyTaxRatePerYear.source}`} />
          <Assumption label={`Fees ${pct(b.buyingFeesRate.value)}, upkeep ${pct(b.maintenanceRatePerYear.value)} a year`} source={`${b.buyingFeesRate.source}. ${b.maintenanceRatePerYear.source}`} />
          <Assumption label={`Cash put in could earn ${pct(b.cashReturnPerYear.value)} a year elsewhere`} source={b.cashReturnPerYear.source} url={b.cashReturnPerYear.url} />
          <Assumption label="The space keeps its price" source={b.priceChange} />
        </ul>
        <p className="mt-3 text-xs text-ink-3">{b.notIncluded}</p>
      </Card>

      <Card title="Location rules per type of business" className="lg:col-span-2">
        <ul className="grid gap-2 md:grid-cols-2">
          {Object.entries(a.location.rules).map(([type, rules]) => (
            <li key={type}>
              <span className="font-medium text-ink">{a.location.businessText[type] ?? type}:</span>{" "}
              {rules.map((rule) => (rule.kind === "more_is_better" ? `${a.location.metricText[rule.metric]} help (full at ${rule.fullAt})` : `${a.location.metricText[rule.metric]} compete (full at ${rule.fullAtOrBelow} or fewer)`)).join("; ")}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-3">
          Map data ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-ink">
            OpenStreetMap contributors
          </a>
          , ODbL. All listings on SuiteSpot in this version are synthetic.
        </p>
      </Card>
    </div>
  )
}

function Assumption({ label, source, url }: { label: string; source: string; url?: string }) {
  return (
    <li>
      <span className="font-medium text-ink">{label}</span>
      <span className="block text-[13px] text-ink-2">
        {source}
        {url && (
          <>
            {" "}
            <a href={url} target="_blank" rel="noreferrer" className="underline hover:text-ink">
              Source
            </a>
          </>
        )}
      </span>
    </li>
  )
}

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-[28px] p-6 text-sm leading-5 text-ink-2 ${className ?? ""}`}>
      <h2 className="mb-4 inline-flex title-pill rounded-full glass-strong px-3.5 py-1.5 text-lg leading-6 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}
