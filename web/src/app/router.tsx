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
  | { name: "candidate"; researchId: string; candidateId: string }
  | { name: "history" }
  | { name: "assumptions" }
  | { name: "settings" }
  | { name: "listings" }
  | { name: "listing"; listingId: string }
  | { name: "newListing" }
  | { name: "editListing"; listingId: string }
  | { name: "myListings" }
  | { name: "mySpaces" }
  | { name: "login" }
  | { name: "signup" }
  | { name: "notFound"; path: string }

const STATIC_ROUTES: Record<string, Route> = {
  "/": { name: "dashboard" },
  "/research/new": { name: "newResearch" },
  "/history": { name: "history" },
  "/assumptions": { name: "assumptions" },
  "/settings": { name: "settings" },
  "/listings": { name: "listings" },
  "/listings/new": { name: "newListing" },
  "/my-listings": { name: "myListings" },
  "/my-spaces": { name: "mySpaces" },
  "/login": { name: "login" },
  "/signup": { name: "signup" },
}

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/"
  const staticRoute = STATIC_ROUTES[path]
  if (staticRoute) return staticRoute
  const editListingMatch = /^\/listings\/([a-z0-9-]+)\/edit$/.exec(path)
  if (editListingMatch) return { name: "editListing", listingId: editListingMatch[1]! }
  const listingMatch = /^\/listings\/([a-z0-9-]+)$/.exec(path)
  if (listingMatch) return { name: "listing", listingId: listingMatch[1]! }
  const runMatch = /^\/research\/([A-Za-z0-9-]+)\/run$/.exec(path)
  if (runMatch) return { name: "run", researchId: runMatch[1]! }
  const candidateMatch = /^\/research\/([A-Za-z0-9-]+)\/candidate\/([A-Za-z0-9-]+)$/.exec(path)
  if (candidateMatch) return { name: "candidate", researchId: candidateMatch[1]!, candidateId: candidateMatch[2]! }
  const resultsMatch = /^\/research\/([A-Za-z0-9-]+)$/.exec(path)
  if (resultsMatch) return { name: "results", researchId: resultsMatch[1]! }
  return { name: "notFound", path }
}

export const paths = {
  dashboard: () => "/",
  newResearch: () => "/research/new",
  run: (researchId: string) => `/research/${researchId}/run`,
  results: (researchId: string, tab?: string) => `/research/${researchId}${tab ? `?tab=${tab}` : ""}`,
  candidate: (researchId: string, candidateId: string) => `/research/${researchId}/candidate/${candidateId}`,
  history: () => "/history",
  assumptions: () => "/assumptions",
  settings: () => "/settings",
  listings: () => "/listings",
  listing: (listingId: string) => `/listings/${listingId}`,
  newListing: () => "/listings/new",
  editListing: (listingId: string) => `/listings/${listingId}/edit`,
  myListings: () => "/my-listings",
  mySpaces: () => "/my-spaces",
  findSpaces: () => "/research/new?mode=find",
  evaluateOutside: () => "/research/new?mode=evaluate",
  login: () => "/login",
  signup: () => "/signup",
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
