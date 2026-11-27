import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react"
import { logIn, signUp, useAuth } from "../app/auth"
import { Link, navigate, paths, useLocation } from "../app/router"
import { INPUT, LABEL } from "./SettingsPage"

/**
 * Sign in and sign up (DESIGN.md 7.5): a white glass card on the left, an animated map on the right where the
 * magnifying glass from the logo stops over listings. Every page of the app sits behind this screen (no guest mode).
 * After a successful sign in the lens grows to fill the screen and the app appears behind it (B7); with
 * prefers-reduced-motion the app simply appears.
 */
export const MIN_PASSWORD_LENGTH = 8
const PRIMARY = "flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-40"

const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** Where to go after signing in: the page the user wanted (a path inside the app), else Home. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") && !next.startsWith("/signup") ? next : paths.dashboard()
}

export function AuthScreen({ mode, next }: { mode: "signin" | "signup"; next: string }) {
  const auth = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)
  const lensRef = useRef<HTMLDivElement>(null)
  const other = mode === "signin" ? paths.signup() : paths.login()

  const finish = () => {
    // B7: the lens grows over the whole screen, then the app appears behind it.
    const lens = lensRef.current
    if (!lens || prefersReducedMotion() || typeof lens.animate !== "function") return navigate(next, { replace: true })
    const box = lens.getBoundingClientRect()
    const overlay = document.createElement("div")
    overlay.className = "auth-zoom"
    overlay.style.left = `${box.left}px`
    overlay.style.top = `${box.top}px`
    overlay.style.width = `${box.width}px`
    overlay.style.height = `${box.height}px`
    overlay.innerHTML = lens.innerHTML
    document.body.appendChild(overlay)
    const scale = (Math.hypot(window.innerWidth, window.innerHeight) / Math.min(box.width, box.height)) * 2.4
    const dx = window.innerWidth / 2 - (box.left + box.width / 2)
    const dy = window.innerHeight / 2 - (box.top + box.height / 2)
    const grow = overlay.animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${dx}px,${dy}px) scale(${scale})` }], { duration: 900, easing: "cubic-bezier(0.5, 0, 0.2, 1)", fill: "forwards" })
    grow.onfinish = () => {
      navigate(next, { replace: true })
      overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: "ease-out", fill: "forwards" }).onfinish = () => overlay.remove()
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (mode === "signup") {
      if (!name.trim()) return setError("Enter your name or company.")
      if (password.length < MIN_PASSWORD_LENGTH) return setError(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`)
    }
    setBusy(true)
    try {
      if (mode === "signin") {
        await logIn(email.trim(), password)
        finish()
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password, name)
        if (needsConfirmation) {
          setConfirmSent(true)
          setBusy(false)
        } else finish()
      }
    } catch (failure) {
      setError((failure as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh gap-4 p-4 lg:gap-6 lg:p-6">
      <section className="glass flex w-full flex-col rounded-[32px] px-6 py-6 sm:px-10 lg:max-w-[640px] lg:flex-[0_0_44%]">
        <div className="flex items-center gap-3">
          <img src="/suitespot-logo.svg" alt="" width={36} height={36} />
          <span className="text-xl font-semibold text-ink">SuiteSpot</span>
        </div>
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">
          <h1 className="text-center text-[34px] leading-tight font-semibold tracking-tight text-ink">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-center text-sm text-ink-2">{mode === "signin" ? "Sign in to research spaces, save them and publish your listings." : "One account to research spaces, save them and list your own."}</p>
          {auth.mode === "local" && auth.status === "ready" && (
            <p className="mt-4 rounded-[16px] bg-white/70 px-4 py-2.5 text-center text-xs leading-5 text-ink-2">This copy of SuiteSpot keeps accounts on this computer only.</p>
          )}
          {confirmSent ? (
            <p className="mt-8 text-center text-sm text-ink">Check your email to confirm the account, then sign in.</p>
          ) : (
            <form onSubmit={(e) => void submit(e)} className="mt-8 flex flex-col gap-4">
              {mode === "signup" && (
                <label>
                  <span className={LABEL}>Your name or company</span>
                  <input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
                </label>
              )}
              <label>
                <span className={LABEL}>Email</span>
                <input type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              </label>
              <label>
                <span className={LABEL}>
                  Password{mode === "signup" && <span className="font-normal text-ink-3"> (at least {MIN_PASSWORD_LENGTH} characters)</span>}
                </span>
                <input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
              </label>
              {error && (
                <p role="alert" className="text-[13px] text-hard">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy || auth.status !== "ready"} className={`${PRIMARY} mt-2`}>
                {busy ? (mode === "signin" ? "Signing in..." : "Creating the account...") : mode === "signin" ? "Sign in" : "Create account"}
              </button>
              <p className="text-center text-[13px] text-ink-2">
                {mode === "signin" ? "Don't have an account? " : "Have an account? "}
                <Link to={`${other}?next=${encodeURIComponent(next)}`} className="font-semibold text-ink underline">
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </Link>
              </p>
            </form>
          )}
        </div>
        <p className="text-xs text-ink-2">© 2026 SuiteSpot · Not financial or legal advice</p>
      </section>
      <MapPanel lensRef={lensRef} />
    </div>
  )
}

/** The page behind /login and /signup, and in front of every other page for a user who is not signed in. */
export function AuthRoute({ mode }: { mode: "signin" | "signup" }) {
  const next = safeNext(useLocation().search.get("next"))
  const auth = useAuth()
  useEffect(() => {
    if (auth.landlord) navigate(next, { replace: true })
  }, [auth.landlord, next])
  return <AuthScreen mode={mode} next={next} />
}

// ---------------------------------------------------------------------------------------------------------------
// The map: city blocks, a river, listings as coral dots. The map pans slowly (transform only); the lens visits the
// listings one by one and the building pops up with a pill naming the listing. Static with reduced motion.

const MAP_W = 900
const MAP_H = 1000

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

type Block = { x: number; y: number; w: number; h: number; fill: string }

function cityBlocks(): Block[] {
  const r = rng(7)
  const fills = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FBEFF4", "#F6E8F5", "#FBE5DC", "#E6F5EA"]
  const blocks: Block[] = []
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 13; col++) {
      if (r() < 0.12) continue
      const w = 44 + r() * 34
      const h = 50 + r() * 30
      blocks.push({ x: col * 74 + (row % 2) * 18 + r() * 6 - 30, y: row * 74 + r() * 6 - 30, w, h, fill: fills[Math.floor(r() * fills.length)]! })
    }
  }
  return blocks
}

/** Where the lens stops (percent of the panel). The pill names a real SuiteSpot demo listing (synthetic data). */
const STOPS = [
  { x: 33, y: 33 },
  { x: 64, y: 56 },
  { x: 40, y: 72 },
  { x: 72, y: 24 },
]

/** Four demo listings for the pills ("Liman 1 · 77 m2"), from the public listings API; empty while loading. */
function useListingLabels(): string[] {
  const [labels, setLabels] = useState<string[]>([])
  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json() as Promise<{ listings: { district: string; areaM2: number }[] }>)
      .then((body) => setLabels(body.listings.slice(0, STOPS.length).map((l) => `${l.district} · ${l.areaM2} m2`)))
      .catch(() => setLabels([]))
  }, [])
  return labels
}

function MapPanel({ lensRef }: { lensRef: RefObject<HTMLDivElement> }) {
  const blocks = useMemo(cityBlocks, [])
  const labels = useListingLabels()
  const [stop, setStop] = useState(0)
  const [shown, setShown] = useState(true)
  useEffect(() => {
    if (prefersReducedMotion()) return
    let hide: ReturnType<typeof setTimeout>
    const timer = setInterval(() => {
      setShown(false)
      hide = setTimeout(() => {
        setStop((s) => (s + 1) % STOPS.length)
        setTimeout(() => setShown(true), 1300)
      }, 250)
    }, 4200)
    return () => {
      clearInterval(timer)
      clearTimeout(hide)
    }
  }, [])
  const here = STOPS[stop]!
  const label = labels[stop]
  return (
    <section aria-hidden className="auth-map relative hidden flex-1 overflow-hidden rounded-[32px] border border-white/70 bg-[#F6EEF6] lg:block">
      <svg className="auth-map-pan absolute -inset-[10%] h-[120%] w-[120%]" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice">
        {blocks.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={b.fill} opacity={0.92} />
        ))}
        <path d="M -40 640 C 200 700, 420 560, 560 470 S 820 300, 960 250" fill="none" stroke="#E2D2F6" strokeWidth={70} strokeLinecap="round" />
        <path d="M -40 640 C 200 700, 420 560, 560 470 S 820 300, 960 250" fill="none" stroke="#D5BFF1" strokeWidth={6} opacity={0.8} />
      </svg>
      {STOPS.map((s, i) => (
        <span key={i} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-4 ring-white/70" style={{ left: `${s.x}%`, top: `${s.y}%` }} />
      ))}
      <div className="auth-lens-move pointer-events-none absolute inset-0" style={{ transform: `translate(${here.x - 50}%, ${here.y - 50}%)` }}>
        <div className="absolute top-1/2 left-1/2">
        {label && <span className={`auth-pill absolute -top-[132px] left-1/2 rounded-full border border-brand/40 bg-white px-3 py-1 text-xs font-medium whitespace-nowrap text-ink ${shown ? "is-shown" : ""}`}>{label}</span>}
        <div ref={lensRef} className="auth-lens absolute -left-[100px] -top-[100px] h-[200px] w-[200px]">
          <svg viewBox="0 0 480 480" width="100%" height="100%">
            <defs>
              <radialGradient id="authLens" cx="40%" cy="35%" r="70%">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="1" stopColor="#FBF1F8" />
              </radialGradient>
              <linearGradient id="authCoral" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F7A48C" />
                <stop offset="0.55" stopColor="#F25C54" />
                <stop offset="1" stopColor="#E5483F" />
              </linearGradient>
            </defs>
            <line x1="337.9" y1="337.9" x2="398" y2="398" stroke="#0B0B0F" strokeWidth={64} strokeLinecap="round" />
            <circle cx="212" cy="212" r="164" fill="url(#authLens)" />
            <g className={`auth-building ${shown ? "is-shown" : ""}`}>
              <polygon points="191.1,314.2 125.6,276.4 125.6,179.8 191.1,217.6" fill="#D9BFF4" />
              <polygon points="178.4,258.5 162.0,249.1 162.0,223.9 178.4,233.3" fill="#8F5FD0" />
              <polygon points="152.9,243.8 136.5,234.4 136.5,209.2 152.9,218.6" fill="#8F5FD0" />
              <polygon points="191.1,314.2 298.4,252.2 298.4,155.6 191.1,217.6" fill="#FFFFFF" />
              <polygon points="198.4,310.0 291.1,256.4 291.1,210.2 198.4,263.8" fill="#C19BE9" />
              <polygon points="211.1,302.6 231.1,291.1 231.1,249.1 211.1,260.6" fill="#0B0B0F" />
              <polygon points="194.7,265.9 294.7,208.1 294.7,197.6 194.7,255.4" fill="#F25C54" />
              <polygon points="191.1,217.6 298.4,155.6 232.9,117.8 125.6,179.8" fill="#F25C54" />
              <polygon points="191.1,208.1 282.0,155.6 232.9,127.3 142.0,179.8" fill="#F7A48C" />
            </g>
            <circle cx="212" cy="212" r="164" fill="none" stroke="url(#authCoral)" strokeWidth={40} />
          </svg>
        </div>
        </div>
      </div>
      <div className="absolute right-5 bottom-5 flex gap-2">
        <span className="rounded-full bg-lilac px-3 py-1.5 text-xs font-medium text-ink">Demo data</span>
        <span className="rounded-full border border-brand/40 bg-white px-3 py-1.5 text-xs font-medium text-ink">100 synthetic listings</span>
      </div>
    </section>
  )
}
