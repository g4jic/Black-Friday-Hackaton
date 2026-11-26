import { ChevronRight, OctagonAlert } from "lucide-react"
import { historyStore, type HistoryRecord } from "../app/history-store"
import { currentUser } from "../app/identity"
import { Link, paths } from "../app/router"
import { EmptyState } from "../app/Shell"
import { Pill } from "../ui"

const formatTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

export const useHistory = (): HistoryRecord[] => historyStore.list(currentUser().id)

/** One past run as a row that opens its results (or, with tab, one tab of them). */
export function RunRow({ record, tab }: { record: HistoryRecord; tab?: "report" }) {
  const { summary } = record
  return (
    <li>
      <Link
        to={paths.results(record.id, tab)}
        className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[20px] glass-strong px-5 py-4 hover:bg-white"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">
            {summary.topCandidateId ? `Top: ${summary.topCandidateTitle ?? summary.topCandidateId}` : record.cancelled ? "Stopped before a ranking" : "No candidate could be ranked"}
          </div>
          <div className="text-[13px] text-ink-2">
            <span className="tnum">{formatTime(record.finishedAt)}</span> · {summary.candidates} candidates
            {summary.rejected > 0 && (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1 text-hard">
                  <OctagonAlert size={12} aria-hidden /> {summary.rejected} rejected
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {record.synthetic && (
            <Pill variant="brand" icon={false}>
              Demo data
            </Pill>
          )}
          {record.mode === "live" && <Pill icon={false}>Live model</Pill>}
          {record.cancelled && <Pill variant="soft">Stopped</Pill>}
          {tab === "report" && record.state.report && (
            <Pill icon={false}>
              {record.state.report.audit.checked} claims checked
            </Pill>
          )}
        </div>
        <ChevronRight size={18} className="text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  )
}

export function HistoryPage() {
  const records = useHistory()
  if (records.length === 0) {
    return (
      <EmptyState
        text="No research runs yet in this tab. Guest runs are kept until the tab is closed."
        action={
          <Link to={paths.newResearch()} className="inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]">
            Start a research
          </Link>
        }
      />
    )
  }
  return (
    <section className="glass rounded-[28px] p-6">
      <p className="mb-4 text-[13px] text-ink-2">Guest runs are kept until this tab is closed. Newest first.</p>
      <ul className="flex flex-col gap-2.5">
        {records.map((record) => (
          <RunRow key={record.id} record={record} />
        ))}
      </ul>
    </section>
  )
}
