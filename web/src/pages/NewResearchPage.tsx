import { FileSearch, Lock, Play, Plus, Search, Trash2, type LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { startResearch, type StartRequest } from "../app/research-store"
import { Link, navigate, paths, setSearchParam, useLocation } from "../app/router"
import { BUSINESS_TYPE_LABELS, CURRENCIES, useSettings, type Settings } from "../app/settings"
import { Card } from "../app/Shell"
import type { Config, ProfileInput } from "../types"
import { Pill, cx } from "../ui"
import { INPUT, LABEL } from "./SettingsPage"

type Mode = "evaluate" | "find"
type ListingDraft = { text: string; lease: string; showLease: boolean }
const emptyDraft = (): ListingDraft => ({ text: "", lease: "", showLease: false })

/** The questionnaire as typed (strings), so half-typed numbers are kept while the user edits. */
type ProfileForm = Record<"businessType" | "city" | "currency" | "monthlyBudget" | "expectedMonthlyRevenue" | "areaMinM2" | "areaMaxM2" | "leaseMonths" | "fitOutBudget" | "equipmentBudget" | "grossMarginPercent", string>

const toForm = (p: ProfileInput): ProfileForm => ({
  businessType: p.businessType,
  city: p.city,
  currency: p.currency,
  monthlyBudget: String(p.monthlyBudget),
  expectedMonthlyRevenue: String(p.expectedMonthlyRevenue),
  areaMinM2: String(p.areaMinM2),
  areaMaxM2: String(p.areaMaxM2),
  leaseMonths: String(p.leaseMonths),
  fitOutBudget: String(p.fitOutBudget),
  equipmentBudget: String(p.equipmentBudget),
  grossMarginPercent: p.grossMarginRate === undefined ? "" : String(Math.round(p.grossMarginRate * 100)),
})

const fromSettings = (s: Settings): ProfileForm => ({
  businessType: s.businessType,
  city: s.city,
  currency: s.currency,
  monthlyBudget: s.monthlyBudget === null ? "" : String(s.monthlyBudget),
  expectedMonthlyRevenue: "",
  areaMinM2: "",
  areaMaxM2: "",
  leaseMonths: "36",
  fitOutBudget: "",
  equipmentBudget: "",
  grossMarginPercent: "",
})

const number = (text: string) => (text.trim() === "" ? NaN : Number(text.replace(",", ".")))

/** Checks the form in the browser for quick feedback; the server validates again with the domain rules. */
function profileFromForm(form: ProfileForm): { profile: Partial<ProfileInput> } | { error: string } {
  const required: [keyof ProfileForm, string][] = [
    ["monthlyBudget", "the monthly budget"],
    ["expectedMonthlyRevenue", "the expected monthly revenue"],
    ["areaMinM2", "the minimum area"],
    ["areaMaxM2", "the maximum area"],
    ["leaseMonths", "the lease length"],
    ["fitOutBudget", "the fit-out budget"],
    ["equipmentBudget", "the equipment budget"],
  ]
  for (const [field, label] of required) if (!(number(form[field]) >= 0)) return { error: `Enter ${label} as a number.` }
  if (!form.city.trim()) return { error: "Enter the city." }
  const margin = number(form.grossMarginPercent)
  if (form.grossMarginPercent.trim() && !(margin > 0 && margin <= 100)) return { error: "The gross margin is a percentage between 1 and 100, or empty." }
  return {
    profile: {
      businessType: form.businessType as ProfileInput["businessType"],
      description: BUSINESS_TYPE_LABELS[form.businessType as ProfileInput["businessType"]],
      city: form.city.trim(),
      currency: form.currency as ProfileInput["currency"],
      monthlyBudget: number(form.monthlyBudget),
      expectedMonthlyRevenue: number(form.expectedMonthlyRevenue),
      areaMinM2: number(form.areaMinM2),
      areaMaxM2: number(form.areaMaxM2),
      leaseMonths: number(form.leaseMonths),
      fitOutBudget: number(form.fitOutBudget),
      equipmentBudget: number(form.equipmentBudget),
      ...(form.grossMarginPercent.trim() ? { grossMarginRate: margin / 100 } : {}),
    },
  }
}

export function NewResearchPage({ config }: { config: Config | null }) {
  const { search } = useLocation()
  const mode: Mode = search.get("mode") === "find" ? "find" : "evaluate"
  const settings = useSettings()
  const [demoProfile, setDemoProfile] = useState<ProfileInput | null>(null)
  const [form, setForm] = useState<ProfileForm>(() => fromSettings(settings))
  const [drafts, setDrafts] = useState<ListingDraft[]>([emptyDraft()])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/demo-questionnaire")
      .then((response) => response.json() as Promise<{ profile: ProfileInput }>)
      .then((body) => setDemoProfile(body.profile))
      .catch(() => setDemoProfile(null))
  }, [])

  const liveAvailable = Boolean(config?.liveAvailable)
  // Mode B runs on the synthetic demo listings with the fixed demo profile; mode A needs live mode.
  const profileLocked = mode === "find" || !liveAvailable
  const shownForm = profileLocked && demoProfile ? toForm(demoProfile) : form
  const maxListings = config?.maxListings ?? 8
  const filledDrafts = drafts.filter((d) => d.text.trim())
  const accessCodeMissing = Boolean(config?.liveNeedsAccessCode) && !settings.liveAccessCode

  const start = async (request: StartRequest, accessCode?: string) => {
    setError(null)
    setStarting(true)
    try {
      navigate(paths.run(await startResearch(request, accessCode)))
    } catch (failure) {
      setError((failure as Error).message)
      setStarting(false)
    }
  }

  const runEvaluate = () => {
    const checked = profileFromForm(form)
    if ("error" in checked) return setError(checked.error)
    void start({ mode: "live", source: "pasted", profile: checked.profile, listings: filledDrafts.map((d) => ({ text: d.text, ...(d.lease.trim() ? { lease: d.lease } : {}) })) }, settings.liveAccessCode)
  }

  const updateDraft = (index: number, patch: Partial<ListingDraft>) => setDrafts(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Research mode" className="grid gap-3 md:grid-cols-2">
        <ModeTab active={mode === "evaluate"} icon={FileSearch} title="Evaluate a space" text="Paste 1 to 8 listings you are considering" onSelect={() => setSearchParam("mode", "evaluate")} />
        <ModeTab active={mode === "find"} icon={Search} title="Find spaces" text="SuiteSpot brings the candidates" onSelect={() => setSearchParam("mode", "find")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card title="Your business">
          {profileLocked ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Pill variant="brand" icon={false}>
                <span className="inline-flex items-center gap-1">
                  <Lock size={12} aria-hidden /> Demo profile
                </span>
              </Pill>
              <span className="text-[13px] text-ink-2">
                {mode === "find" ? "Find spaces runs on synthetic demo listings with this fixed profile." : "Demo runs use this fixed profile."} Your own profile is used in live
                mode.
              </span>
            </div>
          ) : (
            <p className="mb-4">Prefilled from your Settings. Every number you give here is shown as "your questionnaire" next to the results.</p>
          )}
          <ProfileFields form={shownForm} locked={profileLocked} onChange={(patch) => setForm({ ...form, ...patch })} />
        </Card>

        {mode === "find" ? (
          <Card title="Find spaces">
            <p>
              SuiteSpot evaluates 8 synthetic commercial listings in Novi Sad and 3 lease drafts. Live search of listing sites is off: we only read a site that has given
              written permission.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Pill variant="brand" icon={false}>
                Demo data
              </Pill>
              <Pill icon={false}>8 listings</Pill>
              <Pill icon={false}>3 lease drafts</Pill>
              <Pill icon={false}>no API key</Pill>
            </div>
            <button
              type="button"
              onClick={() => void start({ source: "demo" })}
              disabled={starting}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-50"
            >
              <Play size={16} strokeWidth={2} aria-hidden /> {starting ? "Starting..." : "Run the research"}
            </button>
            {error && (
              <p role="alert" className="mt-3 text-[13px] text-hard">
                {error}
              </p>
            )}
          </Card>
        ) : (
          <Card title="Listings">
            {!liveAvailable && (
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] bg-white/70 px-4 py-3">
                <Lock size={16} className="text-ink" aria-hidden />
                <span className="font-medium text-ink">Available in live mode</span>
                <span className="text-[13px]">Reading pasted listings needs a model ({config?.liveModel ?? "claude-haiku-4-5"}). This server runs the keyless demo.</span>
                <Link to={`${paths.newResearch()}?mode=find`} className="text-[13px] font-medium text-ink underline">
                  Run the demo instead
                </Link>
              </div>
            )}
            <p className="mb-3 text-[13px]">1 to {maxListings} listings, pasted as text. SuiteSpot never opens listing sites. Phone numbers and emails are removed before anything is stored.</p>
            <fieldset disabled={!liveAvailable} className="flex flex-col gap-3 disabled:opacity-60">
              {drafts.map((draft, index) => (
                <div key={index} className="glass-strong rounded-[24px] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor={`listing-${index}`} className="text-xs font-medium text-ink">
                      Listing {index + 1}
                    </label>
                    {drafts.length > 1 && (
                      <button type="button" onClick={() => setDrafts(drafts.filter((_, i) => i !== index))} aria-label={`Remove listing ${index + 1}`} className="rounded-full p-1 text-ink-3 hover:bg-white hover:text-ink">
                        <Trash2 size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                  <textarea id={`listing-${index}`} rows={4} value={draft.text} onChange={(e) => updateDraft(index, { text: e.target.value })} placeholder="Paste the full text of the listing" className={cx(INPUT, "h-auto py-3")} />
                  {draft.showLease ? (
                    <textarea rows={3} value={draft.lease} onChange={(e) => updateDraft(index, { lease: e.target.value })} placeholder="Paste the lease draft (optional)" className={cx(INPUT, "mt-2 h-auto py-3")} aria-label={`Lease draft for listing ${index + 1}`} />
                  ) : (
                    <button type="button" onClick={() => updateDraft(index, { showLease: true })} className="mt-2 text-xs font-medium text-ink hover:underline">
                      Add lease draft
                    </button>
                  )}
                </div>
              ))}
            </fieldset>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setDrafts([...drafts, emptyDraft()])}
                disabled={!liveAvailable || drafts.length >= maxListings}
                className="inline-flex h-10 items-center gap-2 rounded-full glass-strong px-[18px] text-sm font-medium text-ink hover:bg-white disabled:opacity-50"
              >
                <Plus size={16} aria-hidden /> Add listing
              </button>
              <button
                type="button"
                onClick={runEvaluate}
                disabled={!liveAvailable || starting || filledDrafts.length === 0 || accessCodeMissing}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-40"
              >
                <Play size={16} aria-hidden /> {starting ? "Starting..." : `Evaluate ${filledDrafts.length || ""} listing${filledDrafts.length === 1 ? "" : "s"}`}
              </button>
              {liveAvailable && accessCodeMissing && (
                <span className="text-[13px]">
                  Live mode needs an access code.{" "}
                  <Link to={paths.settings()} className="font-medium text-ink underline">
                    Enter it in Settings
                  </Link>
                </span>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-3 text-[13px] text-hard">
                {error}
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

function ModeTab({ active, icon: Icon, title, text, onSelect }: { active: boolean; icon: LucideIcon; title: string; text: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cx("flex items-center gap-4 rounded-[24px] p-4 text-left", active ? "bg-white shadow-[var(--shadow-soft)] ring-2 ring-brand" : "glass-strong hover:bg-white")}
    >
      <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", active ? "bg-brand text-ink" : "bg-white text-ink")}>
        <Icon size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <span>
        <span className="block text-base font-semibold text-ink">{title}</span>
        <span className="block text-[13px] text-ink-2">{text}</span>
      </span>
    </button>
  )
}

function ProfileFields({ form, locked, onChange }: { form: ProfileForm; locked: boolean; onChange: (patch: Partial<ProfileForm>) => void }) {
  const field = (key: keyof ProfileForm, label: string, unit?: string, placeholder?: string) => (
    <label>
      <span className={LABEL}>
        {label}
        {unit && <span className="font-normal text-ink-3"> ({unit})</span>}
      </span>
      <input value={form[key]} onChange={(e) => onChange({ [key]: e.target.value })} disabled={locked} inputMode="decimal" placeholder={placeholder} className={cx(INPUT, "tnum")} />
    </label>
  )
  return (
    <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className={LABEL}>Business type</span>
        <select value={form.businessType} onChange={(e) => onChange({ businessType: e.target.value })} className={INPUT}>
          {Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={LABEL}>City</span>
        <input value={form.city} onChange={(e) => onChange({ city: e.target.value })} className={INPUT} />
      </label>
      <label>
        <span className={LABEL}>Currency</span>
        <select value={form.currency} onChange={(e) => onChange({ currency: e.target.value })} className={INPUT}>
          {CURRENCIES.map((currency) => (
            <option key={currency}>{currency}</option>
          ))}
        </select>
      </label>
      {field("monthlyBudget", "Monthly budget for the space", form.currency)}
      {field("expectedMonthlyRevenue", "Expected monthly revenue", form.currency)}
      {field("areaMinM2", "Area from", "m²")}
      {field("areaMaxM2", "Area to", "m²")}
      {field("leaseMonths", "Lease length", "months")}
      {field("grossMarginPercent", "Gross margin", "%, optional", locked ? "not given" : "")}
      {field("fitOutBudget", "Fit-out budget", form.currency)}
      {field("equipmentBudget", "Equipment budget", form.currency)}
    </fieldset>
  )
}
