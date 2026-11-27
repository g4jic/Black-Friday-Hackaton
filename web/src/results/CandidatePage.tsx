import { ArrowLeft, Check, ExternalLink, OctagonAlert, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { useResearch } from "../app/research-store"
import { Link, paths } from "../app/router"
import { AdviceNote, Card, EmptyState } from "../app/Shell"
import { candidateLocation, candidateShortName } from "../candidate-label"
import { ResearchMissing } from "../pages/ResearchPage"
import type { CandidateDTO, SourceDTO } from "../types"
import { SourceLabel, cx, describeSource, formatMoney } from "../ui"
import {
  VERDICT_LABEL,
  VERDICT_TONE,
  allSources,
  costChart,
  costRows,
  leaseOrBuyChart,
  leaseSection,
  locationSection,
  percent1,
  premisesSection,
  resultsList,
  strengthsAndRisks,
  unknowns,
  yearScenarios,
  type ChartBar,
  type ListEntry,
  type PointItem,
} from "./results-model"
import { VerdictDot } from "./VerdictDot"

/**
 * One candidate (/research/:id/candidate/:candidateId) as a short financial report: a summary on top (verdict colour,
 * score or range, monthly cost, the main reason), then collapsible cards. Each card opens with one sentence on what
 * it shows and what it means here; every number after it carries its source.
 */
export function CandidatePage({ researchId, candidateId }: { researchId: string; candidateId: string }) {
  const snapshot = useResearch(researchId)
  if (snapshot.status === "missing") return <ResearchMissing />
  const { state } = snapshot
  const candidate = state.candidates[candidateId]
  const back = (
    <Link
      to={paths.results(researchId)}
      className="inline-flex h-9 w-fit items-center gap-2 rounded-full glass-strong px-4 text-sm font-medium text-ink hover:bg-white"
    >
      <ArrowLeft size={16} aria-hidden /> Back to the list
    </Link>
  )
  if (!candidate) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <EmptyState text={state.done ? "This candidate is not part of this research." : "Loading the candidate..."} />
      </div>
    )
  }
  const { ranked, rejected } = resultsList(state)
  const entry = [...ranked, ...rejected].find((e) => e.candidate.id === candidateId)
  const position = ranked.findIndex((e) => e.candidate.id === candidateId)

  return (
    <div className="flex flex-col gap-4">
      {back}
      <Summary candidate={candidate} listingNumber={entry?.listingNumber ?? 1} position={position >= 0 ? position + 1 : null} entry={entry} />
      {/*
        Two stacks side by side on a wide screen, so a collapsed card never leaves a hole next to an open one. On a
        phone the stacks dissolve (display: contents) and the cards follow the report order through `order`.
      */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <CostsCard candidate={candidate} className="order-1 lg:order-none" />
          <YearScenariosCard candidate={candidate} className="order-2 lg:order-none" />
          <LeaseCard candidate={candidate} className="order-4 lg:order-none" />
          <PremisesCard candidate={candidate} className="order-6 lg:order-none" />
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <LeaseOrBuyCard candidate={candidate} className="order-3 lg:order-none" />
          <LocationCard candidate={candidate} className="order-5 lg:order-none" />
          <StrengthsRisksCard candidate={candidate} className="order-7 lg:order-none" />
          <UnknownsCard candidate={candidate} className="order-8 lg:order-none" />
        </div>
      </div>
      <SourcesCard candidate={candidate} />
      <AdviceNote />
    </div>
  )
}

/** A report card: collapsible (remembered per card), opening with its one-sentence reading. */
function ReportCard({ id, title, intro, className, children }: { id: string; title: string; intro: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card title={title} collapsible id={`candidate-${id}`} className={className}>
      <p className="mb-4 max-w-[70ch] text-sm leading-6 text-ink">{intro}</p>
      {children}
    </Card>
  )
}

/** A money figure followed by its source pill. */
function Money({ amount, currency, source }: { amount: number; currency: string; source: SourceDTO }) {
  return (
    <span className="tnum font-semibold whitespace-nowrap text-ink">
      {formatMoney(amount, currency)}
      <SourceLabel source={source} />
    </span>
  )
}

const textField = (c: CandidateDTO, key: string) => {
  const v = c.fields[key]?.value
  return v?.kind === "text" ? v.value : null
}

const TONE_TEXT = { good: "text-green-700", check: "text-amber-800", bad: "text-hard", unknown: "text-ink-2" } as const

function Summary({
  candidate,
  listingNumber,
  position,
  entry,
}: {
  candidate: CandidateDTO
  listingNumber: number
  position: number | null
  entry: ListEntry | undefined
}) {
  const area = candidate.fields.area?.value
  const floor = textField(candidate, "floor")
  const facts = [
    candidateLocation(candidate),
    area?.kind === "area" ? `${area.m2} m2` : null,
    floor ? (/floor|ground|basement/i.test(floor) ? floor : `floor ${floor}`) : null,
  ].filter(Boolean)
  const ranking = candidate.ranking
  const rejected = candidate.status === "rejected"
  const reason = entry?.mainReason
  // the sources behind the main reason: the deal breaker, or the Ranker's strongest plus and biggest minus
  const reasonSources = rejected
    ? candidate.rejection
      ? [candidate.rejection.source]
      : []
    : (["plus", "minus"] as const).flatMap((effect) => ranking?.reasons.find((r) => r.effect === effect)?.source ?? [])
  return (
    <section className="glass rounded-[28px] p-6" aria-label="Summary">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {entry && <VerdictDot verdict={entry.verdict} rank={position} rejected={rejected} size="lg" />}
          <div className="min-w-0">
            <h2 className="text-2xl leading-8 font-semibold text-ink">{candidateShortName(candidate, listingNumber)}</h2>
            <p className="text-[13px] leading-5 text-ink-2">
              {entry && (
                <span className={cx("font-semibold", rejected ? "text-hard" : TONE_TEXT[VERDICT_TONE[entry.verdict]])}>
                  {rejected ? "Rejected by a deal breaker" : VERDICT_LABEL[entry.verdict]}
                </span>
              )}
              {facts.length > 0 && <span> · {facts.join(" · ")}</span>}
            </p>
          </div>
        </div>
        <ListingLink candidate={candidate} />
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] bg-white/60 p-4">
          <dt className="text-xs text-ink-2">Score</dt>
          <dd className="mt-1">
            {ranking ? (
              <span className="tnum text-[28px] leading-none font-semibold text-ink" title={entry?.scoreRangeNote ?? undefined}>
                {ranking.scoreHigh > ranking.score ? `${ranking.score}-${ranking.scoreHigh}` : ranking.score}
                <span className="ml-0.5 text-sm font-medium text-ink-3">/100</span>
              </span>
            ) : (
              <span className="text-sm text-ink-3">{rejected ? "Not scored: stopped by a deal breaker" : "No score"}</span>
            )}
            {ranking && (
              <span className="mt-1.5 block text-xs text-ink-2">
                {ranking.scoreHigh > ranking.score ? "worst case to best case, " : ""}
                {entry?.confidence?.toLowerCase()}. Scored by code (see How it works).
              </span>
            )}
          </dd>
        </div>
        <div className="rounded-[20px] bg-white/60 p-4">
          <dt className="text-xs text-ink-2">Monthly cost</dt>
          <dd className="mt-1">
            {entry?.monthlyCost && entry.monthlyCostSource ? (
              <span className="tnum text-[28px] leading-none font-semibold text-ink">
                {entry.monthlyCost}
                <SourceLabel source={entry.monthlyCostSource} />
              </span>
            ) : (
              <span className="text-sm text-ink-3 italic">missing data: the rent is not stated</span>
            )}
            {entry?.rentShare && (
              <span className={cx("mt-1.5 block text-xs", entry.rentShare.aboveThreshold ? "text-amber-800" : "text-ink-2")}>
                {entry.rentShare.text}
                <SourceLabel source={entry.rentShare.source} />
              </span>
            )}
          </dd>
        </div>
        <div className="rounded-[20px] bg-white/60 p-4">
          <dt className="text-xs text-ink-2">Main reason</dt>
          <dd className="mt-1 text-sm leading-6 font-medium text-ink">
            {reason ? `${reason.replace(/\.$/, "")}.` : "Not known yet."}
            {reasonSources.map((source, i) => (
              <SourceLabel key={i} source={source} />
            ))}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/** A real link only when a URL was really given; nothing is ever built or guessed. */
function ListingLink({ candidate }: { candidate: CandidateDTO }) {
  if (candidate.listingUrl) {
    return (
      <a
        href={candidate.listingUrl.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]"
      >
        Open listing <ExternalLink size={15} aria-hidden />
      </a>
    )
  }
  if (candidate.synthetic) return null
  return <span className="text-[13px] text-ink-3">No listing URL was given</span>
}

/**
 * A horizontal bar chart of calculated money figures (one series, one hue, one baseline). The value sits at the
 * bar's tip with its source pill; the bar's tooltip repeats the value and its whole source chain.
 */
function BarChart({ label, bars, note }: { label: string; bars: ChartBar[]; note?: ReactNode }) {
  const max = Math.max(...bars.map((b) => b.amount), 1)
  return (
    <figure className="rounded-[20px] bg-white/60 p-4" aria-label={label}>
      <figcaption className="mb-3 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">{label}</figcaption>
      <ul className="flex flex-col gap-3">
        {bars.map((b) => (
          <li
            key={b.label}
            className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-x-3 text-[13px] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
          >
            <span className="leading-4 text-ink-2">{b.label}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-3.5 rounded-r-[4px] bg-lilac-600"
                style={{ width: `${Math.max(2, (b.amount / max) * 70)}%` }}
                title={`${b.label}: ${b.text}\n${describeSource(b.source)}`}
              />
              <span className="tnum shrink-0 font-semibold whitespace-nowrap text-ink">
                {b.text}
                <SourceLabel source={b.source} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-xs leading-5 text-ink-2">{note}</p>}
    </figure>
  )
}

function CostsCard({ candidate, className }: { candidate: CandidateDTO; className?: string }) {
  const rows = costRows(candidate)
  const share = candidate.ranking?.rentShare
  const chart = costChart(candidate)
  const calculated = rows.some((row) => row.value !== null)
  const intro =
    !calculated && candidate.status === "rejected" ? (
      "What the space costs you from moving in to moving out: not calculated, because a deal breaker stopped the Finance analyst first."
    ) : share ? (
      <>
        What the space costs you from moving in to moving out: the monthly cost is {percent1(share.share)}
        <SourceLabel source={share.source} /> of your expected revenue, {share.aboveThreshold ? "above" : "within"} the {Math.round(share.threshold * 100)}%
        SuiteSpot guide
        {share.aboveThreshold ? ", so check it before signing." : "."}
      </>
    ) : rows[0]?.value ? (
      "What the space costs you from moving in to moving out; how it compares to your revenue is not known (the questionnaire has no expected revenue)."
    ) : (
      "What the space costs you from moving in to moving out; it cannot be judged yet, because the listing does not state the rent."
    )
  return (
    <ReportCard id="costs" title="Costs" intro={intro} className={className}>
      <dl className={cx("flex flex-col divide-y divide-line", !calculated && candidate.status === "rejected" && "hidden")}>
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-3 first:pt-0 last:pb-0">
            <dt className="text-sm text-ink">{row.label}</dt>
            <dd className="tnum text-right text-sm font-semibold whitespace-nowrap text-ink">
              {row.value ? (
                <>
                  {row.value}
                  {row.ref && <SourceLabel source={row.ref} />}
                </>
              ) : (
                <span className="font-normal text-ink-3 italic">missing data</span>
              )}
            </dd>
            {row.note && <dd className="col-span-2 text-xs leading-5 text-ink-2">{row.note}</dd>}
          </div>
        ))}
      </dl>
      {chart.bars.length >= 2 && (
        <div className="mt-4">
          <BarChart
            label="What the lease can cost you"
            bars={chart.bars}
            note={
              <>
                Source: SuiteSpot's lease calculator (calc), from the listing and your questionnaire.
                {chart.missing.length > 0 && ` Not drawn, because it could not be calculated: ${chart.missing.join(", ").toLowerCase()}.`}
              </>
            }
          />
        </div>
      )}
    </ReportCard>
  )
}

/** Lease or buy a similar space: code with labelled public-source assumptions (How it works lists them). */
function LeaseOrBuyCard({ candidate, className }: { candidate: CandidateDTO; className?: string }) {
  const r = candidate.leaseOrBuy
  if (!r) return null
  if (!r.known) {
    return (
      <ReportCard
        id="lease-or-buy"
        title="Lease or buy"
        intro="Renting this space against buying a similar one nearby: not compared, because some inputs are not known."
        className={className}
      >
        <p className="text-[13px] text-ink-3">Not known: {r.missing.join(", ")}.</p>
      </ReportCard>
    )
  }
  const rows = [
    { label: "Price of a similar space", value: r.price },
    { label: "Cash needed to buy (down payment, tax and fees)", value: r.upFront },
    { label: "Loan payment per month", value: r.monthlyLoanPayment },
  ]
  const chart = leaseOrBuyChart(candidate)
  const intro = (
    <>
      Renting this space against buying a similar one nearby over {r.years} years: {r.cheaper === "lease" ? "leasing" : "buying"} comes out about{" "}
      <Money amount={r.difference.amount} currency={r.difference.currency} source={r.difference.source} /> cheaper
      {r.cheaper === "buy" ? (
        <>
          , but buying needs <Money amount={r.upFront.amount} currency={r.upFront.currency} source={r.upFront.source} /> in cash before you start.
        </>
      ) : (
        "."
      )}
    </>
  )
  return (
    <ReportCard id="lease-or-buy" title="Lease or buy" intro={intro} className={className}>
      {chart.length === 2 && (
        <BarChart
          label={`Net cost over ${r.years} years`}
          bars={chart}
          note="Source: SuiteSpot's lease-or-buy calculation (calc). Buying assumes the space keeps its price."
        />
      )}
      <dl className="mt-4 flex flex-col text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
            <dt className="text-ink-2">{row.label}</dt>
            <dd>
              <Money amount={row.value.amount} currency={row.value.currency} source={row.value.source} />
            </dd>
          </div>
        ))}
      </dl>
      {r.notes.map((n) => (
        <p key={n} className="mt-3 text-xs leading-5 text-ink-2">
          {n}
        </p>
      ))}
      <p className="mt-3 text-xs leading-5 text-ink-3">
        Buying uses published average sale prices for this part of town, the average business loan rate and labelled SuiteSpot assumptions (see How it works). A
        rough comparison, not a valuation.
      </p>
    </ReportCard>
  )
}

/** Bad year, good year: what leaving after 12 months costs, and when the money put in comes back. Code figures only. */
function YearScenariosCard({ candidate, className }: { candidate: CandidateDTO; className?: string }) {
  const y = yearScenarios(candidate)
  if (!y) return null
  const intro = (
    <>
      What a bad year and a good year mean for you:{" "}
      {y.bad.total && y.bad.source ? (
        <>
          leaving after 12 months costs {y.bad.complete ? "" : "at least "}
          <span className="tnum font-semibold">{y.bad.total}</span>
          <SourceLabel source={y.bad.source} />
        </>
      ) : (
        "the cost of leaving early needs the lease terms"
      )}
      {y.good.payback && y.good.paybackSource ? (
        <>
          , and at your plan the money you put in comes back in <span className="tnum font-semibold">{y.good.payback.toLowerCase()}</span>
          <SourceLabel source={y.good.paybackSource} />.
        </>
      ) : (
        ", and the payback needs your gross margin."
      )}
    </>
  )
  return (
    <ReportCard id="years" title="Bad year / good year" intro={intro} className={className}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] bg-white/60 p-4">
          <p className="text-xs font-medium text-ink-2">If the business does not work out</p>
          <p className="tnum mt-1 text-xl font-semibold text-ink">
            {y.bad.total ? (
              <>
                {y.bad.complete ? "" : "At least "}
                {y.bad.total}
                {y.bad.source && <SourceLabel source={y.bad.source} />}
              </>
            ) : (
              <span className="text-sm font-normal text-ink-3 italic">missing data</span>
            )}
          </p>
          <p className="text-[13px] text-ink-2">to leave after 12 months</p>
          {y.bad.parts.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-[13px]">
              {y.bad.parts.map((part) => (
                <li key={part.label} className="flex justify-between gap-3">
                  <span className="text-ink-2">{part.label}</span>
                  <span className="tnum font-medium whitespace-nowrap text-ink">
                    {part.value}
                    <SourceLabel source={part.source} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-5 text-ink-2">{y.bad.note}</p>
        </div>
        <div className="rounded-[20px] bg-white/60 p-4">
          <p className="text-xs font-medium text-ink-2">If the business goes as planned</p>
          <p className="tnum mt-1 text-xl font-semibold text-ink">
            {y.good.payback ? (
              <>
                {y.good.payback}
                {y.good.paybackSource && <SourceLabel source={y.good.paybackSource} />}
              </>
            ) : (
              <span className="text-sm font-normal text-ink-3 italic">missing data</span>
            )}
          </p>
          <p className="text-[13px] text-ink-2">to earn back what you put in before opening</p>
          {y.good.breakEven && (
            <p className="mt-3 flex flex-col gap-0.5 text-[13px]">
              <span className="text-ink-2">Revenue needed just to cover the space</span>
              <span className="tnum font-medium whitespace-nowrap text-ink">
                {y.good.breakEven}
                {y.good.breakEvenSource && <SourceLabel source={y.good.breakEvenSource} />}
              </span>
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-ink-2">{y.good.note}</p>
        </div>
      </div>
    </ReportCard>
  )
}

function PointList({ items, empty, tone }: { items: PointItem[]; empty: string; tone: "plus" | "minus" }) {
  if (items.length === 0) return <p className="text-[13px] text-ink-3">{empty}</p>
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, index) => {
        const Icon = item.hard ? OctagonAlert : tone === "plus" ? Check : TriangleAlert
        return (
          <li key={index} className="flex gap-2.5 text-sm leading-5">
            <Icon size={16} className={cx("mt-0.5 shrink-0", item.hard ? "text-hard" : tone === "plus" ? "text-green-700" : "text-amber-800")} aria-hidden />
            <span className="max-w-[70ch]">
              <span className={item.hard ? "font-medium text-hard" : "text-ink"}>{item.text}</span>
              {item.source && <span className="block text-xs text-ink-2">Source: {item.source}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function StrengthsRisksCard({ candidate, className }: { candidate: CandidateDTO; className?: string }) {
  const { strengths, risks } = strengthsAndRisks(candidate)
  const hard = risks.filter((r) => r.hard).length
  const others = risks.length - hard
  const count = (n: number, one: string, many: string) => (n === 0 ? `no ${many}` : plural(n, one, many))
  const intro =
    hard > 0
      ? `The reasons behind the verdict: ${plural(hard, "deal breaker", "deal breakers")} stopped this space${others > 0 ? `, and ${plural(others, "other point", "other points")} would need a check` : ""}.`
      : `The reasons behind the score: ${count(strengths.length, "strength", "strengths")} and ${count(risks.length, "risk", "risks")}, each from a calculation, the listing or the lease.`
  return (
    <ReportCard id="strengths" title="Strengths and risks" intro={intro} className={className}>
      <h3 className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Strengths</h3>
      <PointList items={strengths} tone="plus" empty="No strengths found in the facts we have." />
      <h3 className="mt-5 mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Risks</h3>
      <PointList items={risks} tone="minus" empty="No risks found in the facts we have." />
    </ReportCard>
  )
}

function QuestionList({ questions }: { questions: string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-5 text-ink">
      {questions.map((question) => (
        <li key={question} className="max-w-[70ch]">
          {question}
        </li>
      ))}
    </ol>
  )
}

function LeaseCard({ candidate, className }: { candidate: CandidateDTO; className?: string }) {
  const lease = leaseSection(candidate)
  const flags = [
    ...(candidate.rejection && candidate.rejection.aspect === "lease" ? [candidate.rejection] : []),
    ...candidate.laterFlags.filter((f) => f.aspect === "lease"),
  ]
  const concerns = candidate.findings.filter((f) => f.aspect === "lease" && f.severity === "soft").length
  const meaning =
    flags.length > 0
      ? `${plural(flags.length, "clause is a deal breaker", "clauses are deal breakers")}`
      : concerns > 0
        ? `${plural(concerns, "point", "points")} to check before signing, no deal breaker`
        : "no deal breaker and nothing to check"
  const intro =
    lease.terms.length === 0
      ? "There is no lease draft yet, so nothing could be checked: these are the questions to ask the landlord before signing."
      : lease.fromForm
        ? `The terms the landlord typed in the listing form (no lease draft yet), checked with the same lease rules: ${meaning}.`
        : `What the lease draft says, clause by clause, checked by code against the lease rules: ${meaning}.`
  return (
    <ReportCard id="lease" title="Lease terms" intro={intro} className={className}>
      {lease.terms.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm leading-5 text-ink">
          {lease.terms.map((term) => (
            <li key={term.text} className="max-w-[70ch]">
              {term.text}
              <span className="block text-xs text-ink-2">Source: {term.source}</span>
            </li>
          ))}
        </ul>
      )}
      {lease.fromForm && <p className="mt-4 mb-2 text-[13px] leading-5 text-ink-2">Ask the landlord before signing:</p>}
      {(lease.fromForm || lease.terms.length === 0) && <QuestionList questions={lease.questions} />}
      <p className="mt-4 text-xs text-ink-3">Not a legal opinion. Check permitted use and every clause before signing.</p>
    </ReportCard>
  )
}

function LocationCard({ candidate, className }: { candidate: CandidateDTO; className?: string }) {
  const loc = locationSection(candidate)
  const intro = loc.checked
    ? "What is mapped in OpenStreetMap within 300 m of the address: it describes the area around the space, it does not measure foot traffic or revenue."
    : "The area around the space: not checked, because there is no OpenStreetMap area data for this address in this run."
  return (
    <ReportCard id="location" title="Location" intro={intro} className={className}>
      {loc.checked && (
        <>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">
            {loc.rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-ink">{r.label}</dt>
                <dd className="tnum text-right font-semibold whitespace-nowrap text-ink">
                  {r.count}
                  <SourceLabel source={r.source} />
                </dd>
              </div>
            ))}
          </dl>
          {loc.zone && <p className="mt-3 text-[13px] leading-5 text-ink-2">{loc.zone}</p>}
          {loc.explanation && <p className="mt-4 max-w-[70ch] text-sm leading-6 text-ink">{loc.explanation}</p>}
          <p className="mt-3 text-xs text-ink-2">Data © OpenStreetMap contributors, ODbL.</p>
        </>
      )}
    </ReportCard>
  )
}

function PremisesCard({ candidate, className }: { candidate: CandidateDTO; className?: string }) {
  const premises = premisesSection(candidate)
  if (!premises.read) {
    return (
      <ReportCard
        id="space"
        title="The space"
        intro={
          candidate.status === "rejected"
            ? "The space itself: not read, because a deal breaker stopped the Premises inspector first."
            : "The space itself: the Premises inspector has not read this listing."
        }
        className={className}
      >
        {null}
      </ReportCard>
    )
  }
  const ok = premises.checks.filter((c) => c.ok).length
  const intro =
    premises.checks.length === 0
      ? "What the listing says about the space itself: nothing that matters for your type of business is stated."
      : `What the listing and the lease say about the space itself, judged by code for your type of business: ${ok} of ${plural(premises.checks.length, "point suits", "points suit")} it${premises.checks.length > ok ? ", the rest need a check before signing" : ""}.`
  return (
    <ReportCard id="space" title="The space" intro={intro} className={className}>
      {premises.checks.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {premises.checks.map((check) => {
            const Icon = check.ok ? Check : TriangleAlert
            return (
              <li key={check.text} className="flex gap-2.5 text-sm leading-5">
                <Icon size={16} className={cx("mt-0.5 shrink-0", check.ok ? "text-green-700" : "text-amber-800")} aria-hidden />
                <span className="max-w-[70ch]">
                  <span className="text-ink">{check.text}</span>
                  {check.checkBeforeSigning && <span className="block text-[13px] text-ink">Check before signing: {check.checkBeforeSigning}</span>}
                  <span className="block text-xs text-ink-2">Source: {check.source}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {premises.heating && (
        <p className="mt-3 text-sm leading-5 text-ink">
          {premises.heating.text}
          <span className="block text-xs text-ink-2">Source: {premises.heating.source}</span>
        </p>
      )}
      {premises.notStated.length > 0 && (
        <p className="mt-4 max-w-[70ch] text-[13px] leading-5 text-ink-2">
          Not stated, so unknown in the score: {premises.notStated.join(", ").toLowerCase()}. Ask the landlord.
        </p>
      )}
    </ReportCard>
  )
}

function UnknownsCard({ candidate, className }: { candidate: CandidateDTO; className?: string }) {
  const { items, totalPoints } = unknowns(candidate)
  const r = candidate.ranking
  const intro = r
    ? totalPoints > 0
      ? `What the listing and the lease do not say: these unknowns could add up to ${totalPoints} points, so the score is ${r.score} in the worst case and ${r.scoreHigh} at best.`
      : "What the listing and the lease do not say: nothing in the score is unknown."
    : "What the listing and the lease do not say, as far as this run got."
  return (
    <ReportCard id="unknown" title="What is unknown" intro={intro} className={className}>
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-3">No other unknowns.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.text} className="flex items-baseline justify-between gap-4 text-sm leading-5">
              <span className="max-w-[70ch] text-ink">{item.text}</span>
              <span className="tnum shrink-0 text-xs text-ink-2">{item.points > 0 ? `up to ${item.points} points` : "not in the score"}</span>
            </li>
          ))}
        </ul>
      )}
    </ReportCard>
  )
}

/** Every source, collapsed by default and grouped by where it comes from (form, lease draft, questionnaire, calculation). */
function SourcesCard({ candidate }: { candidate: CandidateDTO }) {
  const groups = allSources(candidate)
  const count = groups.reduce((n, g) => n + g.items.length, 0)
  return (
    <section className="glass rounded-[28px] p-6">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base leading-6 font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span>
            Sources <span className="tnum font-normal text-ink-2">({count})</span>
          </span>
          <span className="text-[13px] font-medium text-ink-2 group-open:hidden">Show</span>
          <span className="hidden text-[13px] font-medium text-ink-2 group-open:inline">Hide</span>
        </summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
                {group.title} <span className="tnum font-normal text-ink-2">({group.items.length})</span>
              </h3>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <li key={item} className="max-w-[70ch] text-[13px] leading-5 break-words text-ink-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}
