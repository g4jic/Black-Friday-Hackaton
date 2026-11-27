import { ArrowLeft, Check, ExternalLink, OctagonAlert, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { useResearch } from "../app/research-store"
import { Link, paths } from "../app/router"
import { EmptyState } from "../app/Shell"
import { candidateLocation, candidateShortName } from "../candidate-label"
import { ResearchMissing } from "../pages/ResearchPage"
import type { CandidateDTO } from "../types"
import { SourceLabel, cx, formatMoney } from "../ui"
import { allSources, costRows, leaseSection, locationSection, premisesSection, resultsList, strengthsAndRisks, unknowns, yearScenarios, type PointItem } from "./results-model"
import { ScoreBlock, VerdictBadge } from "./ResultsList"

/** One candidate (/research/:id/candidate/:candidateId): separate cards with clear headings, nothing overlapping. */
export function CandidatePage({ researchId, candidateId }: { researchId: string; candidateId: string }) {
  const snapshot = useResearch(researchId)
  if (snapshot.status === "missing") return <ResearchMissing />
  const { state } = snapshot
  const candidate = state.candidates[candidateId]
  const back = (
    <Link to={paths.results(researchId)} className="inline-flex h-9 w-fit items-center gap-2 rounded-full glass-strong px-4 text-sm font-medium text-ink hover:bg-white">
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
      <Header candidate={candidate} listingNumber={entry?.listingNumber ?? 1} position={position >= 0 ? position + 1 : null} entry={entry} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CostsCard candidate={candidate} />
        <YearScenariosCard candidate={candidate} />
        <LeaseOrBuyCard candidate={candidate} />
        <StrengthsRisksCard candidate={candidate} />
        <LeaseCard candidate={candidate} />
        <LocationCard candidate={candidate} />
        <PremisesCard candidate={candidate} />
        <UnknownsCard candidate={candidate} />
      </div>
      <SourcesCard candidate={candidate} />
    </div>
  )
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("glass rounded-[28px] p-6", className)}>
      <h2 className="mb-4 text-base leading-6 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

const textField = (c: CandidateDTO, key: string) => {
  const v = c.fields[key]?.value
  return v?.kind === "text" ? v.value : null
}

function Header({ candidate, listingNumber, position, entry }: { candidate: CandidateDTO; listingNumber: number; position: number | null; entry: ReturnType<typeof resultsList>["ranked"][number] | undefined }) {
  const area = candidate.fields.area?.value
  const facts = [
    { label: "Location", value: candidateLocation(candidate) },
    { label: "Area", value: area?.kind === "area" ? `${area.m2} m2` : null },
    { label: "Floor", value: textField(candidate, "floor") },
    { label: "Monthly cost", value: entry?.monthlyCost ?? null },
  ]
  return (
    <section className="glass rounded-[28px] p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            {position !== null && <span className="tnum flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{position}</span>}
            <h2 className="text-2xl leading-8 font-semibold text-ink">{candidateShortName(candidate, listingNumber)}</h2>
            {entry && <VerdictBadge verdict={entry.verdict} />}
          </div>
          {textField(candidate, "title") && <p className="mt-2 max-w-[70ch] text-[13px] leading-5 text-ink-2">Listing title: {textField(candidate, "title")}</p>}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs text-ink-2">{fact.label}</dt>
                <dd className="tnum text-sm font-semibold text-ink">{fact.value ?? <span className="font-normal text-ink-3">Not stated</span>}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start">
          <ScoreBlock score={entry?.score ?? null} confidence={entry?.confidence ?? null} note={entry?.scoreRangeNote ?? null} />
          <ListingLink candidate={candidate} />
        </div>
      </div>
      {entry && <p className="mt-5 max-w-[70ch] text-sm leading-6 text-ink-2">{entry.candidate.ranking?.verdict.why ?? entry.mainReason}.</p>}
    </section>
  )
}

/** A real link only when a URL was really given; nothing is ever built or guessed. */
function ListingLink({ candidate }: { candidate: CandidateDTO }) {
  if (candidate.listingUrl) {
    return (
      <a href={candidate.listingUrl.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]">
        Open listing <ExternalLink size={15} aria-hidden />
      </a>
    )
  }
  if (candidate.synthetic) return null
  return <span className="text-[13px] text-ink-3">No listing URL was given</span>
}

function CostsCard({ candidate }: { candidate: CandidateDTO }) {
  return (
    <Section title="Costs">
      <dl className="flex flex-col divide-y divide-line">
        {costRows(candidate).map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-3 first:pt-0 last:pb-0">
            <dt className="text-sm text-ink">{row.label}</dt>
            <dd className="tnum text-right text-sm font-semibold text-ink">{row.value ?? <span className="font-normal text-ink-3">Unknown</span>}</dd>
            <dd className="col-span-2 text-xs leading-5 text-ink-2">
              {[row.source && `Source: ${row.source}`, row.note].filter(Boolean).join(". ")}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

const money = (m: { amount: number; currency: string }) => formatMoney(m.amount, m.currency)

/** Lease or buy a similar space: code with labelled public-source assumptions (How it works lists them). */
function LeaseOrBuyCard({ candidate }: { candidate: CandidateDTO }) {
  const r = candidate.leaseOrBuy
  if (!r) return null
  if (!r.known) {
    return (
      <Section title="Lease or buy">
        <p className="text-[13px] text-ink-3">Not compared: {r.missing.join(", ")} not known.</p>
      </Section>
    )
  }
  const rows = [
    { label: `Rent over ${r.years} years`, value: r.leaseCost },
    { label: `Buying, net over ${r.years} years`, value: r.buyCost },
    { label: "Price of a similar space", value: r.price },
    { label: "Cash needed to buy (down payment, tax and fees)", value: r.upFront },
    { label: "Loan payment per month", value: r.monthlyLoanPayment },
  ]
  return (
    <Section title="Lease or buy" className="lg:col-span-2">
      <p className="max-w-[70ch] text-sm leading-6 font-semibold text-ink">
        {r.cheaper === "lease" ? "Leasing" : "Buying a similar space"} costs about {money(r.difference)} less over {r.years} years
        <SourceLabel source={r.difference.source} />
        {r.cheaper === "buy" && <span className="font-normal text-ink-2">, but needs {money(r.upFront)} in cash before you start.</span>}
      </p>
      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3 border-b border-line py-1.5">
            <dt className="text-ink-2">{row.label}</dt>
            <dd className="tnum font-semibold text-ink">
              {money(row.value)}
              <SourceLabel source={row.value.source} />
            </dd>
          </div>
        ))}
      </dl>
      {r.notes.map((n) => (
        <p key={n} className="mt-3 text-xs leading-5 text-ink-2">{n}</p>
      ))}
      <p className="mt-3 text-xs leading-5 text-ink-3">
        Buying uses published average sale prices for this part of town, the average business loan rate and labelled SuiteSpot assumptions (see How it works). The net cost assumes the space keeps its price. A rough comparison, not a valuation. Not financial advice.
      </p>
    </Section>
  )
}

/** Bad year, good year: what leaving after 12 months costs, and when the money put in comes back. Code figures only. */
function YearScenariosCard({ candidate }: { candidate: CandidateDTO }) {
  const y = yearScenarios(candidate)
  if (!y) return null
  return (
    <Section title="A bad year, a good year" className="lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2">
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
                  <span className="tnum font-medium text-ink">{part.value}</span>
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
            <p className="mt-3 flex justify-between gap-3 text-[13px]">
              <span className="text-ink-2">Revenue needed just to cover the space</span>
              <span className="tnum font-medium text-ink">
                {y.good.breakEven}
                {y.good.breakEvenSource && <SourceLabel source={y.good.breakEvenSource} />}
              </span>
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-ink-2">{y.good.note}</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-3">Calculated by SuiteSpot from the listing and your questionnaire. Not financial advice.</p>
    </Section>
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

function StrengthsRisksCard({ candidate }: { candidate: CandidateDTO }) {
  const { strengths, risks } = strengthsAndRisks(candidate)
  return (
    <Section title="Strengths and risks">
      <h3 className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Strengths</h3>
      <PointList items={strengths} tone="plus" empty="No strengths found in the facts we have." />
      <h3 className="mt-5 mb-2 text-xs font-semibold tracking-[0.06em] text-ink-2 uppercase">Risks</h3>
      <PointList items={risks} tone="minus" empty="No risks found in the facts we have." />
    </Section>
  )
}

function LeaseCard({ candidate }: { candidate: CandidateDTO }) {
  const lease = leaseSection(candidate)
  return (
    <Section title="Lease terms">
      {lease.fromForm && <p className="mb-3 max-w-[70ch] text-[13px] leading-5 text-ink-2">No lease draft yet. These are the terms the landlord typed in the listing form; the same lease rules were checked on them.</p>}
      {lease.terms.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm leading-5 text-ink">
          {lease.terms.map((term) => (
            <li key={term.text} className="max-w-[70ch]">
              {term.text}
              <span className="block text-xs text-ink-2">Source: {term.source}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {lease.fromForm && (
        <>
          <p className="mt-4 mb-2 text-[13px] leading-5 text-ink-2">Ask the landlord before signing:</p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-5 text-ink">
            {lease.questions.map((question) => (
              <li key={question} className="max-w-[70ch]">
                {question}
              </li>
            ))}
          </ol>
        </>
      )}
      {lease.terms.length === 0 && (
        <>
          <p className="text-sm font-medium text-ink">No lease draft yet.</p>
          <p className="mt-1 mb-3 max-w-[70ch] text-[13px] leading-5 text-ink-2">Ask the landlord these questions before signing:</p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-5 text-ink">
            {lease.questions.map((question) => (
              <li key={question} className="max-w-[70ch]">
                {question}
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="mt-4 text-xs text-ink-3">Not a legal opinion. Check permitted use and every clause before signing.</p>
    </Section>
  )
}

function LocationCard({ candidate }: { candidate: CandidateDTO }) {
  const loc = locationSection(candidate)
  return (
    <Section title="Location">
      {loc.checked ? (
        <>
          <p className="mb-3 text-xs leading-5 text-ink-2">Mapped in OpenStreetMap within 300 m of the address. It does not measure foot traffic or revenue.</p>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">
            {loc.rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-ink">{r.label}</dt>
                <dd className="tnum text-right font-semibold text-ink">{r.count}</dd>
              </div>
            ))}
          </dl>
          {loc.zone && <p className="mt-3 text-[13px] leading-5 text-ink-2">{loc.zone}</p>}
          {loc.explanation && <p className="mt-4 max-w-[70ch] text-sm leading-6 text-ink">{loc.explanation}</p>}
          <p className="mt-3 text-xs text-ink-2">Source: OpenStreetMap. Data © OpenStreetMap contributors, ODbL.</p>
        </>
      ) : (
        <p className="text-[13px] text-ink-3">The location was not checked: there is no OpenStreetMap area data for this address in this run.</p>
      )}
    </Section>
  )
}

function PremisesCard({ candidate }: { candidate: CandidateDTO }) {
  const premises = premisesSection(candidate)
  if (!premises.read) {
    return (
      <Section title="The space">
        <p className="text-[13px] text-ink-3">{candidate.status === "rejected" ? "Not read: a hard flag stopped the Premises inspector." : "The Premises inspector has not read this listing."}</p>
      </Section>
    )
  }
  return (
    <Section title="The space">
      <p className="mb-3 text-xs leading-5 text-ink-2">What the listing and the lease draft state, each with its quote. Code decides what suits your type of business.</p>
      {premises.checks.length === 0 ? (
        <p className="text-[13px] text-ink-3">The listing states nothing that matters for your type of business.</p>
      ) : (
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
      {premises.notStated.length > 0 && <p className="mt-4 max-w-[70ch] text-[13px] leading-5 text-ink-2">Not stated, so unknown in the score: {premises.notStated.join(", ").toLowerCase()}. Ask the landlord.</p>}
    </Section>
  )
}

function UnknownsCard({ candidate }: { candidate: CandidateDTO }) {
  const { items, totalPoints } = unknowns(candidate)
  return (
    <Section title="What is unknown">
      {candidate.ranking && (
        <p className="mb-3 max-w-[70ch] text-sm leading-5 text-ink">
          {totalPoints > 0 ? `The unknowns below could add up to ${totalPoints} points: the score is ${candidate.ranking.score} in the worst case and ${candidate.ranking.scoreHigh} at best.` : "Nothing in the score is unknown."}
        </p>
      )}
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
    </Section>
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
