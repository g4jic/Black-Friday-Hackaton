import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { GROUPS, groupOf, leaseNote, runningLoops, type Group, type ResearchState } from "./research-state"
import type { CandidateDTO, FieldDTO, FindingDTO } from "./types"
import { AgentChip, CountCircle, Pill, SourceLabel, Sourced, cx, formatMoney } from "./ui"

const GROUP_TONE: Record<Group, "ink3" | "purple" | "amber" | "red"> = {
  Pending: "ink3",
  Evaluating: "purple",
  "Check before signing": "amber",
  Scored: "purple",
  Rejected: "red",
}

const finding = (c: CandidateDTO, name: string): FindingDTO | undefined => c.findings.find((f) => f.id === `${c.id}:finance:${name}`)
const asField = (f: FindingDTO | undefined): FieldDTO | undefined => (f && f.value ? { value: f.value, source: f.source } : undefined)
const text = (f: FieldDTO | undefined) => (f?.value.kind === "text" ? f.value.value : null)

function LeaseNotePill({ claim }: { claim: string | undefined }) {
  const note = claim ? leaseNote(claim) : null
  if (!note) return null
  return note === "no lease draft" ? (
    <span className="text-xs text-ink-3" title="No lease draft: the term comes from the questionnaire">
      term from questionnaire
    </span>
  ) : (
    <Pill variant="soft" title="These figures do not use verified lease terms: the term comes from the questionnaire">
      {note}
    </Pill>
  )
}

export function CandidateName({ c }: { c: CandidateDTO }) {
  const area = c.fields.area?.value
  const details = [area?.kind === "area" ? `${area.m2} m²` : null, text(c.fields.floor), text(c.fields.address)].filter(Boolean)
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium text-ink" title={text(c.fields.title) ?? c.id}>
        {text(c.fields.title) ?? c.id}
      </div>
      <div className="truncate text-[13px] text-ink-2">
        <span className="text-ink-3">{c.id}</span>
        {details.length > 0 && <span> · {details.join(" · ")}</span>}
      </div>
    </div>
  )
}

export function MonthlyCost({ c }: { c: CandidateDTO }) {
  const computed = asField(finding(c, "monthly_cost"))
  if (computed) return <Sourced field={computed} />
  const rent = c.fields.rentMonthly
  if (rent?.value.kind === "missing") return <Sourced field={rent} />
  return (
    <span className="whitespace-nowrap">
      <Sourced field={rent} /> <span className="text-xs text-ink-3">rent</span>
    </span>
  )
}

export function RentShare({ c }: { c: CandidateDTO }) {
  const f = finding(c, "cost_share_of_revenue")
  if (!f || f.value?.kind !== "number") return <span className="text-ink-3">-</span>
  const pct = Math.round(f.value.value * 1000) / 10
  return <Sourced field={{ value: f.value, source: f.source }} render={() => <span className="tnum">{pct}%</span>} />
}

export function ExitCost({ c }: { c: CandidateDTO }) {
  const f = finding(c, "exit_cost_after_12_months")
  if (!f) return <span className="text-ink-3">-</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Sourced field={asField(f)} />
      <LeaseNotePill claim={f.claim} />
    </span>
  )
}

export function Flags({ c, max = 2 }: { c: CandidateDTO; max?: number }) {
  const pills: JSX.Element[] = []
  if (c.rejection) pills.push(<Pill key="hard" variant="hard" title={c.rejection.reason}>Hard flag: {c.rejection.rule.replaceAll("_", " ")}</Pill>)
  for (const f of c.findings.filter((x) => x.severity === "soft")) {
    pills.push(
      <Pill key={f.id} variant="soft" title={`Check before signing: ${f.checkBeforeSigning ?? f.claim}`}>
        {f.claim}
      </Pill>,
    )
  }
  for (const u of c.unverified) pills.push(<Pill key={`u-${u.field}`} variant="soft" title={u.reason}>{u.field} unverified</Pill>)
  const total = finding(c, "total_cost_over_term")
  const note = total ? leaseNote(total.claim) : null
  if (note?.startsWith("lease")) pills.push(<Pill key="lease" variant="soft" title={total!.claim}>lease not verified</Pill>)
  if (note === "no lease draft") {
    pills.push(
      <Pill key="no-lease" variant="soft" title="Check before signing: no lease draft was given, so the term, notice and deposit are unknown; term-level figures use the questionnaire's 36 months">
        no lease draft: terms unknown
      </Pill>,
    )
  }
  if (c.fields.rentMonthly?.value.kind === "missing") pills.push(<Pill key="no-rent" icon={false}>no rent stated</Pill>)
  if (c.fields.area?.value.kind === "missing") pills.push(<Pill key="no-area" icon={false}>no area stated</Pill>)
  if (pills.length === 0) return <span className="text-ink-3">-</span>
  return (
    <div className="flex max-w-[280px] flex-wrap gap-1.5">
      {pills.slice(0, max)}
      {pills.length > max && <Pill icon={false} title={`${pills.length - max} more`}>+{pills.length - max}</Pill>}
    </div>
  )
}

export function Agents({ s, c }: { s: ResearchState; c: CandidateDTO }) {
  const running = runningLoops(s, c.id)
  if (running.length === 0) return <span className="text-ink-3">-</span>
  return (
    <div className="flex -space-x-2">
      {running.map((l) => (
        <AgentChip key={l.key} name={l.agent} state="busy" />
      ))}
    </div>
  )
}

const CONFIDENCE_PILL = { high: "positive", medium: "neutral", low: "soft" } as const

/** Rank, score and confidence from the Ranker (plain code). Before ranking: "not scored yet". */
function Score({ c, group }: { c: CandidateDTO; group: Group }) {
  const r = c.ranking
  if (!r) {
    if (group === "Scored" || group === "Check before signing") return <span className="text-[13px] whitespace-nowrap text-ink-3">not scored yet</span>
    return <span className="text-ink-3">-</span>
  }
  const title = r.components.map((x) => `${x.name} (weight ${x.weight}): ${x.value === null ? `unknown, 0 to ${x.weight} points` : x.value}`).join("\n")
  const range = r.scoreHigh > r.score
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 whitespace-nowrap" title={`Score parts:\n${title}${range ? "\nThe rank uses the low end (unknown parts count as worst case)." : ""}`}>
      <span className="tnum inline-flex h-6 items-center rounded-full bg-ink px-2 text-xs font-semibold text-white">#{r.rank}</span>
      <span className="tnum text-sm font-semibold">{range ? `${r.score}-${r.scoreHigh}` : r.score}</span>
      <Pill variant={CONFIDENCE_PILL[r.confidence]} icon={false} title="Confidence: how much of the input data is known">
        {r.confidence}
      </Pill>
    </span>
  )
}

/** The Ranker's 2 or 3 reasons, each with its source label. */
export function Reasons({ c }: { c: CandidateDTO }) {
  if (!c.ranking) return null
  const mark = { plus: "text-green-700", minus: "text-red-700", confidence: "text-amber-800", order: "text-amber-800" } as const
  const sign = { plus: "+", minus: "-", confidence: "?", order: "!" } as const
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
      {c.ranking.reasons.map((r) => (
        <li key={r.text} className="inline-flex items-center gap-1.5">
          <span className={cx("tnum w-3 text-center font-semibold", mark[r.effect])} aria-hidden>
            {sign[r.effect]}
          </span>
          {r.text}
          <SourceLabel source={r.source} />
        </li>
      ))}
    </ul>
  )
}

const byRank = (a: CandidateDTO, b: CandidateDTO) => (a.ranking?.rank ?? 1e9) - (b.ranking?.rank ?? 1e9)

/** The key moment of the demo: why the candidate was rejected, from which source, and which loops were cut. */
export function RejectionDetail({ s, c }: { s: ResearchState; c: CandidateDTO }) {
  if (!c.rejection) return null
  const rej = s.rejections[c.id]
  const cut = Object.values(s.loops).filter((l) => l.candidateId === c.id && l.cancelledAt !== undefined)
  const lastCut = cut.length ? Math.max(...cut.map((l) => l.cancelledAt!)) : null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-2">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Pill variant="hard" title={c.rejection.reason}>
          {c.rejection.reason}
        </Pill>
        <SourceLabel source={c.rejection.source} />
        <span>by {c.rejection.raisedBy}</span>
      </span>
      {c.laterFlags.length > 0 && <span>also: {c.laterFlags.map((f) => f.reason).join("; ")}</span>}
      {cut.length > 0 ? (
        <span className="inline-flex items-center gap-2">
          {cut.map((l) => (
            <AgentChip key={l.key} name={l.agent} state="cancelled" size={28} />
          ))}
          <span>
            cancelled: {cut.map((l) => `${l.agent} after ${((l.cancelledAt! - l.start) / 1000).toFixed(1)} s of work (${l.cancelWhere})`).join(", ")}
            {rej && lastCut !== null && (
              <>
                {" "}
                · stopped {cut.length} loop{cut.length > 1 ? "s" : ""} <span className="tnum">{Math.max(0, lastCut - rej.at)} ms</span> after the flag
              </>
            )}
          </span>
        </span>
      ) : (
        <span>no other agent was running on it</span>
      )}
    </div>
  )
}

function SectionCard({ group, count, total, children }: { group: Group; count: number; total: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true) // every section starts open, Rejected included (DESIGN.md 7.3)
  return (
    <section className="surface rounded-[24px] px-6 pt-4 pb-5" aria-label={group}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${group}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/60"
        >
          <ChevronRight size={18} className={cx("transition-transform duration-200", open && "rotate-90")} />
        </button>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-lg leading-6 font-semibold shadow-[var(--shadow-soft)]">
          {group}
          <CountCircle n={count} tone={GROUP_TONE[group]} />
        </span>
        <span className="ml-auto text-[13px] text-ink-2">
          {count} of {total} candidates
        </span>
      </div>
      {open && <div className="mt-3">{children}</div>}
    </section>
  )
}

export type View = "cards" | "table"

export function CandidateSections({ s, view, filter }: { s: ResearchState; view: View; filter: string }) {
  const all = s.order.map((id) => s.candidates[id]!).filter(Boolean)
  const q = filter.trim().toLowerCase()
  const shown = q ? all.filter((c) => `${c.id} ${text(c.fields.title) ?? ""} ${text(c.fields.address) ?? ""}`.toLowerCase().includes(q)) : all
  const byGroup = new Map<Group, CandidateDTO[]>(GROUPS.map((g) => [g, []]))
  for (const c of shown) byGroup.get(groupOf(s, c))!.push(c)
  for (const rows of byGroup.values()) rows.sort(byRank) // ranked candidates in rank order; the rest keep arrival order
  const waiting = s.submitted.length - all.length
  return (
    <div className="flex flex-col gap-3">
      {waiting > 0 && (
        <div className="surface flex items-center gap-3 rounded-[24px] px-6 py-4 text-sm text-ink-2">
          <AgentChip name="Scout" state="busy" />
          The Scout is reading {waiting} more listing{waiting > 1 ? "s" : ""}. Each one appears here as soon as it is read.
        </div>
      )}
      {GROUPS.filter((g) => byGroup.get(g)!.length > 0).map((g) => (
        <SectionCard key={g} group={g} count={byGroup.get(g)!.length} total={all.length}>
          {view === "table" ? <Table s={s} rows={byGroup.get(g)!} group={g} /> : <Cards s={s} rows={byGroup.get(g)!} group={g} />}
        </SectionCard>
      ))}
    </div>
  )
}

const TH = "px-4 pb-2 text-left text-xs font-medium text-ink-3"
const TD = "px-4 py-3 align-middle text-sm"

function Table({ s, rows, group }: { s: ResearchState; rows: CandidateDTO[]; group: Group }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] table-fixed border-collapse">
        {/* Same column widths in every section, so the numbers line up from one section to the next. */}
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[15%]" />
          <col className="w-[20%]" />
          <col className="w-[7%]" />
          <col className="w-[9%]" />
        </colgroup>
        <thead>
          <tr>
            <th className={TH}>Candidate</th>
            <th className={cx(TH, "text-right")}>Monthly cost</th>
            <th className={cx(TH, "text-right")}>Rent share of revenue</th>
            <th className={cx(TH, "text-right")}>Exit cost after 12 months</th>
            <th className={TH}>Flags</th>
            <th className={TH}>Agents</th>
            <th className={TH}>Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <RowGroup key={c.id} s={s} c={c} group={group} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowGroup({ s, c, group }: { s: ResearchState; c: CandidateDTO; group: Group }) {
  const rejected = group === "Rejected"
  return (
    <>
      <tr className={cx("h-[52px] transition-colors hover:bg-white/50", rejected && "bg-red-50/70")}>
        <td className={TD}>
          <CandidateName c={c} />
        </td>
        <td className={cx(TD, "text-right")}>
          <MonthlyCost c={c} />
        </td>
        <td className={cx(TD, "text-right")}>
          <RentShare c={c} />
        </td>
        <td className={cx(TD, "text-right")}>
          <ExitCost c={c} />
        </td>
        <td className={TD}>
          <Flags c={c} />
        </td>
        <td className={TD}>
          <Agents s={s} c={c} />
        </td>
        <td className={TD}>{rejected ? <Pill variant="solid-hard" icon={false}>Rejected</Pill> : <Score c={c} group={group} />}</td>
      </tr>
      {c.ranking && (
        <tr>
          <td colSpan={7} className="px-4 pb-3">
            <Reasons c={c} />
          </td>
        </tr>
      )}
      {rejected && (
        <tr className="bg-red-50/70">
          <td colSpan={7} className="px-4 pb-3">
            <RejectionDetail s={s} c={c} />
          </td>
        </tr>
      )}
    </>
  )
}

function Cards({ s, rows, group }: { s: ResearchState; rows: CandidateDTO[]; group: Group }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
      {rows.map((c) => (
        <article key={c.id} className={cx("rounded-[20px] bg-white/80 p-5", group === "Rejected" && "ring-1 ring-red-600/20")}>
          <div className="flex items-start justify-between gap-3">
            <CandidateName c={c} />
            <Agents s={s} c={c} />
          </div>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-2">Monthly cost</dt>
            <dd className="text-right">
              <MonthlyCost c={c} />
            </dd>
            <dt className="text-ink-2">Rent share</dt>
            <dd className="text-right">
              <RentShare c={c} />
            </dd>
            <dt className="text-ink-2">Exit after 12 months</dt>
            <dd className="text-right">
              <ExitCost c={c} />
            </dd>
          </dl>
          <div className="mt-4">{group === "Rejected" ? <RejectionDetail s={s} c={c} /> : <Flags c={c} max={3} />}</div>
          <div className="mt-3 flex justify-end">
            <Score c={c} group={group} />
          </div>
          {c.ranking && (
            <div className="mt-3 border-t border-line pt-3">
              <Reasons c={c} />
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

export function MetricsStrip({ s }: { s: ResearchState }) {
  const m = s.metrics
  if (!m) return null
  const items = [
    `done in ${(m.durationMs / 1000).toFixed(1)} s`,
    `${m.loops} loops`,
    `peak ${m.peakParallel} in parallel`,
    `${m.toolCalls} calculator calls`,
    `${m.rejected} rejected`,
    `${m.loopsCancelled} loop${m.loopsCancelled === 1 ? "" : "s"} cancelled`,
    `${m.softFlags} soft flag${m.softFlags === 1 ? "" : "s"}`,
    ...(m.costUsd !== null ? [`${m.tokens.input + m.tokens.output} tokens`, `$${m.costUsd.toFixed(4)}`] : ["keyless, $0"]),
  ]
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Run metrics, computed from runtime events">
      {items.map((t) => (
        <Pill key={t} icon={false}>
          {t}
        </Pill>
      ))}
    </div>
  )
}

export const money = formatMoney
