import { Check } from "lucide-react"
import { useState, type FormEvent } from "react"
import { ROLES, updateOnboarding, useAuth, type Role } from "../app/auth"
import { ROLE_LABELS, seeksSpaces } from "../app/roles"
import { cx } from "../ui"
import { checkProfileFields, toProfileFields, type ProfileFields, type ProfileProblems } from "../app/business-profile"
import { CURRENCIES, saveSettings, useSettings, type Currency } from "../app/settings"
import { BusinessProfileFields, FieldBox } from "./BusinessProfileFields"
import { Card } from "../app/Shell"

export const INPUT = "h-11 w-full rounded-[16px] border border-white/80 bg-white/85 px-4 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-white/50 disabled:text-ink-2"
export const LABEL = "mb-1.5 block text-xs font-medium text-ink"

export function SettingsPage() {
  const saved = useSettings()
  const auth = useAuth()
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
    <div className="flex flex-col gap-4">
      <RoleSettings />
      {/* The business profile is for finding a space; a space owner only does not see it. */}
      {seeksSpaces(auth.landlord?.role ?? null) && (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Card title="Business profile">
            <p className="mb-4">Prefills the questionnaire for your research. Without an AI model key on the server, runs use the fixed demo profile.</p>
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
                  <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={INPUT}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </FieldBox>
              }
            />
          </Card>
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
      )}
    </div>
  )
}

const ROLE_HINTS: Record<Role, string> = {
  owner: "You list spaces and answer offers.",
  seeker: "You research spaces for your business.",
  both: "You list spaces and research them.",
}

/** The role from the onboarding; it changes the menu at once and is saved on the account. */
function RoleSettings() {
  const auth = useAuth()
  const current = auth.landlord?.role ?? null
  const [busy, setBusy] = useState<Role | null>(null)
  const [status, setStatus] = useState<"idle" | "saved" | string>("idle")
  const choose = async (role: Role) => {
    if (role === current) return
    setBusy(role)
    setStatus("idle")
    try {
      await updateOnboarding({ role })
      setStatus("saved")
    } catch (failure) {
      setStatus((failure as Error).message)
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card title="How you use SuiteSpot">
      <p className="mb-4">Decides what the menu shows. Saved on your account.</p>
      <div role="radiogroup" aria-label="How you use SuiteSpot" className="grid gap-2 sm:grid-cols-3">
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={current === role}
            disabled={busy !== null}
            onClick={() => void choose(role)}
            className={cx(
              "flex items-center justify-between gap-3 rounded-[18px] px-4 py-3 text-left",
              current === role ? "bg-brand-soft text-ink" : "glass-strong text-ink hover:bg-white",
            )}
          >
            <span>
              <span className="block text-sm font-semibold">{ROLE_LABELS[role]}</span>
              <span className={cx("block text-[13px]", current === role ? "text-ink" : "text-ink-2")}>{ROLE_HINTS[role]}</span>
            </span>
            {current === role && <Check size={18} aria-hidden />}
          </button>
        ))}
      </div>
      <p role="status" className="mt-3 min-h-5 text-[13px]">
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
