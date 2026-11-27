import { Bookmark, Building2, CircleHelp, History, House, Info, LayoutList, LogOut, Plus, Search, Settings as SettingsIcon, type LucideIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { cx } from "../ui"
import { logOut, useAuth } from "./auth"
import { ROLE_LABELS } from "./roles"
import { Link, navigate, paths, useLocation, type Route } from "./router"

/** label: under the icon (the rail is narrow); name: the full name for the tooltip and screen readers. */
type NavItem = { label: string; name: string; to: string; icon: LucideIcon; isActive: (route: Route) => boolean }

const NAV_ITEMS: NavItem[] = [
  { label: "Home", name: "Home", to: paths.dashboard(), icon: House, isActive: (r) => r.name === "dashboard" },
  { label: "Research", name: "Research: find spaces or evaluate one", to: paths.findSpaces(), icon: Search, isActive: (r) => r.name === "newResearch" },
  { label: "Listings", name: "Listings", to: paths.listings(), icon: Building2, isActive: (r) => r.name === "listings" || r.name === "listing" },
  { label: "History", name: "History", to: paths.history(), icon: History, isActive: (r) => r.name === "history" || r.name === "run" || r.name === "results" || r.name === "candidate" },
]

export const NOT_ADVICE = "Not financial or legal advice. SuiteSpot shows numbers with their sources; the decision is yours."

/**
 * The frame around every page: sidebar (a bottom bar on a phone, so pages keep the full width), page header (title,
 * optional pills, New research) and the advice footer.
 */
export function Shell({ route, title, titleExtra, children }: { route: Route; title: string; titleExtra?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 pb-28 text-ink sm:pr-6 sm:pb-6 sm:pl-[116px]">
      <Sidebar route={route} />
      <div className="mx-auto max-w-[1360px] pt-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-[34px] font-semibold tracking-[-0.01em]">
            {title}
            {titleExtra}
          </h1>
          {route.name !== "newResearch" && (
            <Link to={paths.newResearch()} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]">
              <Plus size={16} strokeWidth={2} aria-hidden /> New research
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
  return (
    <aside
      className="fixed z-30 flex items-center glass-strong max-sm:inset-x-3 max-sm:bottom-3 max-sm:h-[68px] max-sm:justify-around max-sm:rounded-[28px] max-sm:px-1 sm:top-4 sm:bottom-4 sm:left-4 sm:w-[88px] sm:flex-col sm:rounded-[32px] sm:py-5"
      aria-label="Main"
    >
      <Link to={paths.dashboard()} className="mb-4 flex h-14 w-14 items-center justify-center max-sm:hidden" aria-label="SuiteSpot home" title="SuiteSpot">
        <img src="/suitespot-logo.svg" alt="SuiteSpot" width={56} height={56} className="h-14 w-14" />
      </Link>
      <nav className="flex flex-col items-center gap-2.5 max-sm:contents">
        {NAV_ITEMS.map((item) => {
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
  const ITEM = "flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left text-sm font-medium text-ink hover:bg-white"

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
        <div role="menu" className="pop-in absolute w-[220px] max-sm:right-0 max-sm:bottom-[64px] sm:bottom-0 sm:left-[84px] rounded-[20px] glass-strong p-2 shadow-[var(--shadow-pop)]">
          <div className="px-3 pt-2 pb-2.5">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            {auth.landlord?.email && <p className="truncate text-xs text-ink-2">{auth.landlord.email}</p>}
            {auth.landlord?.role && (
              <span className="mt-2 inline-flex h-6 items-center rounded-full bg-brand-50 px-2.5 text-xs font-medium text-ink">{ROLE_LABELS[auth.landlord.role]}</span>
            )}
          </div>
          <button type="button" role="menuitem" onClick={() => go(paths.mySpaces())} className={ITEM}>
            <Bookmark size={16} aria-hidden /> My spaces
          </button>
          <button type="button" role="menuitem" onClick={() => go(paths.myListings())} className={ITEM}>
            <LayoutList size={16} aria-hidden /> My listings
          </button>
          <button type="button" role="menuitem" onClick={() => go(paths.newListing())} className={ITEM}>
            <Plus size={16} aria-hidden /> List a space
          </button>
          <button type="button" role="menuitem" onClick={() => go(paths.howItWorks())} className={ITEM}>
            <CircleHelp size={16} aria-hidden /> How it works
          </button>
          <button type="button" role="menuitem" onClick={() => go(paths.settings())} className={ITEM}>
            <SettingsIcon size={16} aria-hidden /> Settings
          </button>
          {auth.landlord && (
            <button type="button" role="menuitem" onClick={() => void logOut().then(() => go(paths.dashboard()))} className={ITEM}>
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
