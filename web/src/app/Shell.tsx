import { Bookmark, Building2, CircleHelp, History, House, Info, LayoutList, LogOut, MessageSquare, Plus, Search, Settings as SettingsIcon, type LucideIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { cx } from "../ui"
import { Logo } from "../Logo"
import { logOut, updateOnboarding, useAuth } from "./auth"
import { onboardingPath } from "./onboarding-gate"
import { navKeysFor, ROLE_LABELS, seeksSpaces, type NavKey } from "./roles"
import { Link, navigate, paths, useLocation, type Route } from "./router"

/** label: under the icon (the rail is narrow); name: the full name for the tooltip and screen readers. */
type NavItem = { label: string; name: string; to: string; icon: LucideIcon; isActive: (route: Route) => boolean }

/** Every sidebar item; navKeysFor (roles.ts) picks and orders them for the user's role. */
const NAV_ITEMS: Record<NavKey, NavItem> = {
  home: { label: "Home", name: "Home", to: paths.dashboard(), icon: House, isActive: (r) => r.name === "dashboard" },
  research: { label: "Research", name: "Research: find spaces or evaluate one", to: paths.findSpaces(), icon: Search, isActive: (r) => r.name === "newResearch" },
  listings: { label: "Listings", name: "Listings", to: paths.listings(), icon: Building2, isActive: (r) => r.name === "listings" || r.name === "listing" },
  mySpaces: { label: "My spaces", name: "My spaces: saved spaces, your offers and leases", to: paths.mySpaces(), icon: Bookmark, isActive: (r) => r.name === "mySpaces" },
  history: { label: "History", name: "History", to: paths.history(), icon: History, isActive: (r) => r.name === "history" || r.name === "run" || r.name === "results" || r.name === "candidate" },
  myListings: { label: "My listings", name: "My listings", to: paths.myListings(), icon: LayoutList, isActive: (r) => r.name === "myListings" || r.name === "editListing" },
  addSpace: { label: "Add a space", name: "Add a space", to: paths.newListing(), icon: Plus, isActive: (r) => r.name === "newListing" },
  offers: { label: "Offers", name: "Offers received and leased spaces", to: paths.offers(), icon: MessageSquare, isActive: (r) => r.name === "offers" },
}

export const NOT_ADVICE = "Not financial or legal advice. SuiteSpot shows numbers with their sources; the decision is yours."

/**
 * The frame around every page: sidebar (a bottom bar on a phone, so pages keep the full width), page header (title,
 * optional pills, New research) and the advice footer.
 */
const HEADER_CTA = "inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]"

export function Shell({ route, title, titleExtra, children }: { route: Route; title: string; titleExtra?: ReactNode; children: ReactNode }) {
  const role = useAuth().landlord?.role ?? null
  return (
    <div className="min-h-screen px-4 pb-28 text-ink sm:pr-6 sm:pb-6 sm:pl-[116px]">
      <Sidebar route={route} />
      <div className="mx-auto max-w-[1360px] pt-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-[34px] font-semibold tracking-[-0.01em]">
            {title}
            {titleExtra}
          </h1>
          {/* One primary action per screen: New research for a seeker, Add a space for an owner only. */}
          {seeksSpaces(role)
            ? route.name !== "newResearch" && (
                <Link to={paths.newResearch()} className={HEADER_CTA}>
                  <Plus size={16} strokeWidth={2} aria-hidden /> New research
                </Link>
              )
            : route.name !== "newListing" && (
                <Link to={paths.newListing()} className={HEADER_CTA}>
                  <Plus size={16} strokeWidth={2} aria-hidden /> Add a space
                </Link>
              )}
        </header>
        <main className="mt-5">{children}</main>
        <footer className="mt-6 flex justify-center">
          <p className="inline-flex items-center gap-2 rounded-full glass-strong px-4 py-2 text-[13px] text-ink-2">
            <Info size={16} className="shrink-0 text-ink" aria-hidden />
            {NOT_ADVICE}
          </p>
        </footer>
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
                  "flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200",
                  active ? "bg-brand-soft text-ink" : "glass-strong text-ink group-hover:bg-white",
                )}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.75} aria-hidden />
              </span>
              <span className={cx("text-[11px] leading-3", active ? "font-semibold text-ink" : "font-medium text-ink-2 group-hover:text-ink")}>{item.label}</span>
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

/** The avatar of the signed-in user (one kind of account: search and list): My spaces, My listings, How it works, sign out. */
function AvatarMenu({ settingsActive }: { settingsActive: boolean }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const auth = useAuth()
  const user = { name: auth.landlord?.displayName ?? "Account" }
  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }
  const ITEM = "flex w-full items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left text-[15px] font-medium text-ink hover:bg-white"
  const role = auth.landlord?.role ?? null
  const { pathname, search } = useLocation()
  /** "Also find a space" / "Also list a space": the role becomes both, then the form of the added role opens. */
  const addRole = async (added: "seeker" | "owner") => {
    setOpen(false)
    await updateOnboarding({ role: "both" })
    navigate(onboardingPath(added, { next: pathname + (search.toString() ? `?${search}` : ""), add: true }))
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${user.name}: open the menu`}
        className="flex w-[58px] flex-col items-center gap-1 rounded-[18px] py-1.5 sm:w-[72px]"
      >
        <span className={cx("flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold", settingsActive ? "bg-brand-soft text-ink" : "bg-lilac text-ink")}>{user.name[0]}</span>
        <span className="text-[11px] leading-3 font-medium text-ink-2">{user.name}</span>
      </button>
      {open && (
        <div role="menu" aria-label="Profile" className="pop-in absolute flex w-[300px] flex-col gap-2 max-sm:right-0 max-sm:bottom-[64px] sm:bottom-0 sm:left-[84px] rounded-[24px] glass-strong p-4 shadow-[var(--shadow-pop)]">
          <div className="flex items-center gap-3 px-1 pb-1">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lilac text-base font-bold text-ink">{user.name[0]}</span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[15px] font-semibold text-ink">{user.name}</span>
              {auth.landlord?.email && <span className="truncate text-[13px] text-ink-2">{auth.landlord.email}</span>}
              {role && <span className="self-start rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-ink">{ROLE_LABELS[role]}</span>}
            </span>
          </div>
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
            <SettingsIcon size={16} aria-hidden /> Settings · role and profile
          </button>
          {auth.landlord && (
            <button type="button" role="menuitem" onClick={() => void logOut().then(() => go(paths.dashboard()))} className={cx(ITEM, "text-ink-2")}>
              <LogOut size={16} aria-hidden /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("glass rounded-[28px] p-6 text-sm leading-5 text-ink-2", className)}>
      {title && <h2 className="mb-4 inline-flex title-pill rounded-full glass-strong px-3.5 py-1.5 text-lg leading-6 font-semibold text-ink">{title}</h2>}
      {children}
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
