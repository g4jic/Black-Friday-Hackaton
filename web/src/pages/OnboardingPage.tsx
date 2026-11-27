import { ArrowRight, Building2, LogOut, Search, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { logOut, updateOnboarding, useAuth, type Role } from "../app/auth"
import { cx } from "../ui"

/**
 * The onboarding after sign up (and after a sign in while it is not finished): the welcome veil fades into this
 * screen instead of the app. The user picks how they use SuiteSpot; the choice is saved on the account (Supabase
 * user_metadata, or the local account file) and shapes the menu. App.tsx shows this screen until the onboarding is
 * done, then sends the user on to the page they wanted.
 */
export function OnboardingPage() {
  const auth = useAuth()
  const [busy, setBusy] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = async (role: Role) => {
    setError(null)
    setBusy(role)
    try {
      await updateOnboarding({ role, onboarded: true })
    } catch (failure) {
      setError((failure as Error).message)
      setBusy(null)
    }
  }

  return (
    <div className="onb-shell flex min-h-dvh flex-col px-4 py-6 text-ink sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <img src="/suitespot-logo.svg" alt="" width={36} height={36} />
          <span className="text-xl font-semibold">SuiteSpot</span>
        </span>
        <button
          type="button"
          onClick={() => void logOut()}
          className="inline-flex h-10 items-center gap-2 rounded-full glass-strong px-4 text-sm font-medium text-ink hover:bg-white"
        >
          <LogOut size={16} aria-hidden /> Sign out
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col items-center justify-center py-10">
        <h1 className="onb-enter text-center text-[34px] leading-tight font-semibold">
          {auth.landlord?.displayName ? `Welcome, ${auth.landlord.displayName}` : "Welcome to SuiteSpot"}
        </h1>
        <p className="onb-enter mt-2 text-center text-sm text-ink-2" style={{ animationDelay: "60ms" }}>
          How will you use SuiteSpot? You can change this later in Settings.
        </p>

        <div className="mt-10 grid w-full gap-4 md:grid-cols-2">
          <RoleCard
            icon={Building2}
            title="List my space"
            text="You rent out or sell a commercial space. Publish it and answer offers from businesses."
            busy={busy === "owner"}
            disabled={busy !== null}
            delay={120}
            onChoose={() => void choose("owner")}
          />
          <RoleCard
            icon={Search}
            title="Find a space"
            text="You are looking for a space for your business. SuiteSpot finds the spaces that fit and checks the numbers."
            busy={busy === "seeker"}
            disabled={busy !== null}
            delay={180}
            onChoose={() => void choose("seeker")}
          />
        </div>

        <button
          type="button"
          onClick={() => void choose("both")}
          disabled={busy !== null}
          className="onb-enter mt-6 rounded-full px-3 py-1.5 text-sm font-medium text-ink underline underline-offset-4 hover:bg-white/60 disabled:opacity-50"
          style={{ animationDelay: "240ms" }}
        >
          {busy === "both" ? "Saving..." : "I do both"}
        </button>

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-hard">
            {error}
          </p>
        )}
      </main>

      <footer className="text-center text-xs text-ink-2">© 2026 SuiteSpot · Not financial or legal advice</footer>
    </div>
  )
}

function RoleCard({
  icon: Icon,
  title,
  text,
  busy,
  disabled,
  delay,
  onChoose,
}: {
  icon: LucideIcon
  title: string
  text: string
  busy: boolean
  disabled: boolean
  delay: number
  onChoose: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      className={cx(
        "onb-enter group flex min-h-[220px] flex-col items-start rounded-[28px] glass p-7 text-left hover:bg-white/90 disabled:cursor-default",
        busy && "bg-white ring-2 ring-brand",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-ink">
        <Icon size={24} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="mt-6 text-xl leading-7 font-semibold tracking-[-0.015em] text-ink">{title}</span>
      <span className="mt-2 text-sm leading-5 text-ink-2">{text}</span>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-medium text-ink">
        {busy ? "Saving..." : "Continue"}
        <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </span>
    </button>
  )
}
