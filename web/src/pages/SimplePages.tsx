import { ArrowRight, FileSearch, Info, Search, X } from "lucide-react"
import { useAuth } from "../app/auth"
import { BLOCKED_NOTICE } from "../app/roles"
import { Link, paths, setSearchParam, useLocation } from "../app/router"
import { OwnerOverview } from "./OwnerHome"
import { EmptyState } from "../app/Shell"
import { RunRow, useHistory } from "./HistoryPages"

/**
 * Home, shaped by the role: a seeker finds or evaluates spaces and opens past runs; an owner sees their spaces, views
 * and offers; "both" sees both. A page of the other role sends the user here with a notice (?notice=seeker|owner).
 */
export function DashboardPage() {
  const role = useAuth().landlord?.role ?? null
  const { search } = useLocation()
  const notice = search.get("notice")
  const noticeText = notice === "seeker" || notice === "owner" ? BLOCKED_NOTICE[notice] : null
  return (
    <div className="flex flex-col gap-4">
      {noticeText && (
        <div role="status" className="glass-strong flex flex-wrap items-center gap-3 rounded-[20px] px-5 py-3.5 text-sm text-ink">
          <Info size={18} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{noticeText}</span>
          <Link to={paths.settings()} className="font-semibold underline underline-offset-4">
            Open Settings
          </Link>
          <button type="button" onClick={() => setSearchParam("notice", null)} aria-label="Dismiss" className="rounded-full p-1.5 hover:bg-white">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
      {role === "owner" ? (
        <OwnerOverview />
      ) : (
        <>
          <SeekerHome />
          {role === "both" && (
            <section className="mt-2 flex flex-col gap-3">
              <h2 className="text-xl leading-7 font-semibold tracking-[-0.015em] text-ink">Your spaces</h2>
              <OwnerOverview />
            </section>
          )}
        </>
      )}
    </div>
  )
}

/** The seeker half of Home: find spaces, evaluate an outside listing, or open a past run. */
function SeekerHome() {
  const recent = useHistory().slice(0, 3)
  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-[28px] p-7">
        <h2 className="text-xl leading-7 font-semibold tracking-[-0.015em] text-ink">Is this lease a good financial decision for my business?</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ModeCard
            to={paths.findSpaces()}
            icon={Search}
            title="Find spaces"
            text="Tell SuiteSpot about your business; it finds the spaces on SuiteSpot that fit and evaluates them."
          />
          <ModeCard
            to={paths.evaluateSpace()}
            icon={FileSearch}
            title="Evaluate a space"
            text="One space, from SuiteSpot or found elsewhere: check the lease and the numbers before you sign."
          />
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
          <p className="text-sm text-ink-2">No runs yet. Start one above.</p>
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
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-ink">
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
