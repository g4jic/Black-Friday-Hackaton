import {
  Bookmark,
  Building2,
  ChevronDown,
  CircleHelp,
  History,
  House,
  LayoutList,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react"
import { cx } from "../ui"
import { Logo } from "../Logo"
import { logOut, updateOnboarding, useAuth } from "./auth"
import { onboardingPath } from "./onboarding-gate"
import { navKeysFor, ROLE_LABELS, type NavKey } from "./roles"
import { Link, navigate, paths, useLocation, type Route } from "./router"

/** label: under the icon (the rail is narrow); name: the full name for the tooltip and screen readers. */
type NavItem = { label: string; name: string; to: string; icon: LucideIcon; isActive: (route: Route) => boolean }

/** Every sidebar item; navKeysFor (roles.ts) picks and orders them for the user's role. */
const NAV_ITEMS: Record<NavKey, NavItem> = {
  home: { label: "Home", name: "Home", to: paths.dashboard(), icon: House, isActive: (r) => r.name === "dashboard" },
  research: {
    label: "Research",
    name: "Research: find spaces or evaluate one",
    to: paths.findSpaces(),
    icon: Search,
    isActive: (r) => r.name === "newResearch",
  },
  listings: { label: "Listings", name: "Listings", to: paths.listings(), icon: Building2, isActive: (r) => r.name === "listings" || r.name === "listing" },
  mySpaces: {
    label: "My spaces",
    name: "My spaces: saved spaces, your offers and leases",
    to: paths.mySpaces(),
    icon: Bookmark,
    isActive: (r) => r.name === "mySpaces",
  },
  history: {
    label: "History",
    name: "History",
    to: paths.history(),
    icon: History,
    isActive: (r) => r.name === "history" || r.name === "run" || r.name === "results" || r.name === "candidate",
  },
  myListings: {
    label: "My listings",
    name: "My listings",
    to: paths.myListings(),
    icon: LayoutList,
    isActive: (r) => r.name === "myListings" || r.name === "editListing",
  },
  addSpace: { label: "Add a space", name: "Add a space", to: paths.newListing(), icon: Plus, isActive: (r) => r.name === "newListing" },
  offers: { label: "Offers", name: "Offers received and leased spaces", to: paths.offers(), icon: MessageSquare, isActive: (r) => r.name === "offers" },
}

export const NOT_ADVICE = "Not financial or legal advice. SuiteSpot shows numbers with their sources; the decision is yours."

/**
 * The frame around every page: sidebar (a bottom bar on a phone, so pages keep the full width), page header (title,
 * optional pills, New research) and the advice footer.
 */
/** The one discreet line under a page that scores or recommends (results, the report, a candidate). */
export function AdviceNote() {
  return <p className="mt-8 text-center text-xs text-ink-3">{NOT_ADVICE}</p>
}

/**
 * The frame of every page. The sidebar ends 104 px from the left (16 + 88); the content starts 24 px after it and
 * ends 24 px before the window edge (the right padding is 24 px minus the space the page keeps for its scrollbar, see
 * scrollbar-gutter in index.css), so the gap is the same on both sides. Above 1360 px of content the frame is centred
 * in the space between them; the title is 24 px from the top. On a phone the sidebar is a bottom bar and the frame
 * has 16 px on each side.
 */
export function Shell({ route, title, titleExtra, children }: { route: Route; title: string; titleExtra?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 pb-28 text-ink page-frame sm:pb-8 sm:pl-[128px]">
      <Sidebar route={route} />
      <div className="mx-auto w-full max-w-[1360px] pt-6">
        <header className="flex flex-wrap items-center gap-4">
          <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-[34px] font-semibold tracking-[-0.01em]">
            {title}
            {titleExtra}
          </h1>
        </header>
        <main className="mt-5">{children}</main>
      </div>
    </div>
  )
}

function Sidebar({ route }: { route: Route }) {
  const role = useAuth().landlord?.role ?? null
  return (
    <aside
      className="fixed z-30 flex items-center glass-strong max-sm:inset-x-3 max-sm:bottom-3 max-sm:h-[68px] max-sm:justify-around max-sm:rounded-[28px] max-sm:px-1 sm:top-4 sm:bottom-4 sm:left-4 sm:w-[88px] sm:flex-col sm:rounded-[32px] sm:py-5"
      aria-label="Main"
    >
      <Link to={paths.dashboard()} className="mb-4 flex h-14 w-14 items-center justify-center max-sm:hidden" aria-label="SuiteSpot home" title="SuiteSpot">
        <Logo size={56} title="SuiteSpot" className="h-14 w-14" />
      </Link>
      <nav className="flex flex-col items-center gap-2.5 max-sm:contents">
        {navKeysFor(role).map((key) => {
          const item = NAV_ITEMS[key]
          const active = item.isActive(route)
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              to={item.to}
              title={item.name}
              aria-label={item.name}
              aria-current={active ? "page" : undefined}
              className="group flex w-[58px] flex-col items-center gap-1 rounded-[18px] py-1.5 sm:w-[72px]"
            >
              <span
                className={cx(
                  "nav-lift flex h-10 w-10 items-center justify-center rounded-full",
                  active ? "bg-brand-soft text-ink" : "glass-strong text-ink group-hover:bg-white",
                )}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.75} aria-hidden />
              </span>
              <span className={cx("text-[11px] leading-3", active ? "font-semibold text-ink" : "font-medium text-ink-2 group-hover:text-ink")}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
      <div className="sm:mt-auto">
        <AvatarMenu settingsActive={route.name === "settings" || route.name === "howItWorks"} />
      </div>
    </aside>
  )
}

const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}
const EASE = "cubic-bezier(0.2, 0, 0, 1)"
const SPRING = "cubic-bezier(0.34, 1.3, 0.64, 1)"

/**
 * The avatar of the signed-in user. Only the avatar sits in the rail; the menu unfolds from it: the panel grows out
 * of the avatar's corner (clip-path) while the avatar travels to the top of the panel (measured first, then animated
 * from where it was), and the name, email, role and items fade in under it. Closed by the avatar, a click outside or
 * Escape (focus goes back to the avatar); arrow keys move between the items. No motion with reduced motion.
 */
function AvatarMenu({ settingsActive }: { settingsActive: boolean }) {
  const [open, setOpen] = useState(false)
  const closing = useRef(false)
  const restoreFocus = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const headAvatarRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const auth = useAuth()
  const user = { name: auth.landlord?.displayName ?? "Account" }
  const role = auth.landlord?.role ?? null
  const { pathname, search } = useLocation()
  const ITEM = "flex w-full items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left text-[15px] font-medium text-ink hover:bg-white focus-visible:bg-white"

  /** Where the rail avatar is, seen from the panel: the clip that starts the unfold and the avatar's travel. */
  const geometry = () => {
    const t = triggerRef.current!.querySelector("span")!.getBoundingClientRect()
    const p = panelRef.current!.getBoundingClientRect()
    const h = headAvatarRef.current!.getBoundingClientRect()
    const pad = 6
    const clip = `inset(${Math.max(0, t.top - p.top - pad)}px ${Math.max(0, p.right - t.right - pad)}px ${Math.max(0, p.bottom - t.bottom - pad)}px ${Math.max(0, t.left - p.left - pad)}px round 28px)`
    return { clip, move: `translate(${t.left - h.left}px, ${t.top - h.top}px)` }
  }

  const close = (returnFocus: boolean) => {
    if (!open || closing.current) return
    restoreFocus.current = returnFocus
    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      closing.current = false
      setOpen(false)
    }
    if (prefersReducedMotion() || !panelRef.current) return done()
    closing.current = true
    const { clip, move } = geometry()
    bodyRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-out", fill: "forwards" })
    headAvatarRef.current?.animate([{ transform: "none" }, { transform: move }], { duration: 260, easing: EASE, fill: "forwards" })
    const folding = panelRef.current.animate([{ clipPath: "inset(0px 0px 0px 0px round 24px)" }, { clipPath: clip }], {
      duration: 260,
      easing: EASE,
      fill: "forwards",
    })
    folding.onfinish = done
    // A background tab may hold animations back; the menu still closes on time.
    window.setTimeout(done, 320)
  }

  // Back to the avatar after Escape or a click on it, once it is visible again (a hidden button cannot take focus).
  useEffect(() => {
    if (open || !restoreFocus.current) return
    restoreFocus.current = false
    triggerRef.current?.focus()
  }, [open])

  // The unfold: measured after layout and before paint, so the panel never flashes at full size.
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return
    const first = panelRef.current.querySelector<HTMLElement>('[role="menuitem"]')
    if (prefersReducedMotion()) return first?.focus()
    const { clip, move } = geometry()
    panelRef.current.animate([{ clipPath: clip }, { clipPath: "inset(0px 0px 0px 0px round 24px)" }], { duration: 320, easing: EASE })
    headAvatarRef.current?.animate([{ transform: move }, { transform: "none" }], { duration: 380, easing: SPRING })
    bodyRef.current?.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 240, delay: 90, easing: EASE, fill: "backwards" },
    )
    first?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  })

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      return close(true)
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length
    items[next]?.focus()
  }

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }
  /** "Also find a space" / "Also list a space": the role becomes both, then the form of the added role opens. */
  const addRole = async (added: "seeker" | "owner") => {
    setOpen(false)
    await updateOnboarding({ role: "both" })
    navigate(onboardingPath(added, { next: pathname + (search.toString() ? `?${search}` : ""), add: true }))
  }
  const avatar = (size: string) =>
    cx("flex shrink-0 items-center justify-center rounded-full font-semibold text-ink", size, settingsActive ? "bg-brand-soft" : "bg-lilac")

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(true) : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.name}: open the menu`}
        title={user.name}
        className={cx("group flex w-[58px] justify-center rounded-[18px] py-1.5 sm:w-[72px]", open && "invisible")}
      >
        <span className={cx("nav-lift text-sm", avatar("h-10 w-10"))}>{user.name[0]}</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Profile"
          onKeyDown={onKeyDown}
          className="absolute z-40 flex w-[300px] flex-col gap-2 rounded-[24px] glass-strong p-4 shadow-[var(--shadow-pop)] max-sm:right-[3px] max-sm:bottom-0 sm:-bottom-0.5 sm:left-[9px]"
        >
          <div className="flex items-center gap-3 px-1 pb-1">
            <button
              ref={headAvatarRef}
              type="button"
              onClick={() => close(true)}
              aria-label="Close the menu"
              title="Close the menu"
              className={cx("text-base", avatar("h-11 w-11"))}
            >
              {user.name[0]}
            </button>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[15px] font-semibold text-ink">{user.name}</span>
              {auth.landlord?.email && <span className="truncate text-[13px] text-ink-2">{auth.landlord.email}</span>}
              {role && <span className="self-start rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-ink">{ROLE_LABELS[role]}</span>}
            </span>
          </div>
          <div ref={bodyRef} className="flex flex-col gap-2">
            <div className="my-1 h-px bg-line" />
            {role === "owner" && (
              <button type="button" role="menuitem" onClick={() => void addRole("seeker")} className={ITEM}>
                <Search size={16} aria-hidden /> Also find a space (add Space seeker)
              </button>
            )}
            {role === "seeker" && (
              <button type="button" role="menuitem" onClick={() => void addRole("owner")} className={ITEM}>
                <Building2 size={16} aria-hidden /> Also list a space (add Space owner)
              </button>
            )}
            <button type="button" role="menuitem" onClick={() => go(paths.howItWorks())} className={ITEM}>
              <CircleHelp size={16} aria-hidden /> How it works
            </button>
            <button type="button" role="menuitem" onClick={() => go(paths.settings())} className={ITEM}>
              <SettingsIcon size={16} aria-hidden /> Settings
            </button>
            {auth.landlord && (
              <button type="button" role="menuitem" onClick={() => void logOut().then(() => go(paths.dashboard()))} className={cx(ITEM, "text-ink-2")}>
                <LogOut size={16} aria-hidden /> Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Open or collapsed per card, for this browser tab (sessionStorage); a blocked storage just forgets. */
function useCollapsed(key: string | null): [boolean, (collapsed: boolean) => void] {
  const storageKey = key ? `suitespot.card.${key}` : null
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return storageKey ? window.sessionStorage.getItem(storageKey) === "1" : false
    } catch {
      return false
    }
  })
  const set = (next: boolean) => {
    setCollapsed(next)
    try {
      if (storageKey) window.sessionStorage.setItem(storageKey, next ? "1" : "0")
    } catch {
      // storage blocked: the state lasts for this page view
    }
  }
  return [collapsed, set]
}

/**
 * A section card (DESIGN.md 6.3). collapsible: a chevron left of the title pill (pointing right when collapsed), an
 * optional count circle inside the pill, and the body opening and closing smoothly (none with reduced motion). The
 * state is remembered per card id for the tab's session; a collapsed body is inert, so the keyboard skips it.
 */
export function Card({
  title,
  children,
  className,
  collapsible,
  id,
  count,
  action,
}: {
  title?: string
  children: ReactNode
  className?: string
  collapsible?: boolean
  /** The key for remembering the state (defaults to the title). */
  id?: string
  count?: number
  /** Something on the right of the header (for example a link). */
  action?: ReactNode
}) {
  const [collapsed, setCollapsed] = useCollapsed(collapsible ? (id ?? title ?? null) : null)
  const bodyId = useId()
  const pill = (
    <span className="inline-flex items-center gap-2 title-pill rounded-full glass-strong px-3.5 py-1.5 text-lg leading-6 font-semibold text-ink">
      {title}
      {count !== undefined && (
        <span className="tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-ink">{count}</span>
      )}
    </span>
  )
  if (!collapsible || !title) {
    return (
      <section className={cx("glass rounded-[28px] p-6 text-sm leading-5 text-ink-2", className)}>
        {title && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="inline-flex">{pill}</h2>
            {action}
          </div>
        )}
        {children}
      </section>
    )
  }
  return (
    <section className={cx("glass rounded-[28px] p-6 text-sm leading-5 text-ink-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            className="group inline-flex items-center gap-2 rounded-full text-left"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full glass-strong text-ink group-hover:bg-white">
              <ChevronDown size={16} className={cx("transition-transform duration-200", collapsed && "-rotate-90")} aria-hidden />
            </span>
            {pill}
          </button>
        </h2>
        {action}
      </div>
      <div id={bodyId} className={cx("collapse-body", collapsed && "is-collapsed")} {...(collapsed ? { inert: "" } : {})}>
        <div className="collapse-inner">
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </section>
  )
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-[28px] px-6 py-12 text-center text-sm text-ink-2">
      <p>{text}</p>
      {action}
    </div>
  )
}
