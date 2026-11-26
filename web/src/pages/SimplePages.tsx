import { ArrowRight, FileSearch, Search } from "lucide-react"
import { Link, paths } from "../app/router"
import { EmptyState } from "../app/Shell"
import { RunRow, useHistory } from "./HistoryPages"

/** Home: start a new research (two modes) or open a past one. */
export function DashboardPage() {
  const recent = useHistory().slice(0, 3)
  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-[28px] p-7">
        <h2 className="text-xl leading-7 font-semibold tracking-[-0.015em] text-ink">Is this lease a good financial decision for my business?</h2>
        <p className="mt-2 max-w-[720px] text-sm leading-5 text-ink-2">
          Agents read every listing and lease at the same time, code does the math, and every number points to its source.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <ModeCard
            to={`${paths.newResearch()}?mode=evaluate`}
            icon={FileSearch}
            title="Evaluate a space"
            text="Paste 1 to 8 listings you are considering, with an optional lease draft for each."
          />
          <ModeCard to={`${paths.newResearch()}?mode=find`} icon={Search} title="Find spaces" text="SuiteSpot brings the candidates. Runs on the synthetic demo listings for now." />
        </div>
      </section>
      <section className="glass rounded-[28px] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="inline-flex title-pill rounded-full glass-strong px-3.5 py-1.5 text-lg leading-6 font-semibold">Recent runs</h2>
          {recent.length > 0 && (
            <Link to={paths.history()} className="text-[13px] font-medium text-ink hover:underline">
              All history
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-2">No runs yet in this tab. Start one above; guest runs are kept until the tab is closed.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {recent.map((record) => (
              <RunRow key={record.id} record={record} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ModeCard({ to, icon: Icon, title, text }: { to: string; icon: typeof Search; title: string; text: string }) {
  return (
    <Link to={to} className="group flex items-start gap-4 rounded-[24px] glass-strong p-5 hover:bg-white">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-ink">
        <Icon size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-[13px] leading-5 text-ink-2">{text}</span>
      </span>
      <ArrowRight size={18} className="mt-3 text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

export function NotFoundPage({ path }: { path: string }) {
  return (
    <EmptyState
      text={`There is no page at ${path}.`}
      action={
        <Link to={paths.dashboard()} className="inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]">
          Go to Home
        </Link>
      }
    />
  )
}
