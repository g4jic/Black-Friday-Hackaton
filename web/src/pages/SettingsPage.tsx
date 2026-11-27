import { ArrowRight, Building2, Check, Layers, LogOut, Search, type LucideIcon } from "lucide-react"
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { logOut, ROLES, updateOnboarding, useAuth, type Role } from "../app/auth"
import { checkProfileFields, toProfileFields, type ProfileFields, type ProfileProblems } from "../app/business-profile"
import { listsSpaces, ROLE_LABELS, seeksSpaces } from "../app/roles"
import { Link, navigate, paths } from "../app/router"
import { CURRENCIES, saveSettings, useSettings, type Currency } from "../app/settings"
import { Card } from "../app/Shell"
import { listingsApi, useLoad } from "../listings/listings-api"
import { Select } from "../Select"
import { cx } from "../ui"
import { BusinessProfileFields, FieldBox } from "./BusinessProfileFields"

export const INPUT =
  "h-11 w-full rounded-[16px] border border-white/80 bg-white/85 px-4 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-white/50 disabled:text-ink-2"
export const LABEL = "mb-1.5 block text-xs font-medium text-ink"
const SECONDARY = "inline-flex h-10 items-center gap-2 rounded-full glass-strong px-[18px] text-sm font-medium text-ink hover:bg-white"

/**
 * Settings as a column of glass sections that collapse (remembered for the session): the account, how the user uses
 * SuiteSpot (the role), the business profile (seeker and both) and the user's spaces (owner and both). Only things
 * that work today; nothing here is a placeholder.
 */
export function SettingsPage() {
  const role = useAuth().landlord?.role ?? null
  return (
    <div className="flex max-w-[960px] flex-col gap-4">
      <AccountSection />
      <RoleSection />
      {seeksSpaces(role) && <BusinessProfileSection />}
      {listsSpaces(role) && <YourSpacesSection />}
    </div>
  )
}

function AccountSection() {
  const account = useAuth().landlord
  const name = account?.displayName ?? "Account"
  return (
    <Card title="Account" collapsible id="settings-account">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lilac text-lg font-semibold text-ink">{name[0]}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-ink">{name}</span>
          {account?.email && <span className="truncate text-[13px] text-ink-2">{account.email}</span>}
        </span>
        <button type="button" onClick={() => void logOut().then(() => navigate(paths.dashboard()))} className={SECONDARY}>
          <LogOut size={16} aria-hidden /> Sign out
        </button>
      </div>
    </Card>
  )
}

const ROLE_ICONS: Record<Role, LucideIcon> = { owner: Building2, seeker: Search, both: Layers }
const ROLE_MEANING: Record<Role, string> = {
  owner: "You list spaces, see how many people opened them and answer offers. Research is hidden.",
  seeker: "You research spaces for your business, save them and make offers. Listing a space is hidden.",
  both: "You list your own spaces and research others: the menu shows both.",
}

/** The role as a segmented control of three pills (a radio group: arrow keys move and choose). Saved on the account at once. */
function RoleSection() {
  const current = useAuth().landlord?.role ?? null
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<"idle" | "saved" | string>("idle")
  const pills = useRef<(HTMLButtonElement | null)[]>([])

  const choose = async (role: Role) => {
    if (role === current || busy) return
    setBusy(true)
    setStatus("idle")
    try {
      await updateOnboarding({ role })
      setStatus("saved")
    } catch (failure) {
      setStatus((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
    if (!step) return
    event.preventDefault()
    const at = Math.max(0, ROLES.indexOf(current ?? "both"))
    const next = ROLES[(at + step + ROLES.length) % ROLES.length]!
    pills.current[ROLES.indexOf(next)]?.focus()
    void choose(next)
  }

  return (
    <Card title="How you use SuiteSpot" collapsible id="settings-role">
      <div role="radiogroup" aria-label="How you use SuiteSpot" onKeyDown={onKeyDown} className="inline-flex flex-wrap gap-1 rounded-full glass-strong p-1">
        {ROLES.map((role, i) => {
          const Icon = ROLE_ICONS[role]
          const on = current === role
          return (
            <button
              key={role}
              ref={(el) => {
                pills.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (current === null && i === 0) ? 0 : -1}
              disabled={busy && !on}
              onClick={() => void choose(role)}
              className={cx("inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium", on ? "bg-ink text-white" : "text-ink hover:bg-white")}
            >
              <Icon size={16} aria-hidden /> {ROLE_LABELS[role]}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[13px] text-ink-2">{current ? ROLE_MEANING[current] : "Choose how you use SuiteSpot."}</p>
      <p role="status" className="mt-1 min-h-5 text-[13px]">
        {status === "saved" ? (
          <span className="inline-flex items-center gap-1.5 text-green-700">
            <Check size={16} aria-hidden /> Saved on your account.
          </span>
        ) : status !== "idle" ? (
          <span className="text-hard">{status}</span>
        ) : null}
      </p>
    </Card>
  )
}

function BusinessProfileSection() {
  const saved = useSettings()
  const [fields, setFields] = useState<ProfileFields>(() => toProfileFields(saved))
  const [currency, setCurrency] = useState<Currency>(saved.currency)
  const [problems, setProblems] = useState<ProfileProblems>({})
  const [status, setStatus] = useState<"idle" | "saved" | "notStored" | "invalid">("idle")

  const submit = (event: FormEvent) => {
    event.preventDefault()
    // The same rules as the domain; an empty field may stay empty here (the questionnaire asks for it later).
    const checked = checkProfileFields(fields, { requireAll: false })
    if ("problems" in checked) {
      setProblems(checked.problems)
      return setStatus("invalid")
    }
    setProblems({})
    setStatus(saveSettings({ ...checked.profile, currency }) ? "saved" : "notStored")
  }

  return (
    <Card title="Business profile" collapsible id="settings-profile">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p>Prefills the questionnaire for your research. Without an AI model key on the server, runs use the fixed demo profile.</p>
        <BusinessProfileFields
          fields={fields}
          set={(patch) => {
            setFields({ ...fields, ...patch })
            setStatus("idle")
          }}
          problems={problems}
          currency={currency}
          extra={
            <FieldBox label="Currency">
              <Select value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} className={INPUT} />
            </FieldBox>
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]">
            Save profile
          </button>
          <span role="status" className="text-[13px] text-ink-2">
            {status === "saved" && (
              <span className="inline-flex items-center gap-1.5 text-green-700">
                <Check size={16} aria-hidden /> Saved in this browser.
              </span>
            )}
            {status === "notStored" && "Saved for this visit only: the browser does not allow storing settings."}
            {status === "invalid" && <span className="text-hard">Check the marked fields.</span>}
          </span>
        </div>
      </form>
    </Card>
  )
}

function YourSpacesSection() {
  const { data, error } = useLoad("my-listings", listingsApi.mine)
  const count = data?.length
  return (
    <Card title="Your spaces" collapsible id="settings-spaces" count={count}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          {error
            ? error
            : count === undefined
              ? "Loading..."
              : count === 0
                ? "You have not listed a space yet."
                : `You have ${count} published ${count === 1 ? "space" : "spaces"} on SuiteSpot.`}
        </p>
        <Link to={paths.myListings()} className={SECONDARY}>
          Open My listings <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </Card>
  )
}
