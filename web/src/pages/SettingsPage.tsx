import { Check } from "lucide-react"
import { useState, type FormEvent } from "react"
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
    const stored = saveSettings({ ...draft, city: draft.city.trim(), liveAccessCode: draft.liveAccessCode.trim(), monthlyBudget: budget })
    setStatus(stored ? "saved" : "notStored")
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
      <Card title="Default business profile">
        <p className="mb-4">Used to prefill the questionnaire. Demo runs (on a server without an AI model key, or without the access code) use the fixed demo profile.</p>
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
      <Card title="Access code">
        <p className="mb-4">
          Runs with the real model cost money, so a hosted server may ask for an access code. You only need it if the server asks for one. The code
          is kept only in this browser.
        </p>
        <label>
          <span className={LABEL}>Access code</span>
          <input type="password" autoComplete="off" value={draft.liveAccessCode} onChange={(e) => change({ liveAccessCode: e.target.value })} className={INPUT} />
        </label>
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
  )
}
