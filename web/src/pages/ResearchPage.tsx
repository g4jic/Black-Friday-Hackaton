import { ChartLine, FileChartColumn, LayoutGrid, List, type LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useResearch, type RunSnapshot } from "../app/research-store"
import { Link, paths, setSearchParam, useLocation } from "../app/router"
import { EmptyState } from "../app/Shell"
import { CandidateSections, MetricsStrip } from "../LiveResearch"
import { ReportsScreen } from "../Reports"
import { Timeline } from "../Timeline"
import { cx } from "../ui"

export type ResearchTab = "table" | "cards" | "timeline" | "report"
const TABS: { id: ResearchTab; label: string; icon: LucideIcon }[] = [
  { id: "table", label: "Table", icon: List },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "report", label: "Report", icon: FileChartColumn },
  { id: "timeline", label: "Timeline", icon: ChartLine },
]

/** Event time "now" for the Timeline while a run is live (browser clock aligned to the first event). */
export function useRunClock(snapshot: RunSnapshot): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (snapshot.state.done || snapshot.clientStartMs === null) return
    const start = snapshot.clientStartMs
    const timer = setInterval(() => setNow(Date.now() - start), 100)
    return () => clearInterval(timer)
  }, [snapshot.state.done, snapshot.clientStartMs])
  return now
}

export function ResearchMissing() {
  return (
    <EmptyState
      text="This research is not available any more: the server was restarted and the run was not kept in this tab's history."
      action={
        <Link to={paths.history()} className="inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]">
          Open history
        </Link>
      }
    />
  )
}

/** The candidates of one run as Table, Cards, Report or Timeline. */
export function ResearchPage({ researchId }: { researchId: string }) {
  const snapshot = useResearch(researchId)
  const { search } = useLocation()
  const tab = (TABS.some((t) => t.id === search.get("tab")) ? search.get("tab") : "table") as ResearchTab
  const now = useRunClock(snapshot)
  if (snapshot.status === "missing") return <ResearchMissing />
  const { state } = snapshot
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ResearchTabs tab={tab} />
      </div>
      {tab === "timeline" ? (
        <div className="flex flex-col gap-4">
          <Timeline s={state} now={now} />
          <MetricsStrip s={state} />
        </div>
      ) : tab === "report" ? (
        <ReportsScreen s={state} />
      ) : (
        <CandidateSections s={state} view={tab} filter="" />
      )}
    </>
  )
}

export function ResearchTabs({ tab, tabs = TABS }: { tab: ResearchTab; tabs?: typeof TABS }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={tab === id}
          onClick={() => setSearchParam("tab", id)}
          className={cx("inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-200", tab === id ? "bg-brand text-ink" : "glass-strong text-ink hover:bg-white")}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden /> {label}
        </button>
      ))}
    </div>
  )
}
