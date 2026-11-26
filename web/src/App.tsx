import { useEffect, useRef, useState } from "react"
import { AssumptionsScreen } from "./Assumptions"
import { startResearch, useResearch } from "./app/research-store"
import { navigate, paths, useLocation, useRoute, type Route } from "./app/router"
import { Shell } from "./app/Shell"
import { NewResearch } from "./NewResearch"
import { HistoryPage, ReportsPage } from "./pages/HistoryPages"
import { ResearchPage } from "./pages/ResearchPage"
import { SettingsPage } from "./pages/SettingsPage"
import { DashboardPage, NotFoundPage } from "./pages/SimplePages"
import type { Config } from "./types"
import { Pill } from "./ui"

const TITLES: Record<Route["name"], string> = {
  dashboard: "Home",
  newResearch: "New research",
  run: "Research run",
  results: "Results",
  history: "History",
  reports: "Reports",
  assumptions: "Assumptions",
  settings: "Settings",
  notFound: "Page not found",
}

export function App() {
  const route = useRoute()
  const { search } = useLocation()
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json() as Promise<Config>)
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])

  // ?autorun=demo starts the demo at once (used by the screenshot script).
  const autorunStarted = useRef(false)
  useEffect(() => {
    if (autorunStarted.current || search.get("autorun") !== "demo") return
    autorunStarted.current = true
    void startResearch({ source: "demo" }).then((id) => navigate(paths.run(id), { replace: true }))
  }, [search])

  useEffect(() => {
    document.title = `${TITLES[route.name]} - SuiteSpot`
  }, [route.name])

  const titleExtra = route.name === "run" || route.name === "results" ? <DemoDataPill researchId={route.researchId} /> : null

  return (
    <Shell route={route} title={TITLES[route.name]} titleExtra={titleExtra}>
      <Page route={route} config={config} />
    </Shell>
  )
}

function Page({ route, config }: { route: Route; config: Config | null }) {
  switch (route.name) {
    case "dashboard":
      return <DashboardPage />
    case "newResearch":
      return <NewResearchPage config={config} />
    case "run":
    case "results":
      return <ResearchPage researchId={route.researchId} />
    case "history":
      return <HistoryPage />
    case "reports":
      return <ReportsPage />
    case "assumptions":
      return <AssumptionsScreen />
    case "settings":
      return <SettingsPage />
    case "notFound":
      return <NotFoundPage path={route.path} />
  }
}

function DemoDataPill({ researchId }: { researchId: string }) {
  const { synthetic } = useResearch(researchId)
  if (!synthetic) return null
  return (
    <Pill variant="brand" icon={false} title="This run uses synthetic demo listings, not real ones">
      Demo data
    </Pill>
  )
}

function NewResearchPage({ config }: { config: Config | null }) {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const start = async (request: Parameters<typeof startResearch>[0]) => {
    setError(null)
    setStarting(true)
    try {
      navigate(paths.run(await startResearch(request)))
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setStarting(false)
    }
  }
  return (
    <NewResearch
      config={config}
      busy={starting}
      error={error}
      onRunDemo={() => void start({ source: "demo" })}
      onRunPasted={(listings) => void start({ mode: "live", source: "pasted", listings })}
    />
  )
}
