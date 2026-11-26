import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react"

/**
 * A small router on the browser History API (no dependency). Every screen has a real URL, so the back button,
 * reloads and shared links work. In production the server answers every non-API path with index.html.
 */
export type Route =
  | { name: "dashboard" }
  | { name: "newResearch" }
  | { name: "run"; researchId: string }
  | { name: "results"; researchId: string }
  | { name: "history" }
  | { name: "reports" }
  | { name: "assumptions" }
  | { name: "settings" }
  | { name: "notFound"; path: string }

const STATIC_ROUTES: Record<string, Route> = {
  "/": { name: "dashboard" },
  "/research/new": { name: "newResearch" },
  "/history": { name: "history" },
  "/reports": { name: "reports" },
  "/assumptions": { name: "assumptions" },
  "/settings": { name: "settings" },
}

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/"
  const staticRoute = STATIC_ROUTES[path]
  if (staticRoute) return staticRoute
  const runMatch = /^\/research\/([A-Za-z0-9-]+)\/run$/.exec(path)
  if (runMatch) return { name: "run", researchId: runMatch[1]! }
  const resultsMatch = /^\/research\/([A-Za-z0-9-]+)$/.exec(path)
  if (resultsMatch) return { name: "results", researchId: resultsMatch[1]! }
  return { name: "notFound", path }
}

export const paths = {
  dashboard: () => "/",
  newResearch: () => "/research/new",
  run: (researchId: string) => `/research/${researchId}/run`,
  results: (researchId: string, tab?: string) => `/research/${researchId}${tab ? `?tab=${tab}` : ""}`,
  history: () => "/history",
  reports: () => "/reports",
  assumptions: () => "/assumptions",
  settings: () => "/settings",
}

const listeners = new Set<() => void>()
const notifyListeners = () => listeners.forEach((listener) => listener())
window.addEventListener("popstate", notifyListeners)

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === window.location.pathname + window.location.search) return
  if (options.replace) window.history.replaceState(null, "", to)
  else window.history.pushState(null, "", to)
  notifyListeners()
  window.scrollTo({ top: 0 })
}

/** The current path and query string; components re-render when it changes. */
export function useLocation(): { pathname: string; search: URLSearchParams } {
  const href = useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search)
  const url = new URL(href, window.location.origin)
  return { pathname: url.pathname, search: url.searchParams }
}

export function useRoute(): Route {
  return parseRoute(useLocation().pathname)
}

/** Sets one query parameter without adding a history entry (used for tabs). */
export function setSearchParam(name: string, value: string | null): void {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(name)
  else url.searchParams.set(name, value)
  navigate(url.pathname + url.search, { replace: true })
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

/** A real link (open in new tab works); a plain left click navigates inside the app. */
export function Link({ to, onClick, ...anchorProps }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handleClick} {...anchorProps} />
}
