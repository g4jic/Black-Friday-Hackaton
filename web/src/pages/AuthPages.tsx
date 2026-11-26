import { LogIn, UserPlus } from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"
import { logIn, signUp, useAuth } from "../app/auth"
import { Link, navigate, paths, useLocation } from "../app/router"
import { Card } from "../app/Shell"
import { cx } from "../ui"
import { INPUT, LABEL } from "./SettingsPage"

const PRIMARY = "inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-40"

/** Where to go after logging in: a "next" path inside the app, or My listings. */
function useNext(): string {
  const next = useLocation().search.get("next") ?? ""
  return next.startsWith("/") && !next.startsWith("//") ? next : paths.myListings()
}

function AccountsOff() {
  return (
    <Card title="Accounts">
      <p>Accounts are off on this server (no Supabase configured). You can still publish listings: they are saved locally as the Local demo landlord.</p>
      <Link to={paths.myListings()} className="mt-4 inline-block font-medium text-ink underline">
        Go to My listings
      </Link>
    </Card>
  )
}

function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4">
      <Card title={title}>
        <p className="mb-4">Only landlords need an account, to publish listings. Tenants search and evaluate as a guest.</p>
        {children}
      </Card>
    </div>
  )
}

export function LoginPage() {
  const auth = useAuth()
  const next = useNext()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (auth.status === "ready" && !auth.enabled) return <AccountsOff />
  if (auth.landlord) {
    return (
      <AuthFrame title="Log in">
        <p>
          You are logged in as <span className="font-semibold text-ink">{auth.landlord.displayName}</span>.
        </p>
        <Link to={next} className="mt-4 inline-block font-medium text-ink underline">
          Continue
        </Link>
      </AuthFrame>
    )
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await logIn(email.trim(), password)
      navigate(next, { replace: true })
    } catch (failure) {
      setError((failure as Error).message)
      setBusy(false)
    }
  }
  return (
    <AuthFrame title="Log in">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <label>
          <span className={LABEL}>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </label>
        <label>
          <span className={LABEL}>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-hard">
            {error}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || auth.status !== "ready"} className={PRIMARY}>
            <LogIn size={16} aria-hidden /> {busy ? "Logging in..." : "Log in"}
          </button>
          <span className="text-[13px]">
            No account?{" "}
            <Link to={`${paths.signup()}?next=${encodeURIComponent(next)}`} className="font-medium text-ink underline">
              Sign up
            </Link>
          </span>
        </div>
      </form>
    </AuthFrame>
  )
}

export const MIN_PASSWORD_LENGTH = 8

export function SignupPage() {
  const auth = useAuth()
  const next = useNext()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)
  if (auth.status === "ready" && !auth.enabled) return <AccountsOff />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) return setError("Enter the name tenants will see on your listings.")
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`)
    setBusy(true)
    try {
      const { needsConfirmation } = await signUp(email.trim(), password, name)
      if (needsConfirmation) {
        setConfirmSent(true)
        setBusy(false)
      } else navigate(next, { replace: true })
    } catch (failure) {
      setError((failure as Error).message)
      setBusy(false)
    }
  }
  if (confirmSent) {
    return (
      <AuthFrame title="Sign up">
        <p>Check your email to confirm the account, then log in.</p>
      </AuthFrame>
    )
  }
  return (
    <AuthFrame title="Sign up">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <label>
          <span className={LABEL}>Your name or company</span>
          <input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </label>
        <label>
          <span className={LABEL}>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </label>
        <label>
          <span className={LABEL}>
            Password <span className="font-normal text-ink-3">(at least {MIN_PASSWORD_LENGTH} characters)</span>
          </span>
          <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-hard">
            {error}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || auth.status !== "ready"} className={PRIMARY}>
            <UserPlus size={16} aria-hidden /> {busy ? "Creating the account..." : "Create account"}
          </button>
          <span className="text-[13px]">
            Have an account?{" "}
            <Link to={`${paths.login()}?next=${encodeURIComponent(next)}`} className="font-medium text-ink underline">
              Log in
            </Link>
          </span>
        </div>
      </form>
    </AuthFrame>
  )
}

/** Landlord pages: with accounts on, ask a guest to log in first; without accounts, everyone is the local landlord. */
export function RequireLandlord({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { pathname, search } = useLocation()
  if (auth.status === "loading") return <p className={cx("text-sm text-ink-2")}>Loading...</p>
  if (auth.enabled && !auth.landlord) {
    const next = encodeURIComponent(pathname + (search.toString() ? `?${search}` : ""))
    return (
      <Card title="Landlords only">
        <p>Log in to publish and manage listings. Tenants do not need an account.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={`${paths.login()}?next=${next}`} className={PRIMARY}>
            <LogIn size={16} aria-hidden /> Log in
          </Link>
          <Link to={`${paths.signup()}?next=${next}`} className="inline-flex h-10 items-center gap-2 rounded-full glass-strong px-[18px] text-sm font-medium text-ink hover:bg-white">
            <UserPlus size={16} aria-hidden /> Sign up
          </Link>
        </div>
      </Card>
    )
  }
  return <>{children}</>
}
