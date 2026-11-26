import { Building2, FileSearch, Lock, Play, Search, type LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { StartError, startResearch, type StartRequest } from "../app/research-store"
import { EMPTY_LISTING_FORM, FIELD_NAMES, ListingTermsFields, toInput, type Form as ListingForm } from "../listings/ListingFormPage"
import { Link, navigate, paths, setSearchParam, useLocation } from "../app/router"
import { BUSINESS_TYPE_LABELS, CURRENCIES, useSettings, type Settings } from "../app/settings"
import { Card } from "../app/Shell"
import type { Config, ProfileInput } from "../types"
import { Pill, cx } from "../ui"
import { INPUT, LABEL } from "./SettingsPage"
import { floorLabel, listingsApi, useLoad } from "../listings/listings-api"
import { formatMoney } from "../format"

type Mode = "evaluate" | "find"

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
  // "Evaluate for my business" on a listing page: evaluate that one SuiteSpot listing.
  const listingId = mode === "evaluate" ? search.get("listing") : null
  const settings = useSettings()
  const [demoProfile, setDemoProfile] = useState<ProfileInput | null>(null)
  const [form, setForm] = useState<ProfileForm>(() => fromSettings(settings))
  const [problems, setProblems] = useState<{ field: string; message: string }[]>([])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/demo-questionnaire")
      .then((response) => response.json() as Promise<{ profile: ProfileInput }>)
      .then((body) => setDemoProfile(body.profile))
      .catch(() => setDemoProfile(null))
  }, [])

  const liveAvailable = Boolean(config?.liveAvailable)
  // Without live mode every run uses the fixed demo profile (the scripted answers were made for it).
  const profileLocked = !liveAvailable
  const shownForm = profileLocked && demoProfile ? toForm(demoProfile) : form
  const accessCodeMissing = Boolean(config?.liveNeedsAccessCode) && !settings.liveAccessCode

  const start = async (request: StartRequest, accessCode?: string) => {
    setError(null)
    setProblems([])
    setStarting(true)
    try {
      navigate(paths.run(await startResearch(request, accessCode)))
    } catch (failure) {
      setError((failure as Error).message)
      if (failure instanceof StartError) setProblems(failure.problems)
      setStarting(false)
    }
  }

  /** Live runs on SuiteSpot listings use the questionnaire as typed; demo runs use the demo profile. */
  const startOnCatalogue = (request: { source: "search" } | { source: "listing"; listingId: string }) => {
    if (!liveAvailable) return void start(request.source === "search" ? { source: "demo" } : request)
    const checked = profileFromForm(form)
    if ("error" in checked) return setError(checked.error)
    void start({ mode: "live", ...request, profile: checked.profile }, settings.liveAccessCode)
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Research mode" className="grid gap-3 md:grid-cols-2">
        <ModeTab active={mode === "evaluate"} icon={FileSearch} title="Evaluate an outside listing" text="A space you found elsewhere: type in its terms" onSelect={() => setSearchParam("mode", "evaluate")} />
        <ModeTab active={mode === "find"} icon={Search} title="Find spaces" text="SuiteSpot finds the spaces that fit" onSelect={() => setSearchParam("mode", "find")} />
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
                Without an AI model key on the server, runs use this fixed profile.
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
              SuiteSpot searches every space published on SuiteSpot for the ones that fit your city, area, budget and type of business. The agents then evaluate the
              best matches at the same time, and every number shows its source.
            </p>
            {!liveAvailable && <NoKeyNotice />}
            <button
              type="button"
              onClick={() => startOnCatalogue({ source: "search" })}
              disabled={starting || (liveAvailable && accessCodeMissing)}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-50"
            >
              <Play size={16} strokeWidth={2} aria-hidden /> {starting ? "Starting..." : "Search and evaluate"}
            </button>
            {error && (
              <p role="alert" className="mt-3 text-[13px] text-hard">
                {error}
              </p>
            )}
          </Card>
        ) : listingId ? (
          <ListingToEvaluate listingId={listingId} liveAvailable={liveAvailable} starting={starting} error={error} blocked={liveAvailable && accessCodeMissing} onStart={() => startOnCatalogue({ source: "listing", listingId })} />
        ) : (
          <OutsideListingForm
            liveAvailable={liveAvailable}
            starting={starting}
            accessCodeMissing={accessCodeMissing}
            onStart={(outside) => {
              const checked = profileFromForm(form)
              if ("error" in checked) return setError(checked.error)
              void start({ mode: "live", source: "outside", outside, profile: checked.profile }, settings.liveAccessCode)
            }}
            error={error}
            problems={problems}
          />
        )}
      </div>
    </div>
  )
}

/** The SuiteSpot listing chosen with "Evaluate for my business". Without live mode only a demo listing can run. */
function ListingToEvaluate({ listingId, liveAvailable, starting, error, blocked, onStart }: { listingId: string; liveAvailable: boolean; starting: boolean; error: string | null; blocked: boolean; onStart: () => void }) {
  const loaded = useLoad(listingId, () => listingsApi.get(listingId))
  const listing = loaded.data
  const canRun = Boolean(listing) && (liveAvailable || Boolean(listing?.isDemo))
  return (
    <Card title="Listing to evaluate">
      {loaded.error ? (
        <p role="alert" className="text-[13px] text-hard">
          This listing could not be loaded ({loaded.error}).
        </p>
      ) : !listing ? (
        <p className="text-[13px]">Loading the listing...</p>
      ) : (
        <div className="glass-strong flex items-start gap-3 rounded-[24px] p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink">
            <Building2 size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={paths.listing(listing.id)} className="font-semibold text-ink hover:underline">
                {listing.title}
              </Link>
              {listing.isDemo && (
                <Pill variant="brand" icon={false}>
                  Demo listing
                </Pill>
              )}
            </div>
            <p className="tnum mt-1 text-[13px]">
              {listing.district}, {listing.city} · {listing.areaM2} m² · {floorLabel(listing.floor)} · {formatMoney(listing.rentMonthly, "EUR")} rent +{" "}
              {formatMoney(listing.serviceChargeMonthly, "EUR")} costs a month
            </p>
            <p className="mt-1 text-[13px]">{listing.leaseDraft ? "Has a lease draft: the Lease reader reads it." : "No lease draft: the lease rules run on the terms in the listing form."}</p>
          </div>
        </div>
      )}
      {listing && !canRun && <p className="mt-3 text-[13px]">Evaluating a listing that is not a demo listing needs live mode (a model API key on the server).</p>}
      <button
        type="button"
        onClick={onStart}
        disabled={!canRun || starting || blocked}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-40"
      >
        <Play size={16} aria-hidden /> {starting ? "Starting..." : "Evaluate this listing"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-hard">
          {error}
        </p>
      )}
    </Card>
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
      {/* Locked (demo profile): every field, including the choices, is a read-only value with no dropdown arrow. */}
      <label className="sm:col-span-2">
        <span className={LABEL}>Business type</span>
        {locked ? (
          <input value={BUSINESS_TYPE_LABELS[form.businessType as ProfileInput["businessType"]] ?? form.businessType} readOnly disabled className={INPUT} />
        ) : (
          <select value={form.businessType} onChange={(e) => onChange({ businessType: e.target.value })} className={INPUT}>
            {Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </label>
      <label>
        <span className={LABEL}>City</span>
        <input value={form.city} onChange={(e) => onChange({ city: e.target.value })} readOnly={locked} disabled={locked} className={INPUT} />
      </label>
      <label>
        <span className={LABEL}>Currency</span>
        {locked ? (
          <input value={form.currency} readOnly disabled className={INPUT} />
        ) : (
          <select value={form.currency} onChange={(e) => onChange({ currency: e.target.value })} className={INPUT}>
            {CURRENCIES.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        )}
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

/** The one message shown when the server has no model key: runs still work, with scripted answers, and say so. */
function NoKeyNotice() {
  return (
    <p className="mt-4 rounded-[18px] bg-white/70 px-4 py-3 text-[13px] leading-5 text-ink-2">
      This server has no AI model key, so runs use scripted demo answers and the demo profile. Add ANTHROPIC_API_KEY to .env and restart to use the real model.
    </p>
  )
}

/**
 * "Evaluate an outside listing": the same required fields as the SuiteSpot listing form, plus an optional lease draft
 * and link. Without the required fields there is no evaluation; the server's domain check lists what is missing.
 */
function OutsideListingForm({
  liveAvailable,
  starting,
  accessCodeMissing,
  onStart,
  error,
  problems,
}: {
  liveAvailable: boolean
  starting: boolean
  accessCodeMissing: boolean
  onStart: (outside: { listing: unknown; leaseDraft?: string; url?: string }) => void
  error: string | null
  problems: { field: string; message: string }[]
}) {
  const [listing, setListing] = useState<ListingForm>(EMPTY_LISTING_FORM)
  const [leaseDraft, setLeaseDraft] = useState("")
  const [url, setUrl] = useState("")
  const problemFor = (...fields: string[]) => problems.find((p) => fields.includes(p.field))?.message
  return (
    <div className="flex flex-col gap-4">
      {!liveAvailable && <NoKeyNotice />}
      <fieldset disabled={!liveAvailable} className="flex flex-col gap-4 disabled:opacity-60">
        <ListingTermsFields form={listing} set={(patch) => setListing({ ...listing, ...patch })} problemFor={problemFor} />
        <Card title="Optional">
          <div className="grid gap-3">
            <label className="block">
              <span className={LABEL}>
                Lease draft <span className="font-normal text-ink-3">(text)</span>
              </span>
              <textarea rows={6} value={leaseDraft} onChange={(e) => setLeaseDraft(e.target.value)} placeholder="Paste the lease draft. The Lease reader compares it with the terms above." className={cx(INPUT, "h-auto py-3")} />
            </label>
            <label className="block">
              <span className={LABEL}>Listing link</span>
              <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://... (kept as a reference, SuiteSpot never opens it)" className={INPUT} />
            </label>
          </div>
        </Card>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onStart({ listing: toInput(listing), ...(leaseDraft.trim() ? { leaseDraft } : {}), ...(url.trim() ? { url: url.trim() } : {}) })}
          disabled={!liveAvailable || starting || accessCodeMissing}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-40"
        >
          <Play size={16} aria-hidden /> {starting ? "Starting..." : "Evaluate this listing"}
        </button>
        {liveAvailable && accessCodeMissing && (
          <span className="text-[13px]">
            This server asks for an access code.{" "}
            <Link to={paths.settings()} className="font-medium text-ink underline">
              Enter it in Settings
            </Link>
          </span>
        )}
      </div>
      {error && (
        <div role="alert" className="rounded-[18px] bg-hard-50 p-4 text-[13px] text-hard">
          {problems.length > 0 ? (
            <>
              <p className="mb-1 font-medium">Fill in these fields first:</p>
              <ul className="list-disc pl-4">
                {problems.map((p) => (
                  <li key={p.field}>
                    {FIELD_NAMES[p.field] ?? p.field}: {p.message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            error
          )}
        </div>
      )}
    </div>
  )
}
