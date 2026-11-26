import { Activity, ChartLine, FileChartColumn, History, Info, LayoutGrid, List, Plus, Search, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { CandidateSections, MetricsStrip, type View } from "./LiveResearch"
import { NewResearch } from "./NewResearch"
import { applyEvent, initialResearch, type ResearchState } from "./research-state"
import { Timeline } from "./Timeline"
import type { Config, WireEvent } from "./types"
import { AGENTS, AgentChip, Pill, cx } from "./ui"

type Screen = "new" | "live" | "reports" | "history" | "assumptions"
type Tab = View | "timeline"

const NAV: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "new", label: "New research", icon: Plus },
  { id: "live", label: "Live research", icon: Activity },
  { id: "reports", label: "Reports", icon: FileChartColumn },
  { id: "history", label: "History", icon: History },
  { id: "assumptions", label: "Assumptions", icon: SlidersHorizontal },
]

type Action = { type: "reset"; id: string } | { type: "event"; event: WireEvent }
const reducer = (s: ResearchState, a: Action): ResearchState => (a.type === "reset" ? initialResearch(a.id) : applyEvent(s, a.event))

export function App() {
  const params = new URLSearchParams(window.location.search)
  const [screen, setScreen] = useState<Screen>("new")
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) ?? "table")
  const [research, dispatch] = useReducer(reducer, initialResearch(null))
  const [config, setConfig] = useState<Config | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [filter, setFilter] = useState("")
  /** From the server's answer: true when the run uses the synthetic demo listings. */
  const [synthetic, setSynthetic] = useState<boolean | null>(null)
  const [now, setNow] = useState(0)
  const clientStart = useRef<number | null>(null)

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json() as Promise<Config>)
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])

  const start = useCallback(async (body: object) => {
    setError(null)
    setStarting(true)
    try {
      const res = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = (await res.json()) as { id?: string; error?: string; synthetic?: boolean }
      if (!res.ok || !json.id) throw new Error(json.error ?? `Server answered ${res.status}`)
      setSynthetic(json.synthetic ?? null)
      clientStart.current = null
      dispatch({ type: "reset", id: json.id })
      setScreen("live")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setStarting(false)
    }
  }, [])

  // ?autorun=demo starts the demo at once (used for the screenshots).
  const autorun = useRef(false)
  useEffect(() => {
    if (!autorun.current && params.get("autorun") === "demo") {
      autorun.current = true
      void start({ source: "demo" })
    }
  }, [start])

  // One SSE stream per research; the reducer ignores events it has already seen if the browser reconnects.
  useEffect(() => {
    if (!research.id) return
    const es = new EventSource(`/api/research/${research.id}/events`)
    const onEvent = (m: MessageEvent<string>) => {
      const event = JSON.parse(m.data) as WireEvent
      clientStart.current ??= Date.now() - event.at
      dispatch({ type: "event", event })
    }
    es.addEventListener("bus", onEvent as EventListener)
    es.addEventListener("done", ((m: MessageEvent<string>) => {
      onEvent(m)
      es.close()
    }) as EventListener)
    return () => es.close()
  }, [research.id])

  // A clock for the Timeline's "now" line while the research runs.
  useEffect(() => {
    if (!research.id || research.done) return
    const t = setInterval(() => clientStart.current !== null && setNow(Date.now() - clientStart.current), 100)
    return () => clearInterval(t)
  }, [research.id, research.done])

  const title = NAV.find((n) => n.id === screen)!.label

  return (
    <div className="min-h-screen pr-6 pb-6 pl-[120px] text-ink">
      <Sidebar screen={screen} onSelect={setScreen} />
      <div className="mx-auto max-w-[1360px] pt-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <nav aria-label="Breadcrumb" className="text-[13px] text-ink-2">
              Home <span className="px-1 text-ink-3">&gt;</span> {title}
            </nav>
            <h1 className="mt-1 flex items-center gap-3 text-[28px] leading-[34px] font-semibold tracking-[-0.01em]">
              {title}
              {screen === "live" && research.id && (synthetic ?? Object.values(research.candidates).some((c) => c.synthetic)) && (
                <Pill variant="brand" icon={false}>
                  Demo data
                </Pill>
              )}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AgentStack s={research} />
            <label className="flex h-10 w-[240px] items-center gap-2 rounded-full bg-white px-4 shadow-[var(--shadow-soft)]">
              <Search size={16} className="text-ink-2" aria-hidden />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search candidates..." aria-label="Search candidates" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3" />
            </label>
            {screen !== "new" && (
              <button type="button" onClick={() => setScreen("new")} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]">
                <Plus size={16} strokeWidth={2} /> New research
              </button>
            )}
          </div>
        </header>

        <main className="mt-5">
          {screen === "new" && <NewResearch config={config} busy={starting} error={error} onRunDemo={() => void start({ source: "demo" })} onRunPasted={(listings) => void start({ mode: "live", source: "pasted", listings })} />}
          {screen === "live" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Tabs tab={tab} onSelect={setTab} />
                <MetricsStrip s={research} />
              </div>
              {!research.id ? (
                <Empty text="No research is running. Start one under New research." />
              ) : tab === "timeline" ? (
                <Timeline s={research} now={now} />
              ) : (
                <CandidateSections s={research} view={tab} filter={filter} />
              )}
            </>
          )}
          {screen === "reports" && <Empty text="Reports come with the Ranker, the next step: ranked candidates with every figure and its source." />}
          {screen === "history" && <Empty text="History of research runs comes in a later step (a local JSON file in demo mode)." />}
          {screen === "assumptions" && <Empty text="SuiteSpot assumptions (weights and thresholds from config/weights.json) come with the Ranker." />}
        </main>

        <footer className="mt-6 flex justify-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] text-ink-2 shadow-[var(--shadow-soft)]">
            <Info size={16} className="text-ink" aria-hidden />
            Not financial or legal advice. SuiteSpot shows numbers with their sources; the decision is yours.
          </p>
        </footer>
      </div>
    </div>
  )
}

function Sidebar({ screen, onSelect }: { screen: Screen; onSelect: (s: Screen) => void }) {
  return (
    <aside className="fixed top-4 bottom-4 left-4 z-30 flex w-[88px] flex-col items-center gap-4 rounded-[28px] bg-white py-5 shadow-[var(--shadow-soft)]" aria-label="Main">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-xl font-bold text-white" aria-label="SuiteSpot">
        S
      </div>
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-current={screen === id ? "page" : undefined}
          onClick={() => onSelect(id)}
          className={cx(
            "flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150",
            screen === id ? "bg-purple-600 text-white" : "bg-white text-ink shadow-[var(--shadow-soft)] hover:bg-purple-100",
          )}
        >
          <Icon size={18} strokeWidth={1.75} />
        </button>
      ))}
    </aside>
  )
}

function Tabs({ tab, onSelect }: { tab: Tab; onSelect: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "cards", label: "Cards", icon: LayoutGrid },
    { id: "table", label: "Table", icon: List },
    { id: "timeline", label: "Timeline", icon: ChartLine },
  ]
  return (
    <div role="tablist" className="flex gap-2">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={tab === id}
          onClick={() => onSelect(id)}
          className={cx(
            "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-200",
            tab === id ? "bg-purple-600 text-white" : "bg-white text-ink shadow-[var(--shadow-soft)] hover:bg-purple-100",
          )}
        >
          <Icon size={16} strokeWidth={1.75} /> {label}
        </button>
      ))}
    </div>
  )
}

/** All agents in the room and the live counter: real values from runtime events only (DESIGN.md 6.8). */
function AgentStack({ s }: { s: ResearchState }) {
  const running = Object.values(s.loops).filter((l) => l.end === undefined)
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {AGENTS.map((a) => (
          <AgentChip key={a.name} name={a.name} state={running.some((l) => l.agent === a.name) ? "busy" : "idle"} />
        ))}
      </div>
      <span className="tnum inline-flex h-8 items-center rounded-full bg-white px-3 text-xs font-medium text-ink shadow-[var(--shadow-soft)]" aria-live="polite">
        {s.busy} busy{s.peak > 0 ? `, peak ${s.peak}` : ""}
      </span>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="surface rounded-[24px] px-6 py-10 text-center text-sm text-ink-2">{text}</div>
}
