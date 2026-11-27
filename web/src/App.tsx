import { useEffect, useRef, useState } from "react"
import { HowItWorksPage } from "./HowItWorks"
import { startResearch, useResearch } from "./app/research-store"
import { navigate, paths, useLocation, useRoute, type Route } from "./app/router"
import { Shell } from "./app/Shell"
import { HistoryPage } from "./pages/HistoryPages"
import { NewResearchPage } from "./pages/NewResearchPage"
import { ResearchPage } from "./pages/ResearchPage"
import { SettingsPage } from "./pages/SettingsPage"
import { RunView } from "./run/RunView"
import { ListingFormPage } from "./listings/ListingFormPage"
import { BrowseListingsPage, ListingDetailPage, MyListingsPage } from "./listings/ListingPages"
import { MySpacesPage } from "./pages/MySpacesPage"
import { SimulatedPaymentPage } from "./deals/DealViews"
import { CandidatePage } from "./results/CandidatePage"
import { DashboardPage, NotFoundPage } from "./pages/SimplePages"
import { RequireLandlord } from "./pages/AuthPages"
import { AuthRoute, AuthScreen } from "./pages/AuthScreen"
import { useAuth } from "./app/auth"
import { useWelcomeHold } from "./app/welcome"
import type { Config } from "./types"
import { Pill } from "./ui"

const TITLES: Record<Route["name"], string> = {
  dashboard: "Find your SuiteSpot",
  newResearch: "New research",
  run: "Research run",
  results: "Results",
  candidate: "Candidate",
  history: "History",
  howItWorks: "How it works",
  settings: "Settings",
  listings: "Listings",
  listing: "Listing",
  newListing: "New listing",
  editListing: "Edit listing",
  myListings: "My listings",
  mySpaces: "My spaces",
  login: "Sign in",
  signup: "Sign up",
  simulatedPayment: "Payment",
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

  const auth = useAuth()
  const welcoming = useWelcomeHold()
  const { pathname } = useLocation()
  // No guest mode: /login and /signup stand alone; every other page needs a signed-in user, who comes back to it after.
  if (route.name === "login" || route.name === "signup") return <AuthRoute mode={route.name === "login" ? "signin" : "signup"} />
  if (auth.status === "loading") return <div className="min-h-dvh" aria-busy="true" />
  // While the welcome animation plays the sign in screen stays, although the account is signed in already.
  if (!auth.landlord || welcoming) return <AuthScreen mode="signin" next={pathname + (search.toString() ? `?${search}` : "")} />

  const titleExtra = route.name === "run" || route.name === "results" || route.name === "candidate" ? <AnswerSourcePill researchId={route.researchId} /> : null

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
      return <RunView key={route.researchId} researchId={route.researchId} />
    case "results":
      return <ResearchPage researchId={route.researchId} />
    case "candidate":
      return <CandidatePage key={route.candidateId} researchId={route.researchId} candidateId={route.candidateId} />
    case "history":
      return <HistoryPage />
    case "howItWorks":
      return <HowItWorksPage />
    case "settings":
      return <SettingsPage />
    case "listings":
      return <BrowseListingsPage />
    case "listing":
      return <ListingDetailPage key={route.listingId} id={route.listingId} />
    case "newListing":
      return (
        <RequireLandlord>
          <ListingFormPage />
        </RequireLandlord>
      )
    case "editListing":
      return (
        <RequireLandlord>
          <ListingFormPage key={route.listingId} id={route.listingId} />
        </RequireLandlord>
      )
    case "myListings":
      return (
        <RequireLandlord>
          <MyListingsPage />
        </RequireLandlord>
      )
    case "mySpaces":
      return (
        <RequireLandlord>
          <MySpacesPage />
        </RequireLandlord>
      )
    case "login":
    case "signup":
      return null
    case "simulatedPayment":
      return <SimulatedPaymentPage reference={route.reference} />
    case "notFound":
      return <NotFoundPage path={route.path} />
  }
}

/** Honest labels on every result screen: synthetic data, and where the agents' answers came from. */
export const ANSWER_LABEL = {
  scripted: { text: "Scripted demo answers, no AI model", title: "No model was called: the agents replay scripted answers. Code still checks every value against its source." },
  recorded: { text: "Recorded run", title: "A real run with an AI model, recorded and replayed without a key. Code still checks every value against its source." },
} as const

/** Says when the agents' answers were not made by a live model (recorded or scripted); a live run shows nothing. */
function AnswerSourcePill({ researchId }: { researchId: string }) {
  const { answers } = useResearch(researchId)
  const label = answers === "scripted" || answers === "recorded" ? ANSWER_LABEL[answers] : null
  if (!label) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Pill icon={false} title={label.title}>
        {label.text}
      </Pill>
    </span>
  )
}
