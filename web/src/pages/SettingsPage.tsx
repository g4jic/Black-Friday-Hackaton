import { Check } from "lucide-react"
import { useState, type FormEvent } from "react"
import { ROLES, updateOnboarding, useAuth, type Role } from "../app/auth"
import { ROLE_LABELS } from "../app/roles"
import { cx } from "../ui"
import { BUSINESS_TYPE_LABELS, CURRENCIES, saveSettings, useSettings, type BusinessType, type Currency, type Settings } from "../app/settings"
import { Card } from "../app/Shell"

export const INPUT = "h-11 w-full rounded-[16px] border border-white/80 bg-white/85 px-4 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-white/50 disabled:text-ink-2"
export const LABEL = "mb-1.5 block text-xs font-medium text-ink"

export function SettingsPage() {
  const saved = useSettings()
  const [draft, setDraft] = useState<Settings>(saved)
  const [budgetText, setBudgetText] = useState(saved.monthlyBudget === null ? "" : String(saved.monthlyBudget))
  const [status, setStatus] = useState<"idle" | "saved" | "notStored" | "invalid">("idle")

  const change = (patch: Partial<Settings>) => {
    setDraft({ ...draft, ...patch })
    setStatus("idle")
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const budget = budgetText.trim() === "" ? null : Number(budgetText.replace(",", "."))
    if (budget !== null && !(budget > 0)) {
      setStatus("invalid")
      return
    }
    const stored = saveSettings({ ...draft, city: draft.city.trim(), monthlyBudget: budget })
    setStatus(stored ? "saved" : "notStored")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <RoleSettings />
      </div>
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <Card title="Default business profile">
          <p className="mb-4">Used to prefill the questionnaire. Without an AI model key on the server, runs use the fixed demo profile.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={LABEL}>Business type</span>
              <select value={draft.businessType} onChange={(e) => change({ businessType: e.target.value as BusinessType })} className={INPUT}>
                {Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={LABEL}>City</span>
              <input value={draft.city} onChange={(e) => change({ city: e.target.value })} className={INPUT} placeholder="Novi Sad" />
            </label>
            <label>
              <span className={LABEL}>Monthly budget for the space</span>
              <input
                value={budgetText}
                onChange={(e) => {
                  setBudgetText(e.target.value)
                  setStatus("idle")
                }}
                inputMode="decimal"
                className={`${INPUT} tnum`}
                placeholder="1500"
                aria-invalid={status === "invalid"}
              />
            </label>
            <label>
              <span className={LABEL}>Currency</span>
              <select value={draft.currency} onChange={(e) => change({ currency: e.target.value as Currency })} className={INPUT}>
                {CURRENCIES.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </label>
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button type="submit" className="inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]">
            Save settings
          </button>
          <span role="status" className="text-[13px] text-ink-2">
            {status === "saved" && (
              <span className="inline-flex items-center gap-1.5 text-green-700">
                <Check size={16} aria-hidden /> Saved in this browser.
              </span>
            )}
            {status === "notStored" && "Saved for this visit only: the browser does not allow storing settings."}
            {status === "invalid" && <span className="text-hard">The budget must be a positive number.</span>}
          </span>
        </div>
      </form>
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
      <div role="radiogroup" aria-label="How you use SuiteSpot" className="flex flex-col gap-2">
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
