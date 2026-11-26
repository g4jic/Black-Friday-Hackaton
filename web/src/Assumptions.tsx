import { useEffect, useState } from "react"
import { Pill } from "./ui"

type Assumptions = {
  ranking: {
    weights: Record<string, number>
    cost: { description: string; fullScoreAtOrBelow: number; zeroScoreAt: number }
    area: { description: string; insideMin: number }
    lease: {
      description: string
      earlyExit: { allowed: number; notAllowed: number }
      noticeMonths: { upTo: number | null; score: number }[]
      indexation: Record<string, number>
    }
    checks: { description: string; penaltyEach: number; notCountedTwice: string[] }
    missingData: string
    missingDataDetail: string
    confidence: Record<string, string>
    order: string[]
  }
  hardFlags: { budgetTolerance: number; maxTermWithoutExitMonths: number }
  verdict: { good: string; checkBeforeSigning: string; notRecommended: string }
  leaseConcerns: { maxNoticeMonths: number; maxFixedIndexationPercent: number }
  demoQuestionnaire: { business: string; areaM2: [number, number]; monthlyBudget: number; expectedMonthlyRevenue: number; leaseMonths: number; currency: string; grossMarginRate: number | null }
}

const pct = (x: number) => `${Math.round(x * 100)}%`

/** "SuiteSpot assumptions": the rules the code uses, read from the server (the same constants the code runs on). */
export function AssumptionsScreen() {
  const [a, setA] = useState<Assumptions | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/assumptions")
      .then((r) => r.json() as Promise<Assumptions>)
      .then(setA)
      .catch((e: unknown) => setError(String(e)))
  }, [])
  if (error) return <Card title="Assumptions">Could not load the assumptions: {error}</Card>
  if (!a) return <Card title="Assumptions">Loading...</Card>
  const r = a.ranking
  const q = a.demoQuestionnaire
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="How the Ranker scores (plain code, no AI)">
        <p className="mb-3">These are SuiteSpot's choices, not facts. The score is out of 100:</p>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(r.weights).map(([k, w]) => (
              <tr key={k} className="border-b border-line last:border-0">
                <td className="py-2 pr-4 font-medium text-ink">{({ cost: "Cost", area: "Area", lease: "Lease terms", checks: "Points to check" } as Record<string, string>)[k] ?? k}</td>
                <td className="tnum py-2 pr-4 text-right">{w}</td>
                <td className="py-2 text-ink-2">
                  {k === "cost" && `${r.cost.description}: full score at ${pct(r.cost.fullScoreAtOrBelow)} or less, 0 at ${pct(r.cost.zeroScoreAt)}.`}
                  {k === "area" && `${r.area.description}.`}
                  {k === "lease" && `${r.lease.description}: early exit ${r.lease.earlyExit.allowed} / ${r.lease.earlyExit.notAllowed}; notice ${r.lease.noticeMonths.map((b) => `${b.upTo === null ? "more" : `up to ${b.upTo} months`} ${b.score}`).join(", ")}; indexation by index ${r.lease.indexation.cpi}, fixed up to 3% ${r.lease.indexation.fixedUpTo3}, up to 5% ${r.lease.indexation.fixedUpTo5}, above ${r.lease.indexation.fixedAbove5}.`}
                  {k === "checks" && `${r.checks.description} (notice and indexation are scored under lease terms, not counted twice).`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Missing data, confidence and order">
        <p className="font-medium text-ink">{r.missingData}</p>
        <p className="mt-1">{r.missingDataDetail}</p>
        <ul className="mt-3 space-y-1.5">
          {Object.entries(r.confidence).map(([k, v]) => (
            <li key={k} className="flex items-start gap-2">
              <Pill variant={k === "high" ? "positive" : k === "low" ? "soft" : "neutral"} icon={false}>
                {k}
              </Pill>
              <span>{v}</span>
            </li>
          ))}
        </ul>
        <ol className="mt-4 list-decimal space-y-1 pl-5">
          {r.order.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>
      </Card>
      <Card title="Deal breakers and checks (decided by code)">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Hard flag: monthly cost more than {pct(a.hardFlags.budgetTolerance)} over the budget.</li>
          <li>Hard flag: the tenant cannot end the lease early and the term is longer than {a.hardFlags.maxTermWithoutExitMonths} months.</li>
          <li>Hard flag: the landlord may raise the rent at will.</li>
          <li>Check before signing: notice longer than {a.leaseConcerns.maxNoticeMonths} months, a fixed rent increase above {a.leaseConcerns.maxFixedIndexationPercent}% a year, a personal guarantee, the tenant paying structural repairs, an early exit penalty, an unverified clause.</li>
          <li>A hard flag cancels the candidate: it is never ranked.</li>
        </ul>
      </Card>
      <Card title="Verdict on the Decision card (plain code)">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>{a.verdict.good}.</li>
          <li>{a.verdict.checkBeforeSigning}.</li>
          <li>{a.verdict.notRecommended}.</li>
        </ul>
      </Card>
      <Card title="Demo questionnaire (synthetic)">
        <ul className="space-y-1.5">
          <li>{q.business}</li>
          <li>
            Area {q.areaM2[0]}-{q.areaM2[1]} m², budget {q.monthlyBudget} {q.currency} a month, expected revenue {q.expectedMonthlyRevenue} {q.currency} a month
          </li>
          <li>Lease length {q.leaseMonths} months (used when no verified lease term is known)</li>
          <li>Gross margin: {q.grossMarginRate === null ? "not given (break-even and payback show missing data)" : pct(q.grossMarginRate)}</li>
        </ul>
      </Card>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-[28px] p-6 text-sm leading-5 text-ink-2">
      <h2 className="mb-4 inline-flex title-pill rounded-full glass-strong px-3.5 py-1.5 text-lg leading-6 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}
