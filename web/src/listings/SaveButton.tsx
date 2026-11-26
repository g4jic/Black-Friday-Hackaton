import { Bookmark, BookmarkCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "../app/auth"
import { Link, paths, useLocation } from "../app/router"
import { cx } from "../ui"
import { listingsApi } from "./listings-api"

/** The ids this browser's signed-in user saved, loaded once and shared by every Save button. */
let savedIds: Set<string> | null = null
let loading: Promise<Set<string>> | null = null
let cachedFor: string | null = null
const listeners = new Set<() => void>()

/** The cache belongs to one user: another user (or sign out and in) loads again. */
function loadSaved(userKey: string): Promise<Set<string>> {
  if (cachedFor !== userKey) {
    cachedFor = userKey
    loading = null
  }
  loading ??= listingsApi.saved().then(
    (listings) => (savedIds = new Set(listings.map((l) => l.id))),
    () => (savedIds = new Set()),
  )
  return loading
}

/** Forget the cache (on sign in or sign out). */
export function resetSaved(): void {
  savedIds = null
  loading = null
  listeners.forEach((l) => l())
}

/**
 * Save a SuiteSpot listing to My spaces. A guest gets an invitation to sign in instead (the button never fails
 * silently). Saving twice changes nothing.
 */
export function SaveButton({ listingId, className }: { listingId: string; className?: string }) {
  const auth = useAuth()
  const { pathname } = useLocation()
  const [saved, setSaved] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState(false)
  const signedIn = Boolean(auth.landlord) || (auth.status === "ready" && !auth.enabled)
  const userKey = auth.landlord?.id ?? "local"

  useEffect(() => {
    if (!signedIn) return setSaved(false)
    const refresh = () => void loadSaved(userKey).then((ids) => setSaved(ids.has(listingId)))
    refresh()
    listeners.add(refresh)
    return () => void listeners.delete(refresh)
  }, [signedIn, listingId, userKey])

  const toggle = async () => {
    if (!signedIn) return setInvite(true)
    setBusy(true)
    setError(null)
    try {
      if (saved) await listingsApi.unsave(listingId)
      else await listingsApi.save(listingId)
      const ids = await loadSaved(userKey)
      if (saved) ids.delete(listingId)
      else ids.add(listingId)
      setSaved(!saved)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the space")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy || (signedIn && saved === null)}
        aria-pressed={Boolean(saved)}
        className={cx("inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-[18px] text-sm font-medium disabled:opacity-50", saved ? "bg-lilac text-ink" : "glass-strong text-ink hover:bg-white")}
      >
        {saved ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />} {saved ? "Saved to My spaces" : "Save"}
      </button>
      {invite && (
        <p className="mt-2 text-[13px] text-ink-2">
          <Link to={`${paths.login()}?next=${encodeURIComponent(pathname)}`} className="font-medium text-ink underline">
            Sign in
          </Link>{" "}
          to save spaces. Searching works without an account.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-hard">
          {error}
        </p>
      )}
    </div>
  )
}
