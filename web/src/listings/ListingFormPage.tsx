import { Save } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Link, navigate, paths } from "../app/router"
import { BUSINESS_TYPE_LABELS, type BusinessType } from "../app/settings"
import { Card, EmptyState } from "../app/Shell"
import { INPUT, LABEL } from "../pages/SettingsPage"
import { cx } from "../ui"
import { ApiError, CITIES, listingsApi, type ContactInput, type Indexation, type ListingInput, type ListingProblem } from "./listings-api"

/** The form as typed (strings), so half-typed numbers survive while the landlord edits. */
export type Form = {
  title: string
  city: string
  district: string
  street: string
  areaM2: string
  floor: string
  rentMonthly: string
  serviceChargeMonthly: string
  deposit: string
  minimumTermMonths: string
  exitAllowed: "yes" | "no" | ""
  noticeMonths: string
  indexation: Indexation["kind"] | ""
  indexationRate: string
  permittedUses: BusinessType[]
  structural: "landlord" | "tenant" | ""
  leaseDraft: string
  description: string
  imageUrl: string
  phone: string
  email: string
  consent: boolean
}

export const EMPTY_LISTING_FORM: Form = {
  title: "",
  city: "",
  district: "",
  street: "",
  areaM2: "",
  floor: "0",
  rentMonthly: "",
  serviceChargeMonthly: "",
  deposit: "",
  minimumTermMonths: "",
  exitAllowed: "",
  noticeMonths: "",
  indexation: "",
  indexationRate: "",
  permittedUses: [],
  structural: "",
  leaseDraft: "",
  description: "",
  imageUrl: "",
  phone: "",
  email: "",
  consent: false,
}

const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(",", ".")))
const text = (s: string) => (s.trim() === "" ? null : s.trim())

export function toInput(f: Form): ListingInput {
  return {
    title: f.title,
    city: f.city,
    district: f.district,
    street: f.street,
    areaM2: num(f.areaM2),
    floor: num(f.floor),
    rentMonthly: num(f.rentMonthly),
    serviceChargeMonthly: num(f.serviceChargeMonthly),
    deposit: num(f.deposit),
    minimumTermMonths: num(f.minimumTermMonths),
    earlyTermination: (f.exitAllowed === "yes" ? { allowed: true, noticeMonths: num(f.noticeMonths) } : f.exitAllowed === "no" ? { allowed: false } : undefined) as ListingInput["earlyTermination"],
    indexation: (f.indexation === "fixed_rate" ? { kind: "fixed_rate", ratePercent: num(f.indexationRate) } : f.indexation ? { kind: f.indexation } : undefined) as Indexation,
    permittedUses: f.permittedUses,
    tenantPaysStructuralRepairs: (f.structural === "tenant" ? true : f.structural === "landlord" ? false : undefined) as boolean,
    leaseDraft: text(f.leaseDraft),
    description: text(f.description),
    imageUrl: text(f.imageUrl),
  }
}

function fromListing(l: ListingInput, contact: { phone: string | null; email: string | null } | null): Form {
  return {
    title: l.title,
    city: l.city,
    district: l.district,
    street: l.street,
    areaM2: String(l.areaM2),
    floor: String(l.floor),
    rentMonthly: String(l.rentMonthly),
    serviceChargeMonthly: String(l.serviceChargeMonthly),
    deposit: String(l.deposit),
    minimumTermMonths: String(l.minimumTermMonths),
    exitAllowed: l.earlyTermination.allowed ? "yes" : "no",
    noticeMonths: l.earlyTermination.allowed ? String(l.earlyTermination.noticeMonths) : "",
    indexation: l.indexation.kind,
    indexationRate: l.indexation.kind === "fixed_rate" ? String(l.indexation.ratePercent) : "",
    permittedUses: [...l.permittedUses],
    structural: l.tenantPaysStructuralRepairs ? "tenant" : "landlord",
    leaseDraft: l.leaseDraft ?? "",
    description: l.description ?? "",
    imageUrl: l.imageUrl ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    consent: true,
  }
}

/** Plain-language names for the fields the server names in a problem. */
export const FIELD_NAMES: Record<string, string> = {
  title: "Title",
  city: "City",
  district: "Part of town",
  street: "Street",
  areaM2: "Area",
  floor: "Floor",
  rentMonthly: "Monthly rent",
  serviceChargeMonthly: "Monthly costs",
  deposit: "Deposit",
  minimumTermMonths: "Minimum lease term",
  earlyTermination: "Ending the lease early",
  "earlyTermination.noticeMonths": "Notice period",
  indexation: "Rent increases",
  "indexation.ratePercent": "Yearly increase",
  permittedUses: "Permitted use",
  tenantPaysStructuralRepairs: "Structural repairs",
  leaseDraft: "Lease draft",
  description: "Description",
  imageUrl: "Image link",
  contact: "Contact",
  "contact.phone": "Phone",
  "contact.email": "Email",
  "contact.consentToPublish": "Consent",
}

export function ListingFormPage({ id }: { id?: string }) {
  const [form, setForm] = useState<Form | null>(id ? null : EMPTY_LISTING_FORM)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [problems, setProblems] = useState<ListingProblem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    listingsApi.mineOne(id).then(
      ({ listing, contact }) => setForm(fromListing(listing, contact)),
      (e: unknown) => setLoadError(e instanceof Error ? e.message : "Could not load the listing"),
    )
  }, [id])

  if (loadError) return <EmptyState text={loadError} action={<Link to={paths.myListings()} className="text-sm font-medium text-ink underline">My listings</Link>} />
  if (!form) return <p className="text-sm text-ink-2">Loading...</p>

  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch })
  const problemFor = (...fields: string[]) => problems.find((p) => fields.includes(p.field))?.message
  const save = () => {
    setSaving(true)
    setError(null)
    setProblems([])
    const contact: ContactInput = { phone: text(form.phone), email: text(form.email), consentToPublish: form.consent }
    const request = id ? listingsApi.update(id, toInput(form), contact) : listingsApi.create(toInput(form), contact)
    request
      .then((saved) => navigate(paths.listing(saved.id)))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.problems.length > 0) setProblems(e.problems)
        setError(e instanceof Error ? e.message : "Could not save the listing")
      })
      .finally(() => setSaving(false))
  }

  const field = (key: keyof Form, label: string, opts: { unit?: string; numeric?: boolean; placeholder?: string; problem?: string[] } = {}) => (
    <Field label={label} unit={opts.unit} problem={problemFor(...(opts.problem ?? [key]))}>
      <input
        value={form[key] as string}
        onChange={(e) => set({ [key]: e.target.value })}
        inputMode={opts.numeric ? "decimal" : undefined}
        placeholder={opts.placeholder}
        className={cx(INPUT, opts.numeric && "tnum")}
      />
    </Field>
  )

  return (
    <form
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      noValidate
    >
      <div className="flex flex-col gap-4">
        <ListingTermsFields form={form} set={set} problemFor={problemFor} />
        <Card title="Optional">
          <div className="grid gap-3">
            <Field label="Description" problem={problemFor("description")}>
              <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} className={cx(INPUT, "h-auto py-3")} />
            </Field>
            <Field label="Lease draft" unit="text" problem={problemFor("leaseDraft")}>
              <textarea rows={6} value={form.leaseDraft} onChange={(e) => set({ leaseDraft: e.target.value })} placeholder="Paste the lease draft. SuiteSpot compares it with the terms above." className={cx(INPUT, "h-auto py-3")} />
            </Field>
            {field("imageUrl", "Image link", { placeholder: "https://..." })}
          </div>
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        <Card title="Contact">
          <p className="mb-3 text-[13px]">Tenants see it only after they click "Show contact". Give a phone number, an email or both.</p>
          <div className="grid gap-3">
            {field("phone", "Phone", { placeholder: "+381 64 123 45 67", problem: ["contact.phone", "contact"] })}
            {field("email", "Email", { problem: ["contact.email"] })}
            <label className="flex items-start gap-2.5 text-[13px] text-ink">
              <input type="checkbox" checked={form.consent} onChange={(e) => set({ consent: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
              <span>I agree that this contact is shown publicly on the listing page.</span>
            </label>
            {problemFor("contact.consentToPublish") && <p className="text-[13px] text-hard">{problemFor("contact.consentToPublish")}</p>}
          </div>
        </Card>
        <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-40">
          <Save size={16} aria-hidden /> {saving ? "Saving..." : id ? "Save changes" : "Publish listing"}
        </button>
        {error && (
          <div role="alert" className="rounded-[18px] bg-hard-50 p-4 text-[13px] text-hard">
            {problems.length > 0 ? (
              <ul className="list-disc pl-4">
                {problems.map((p) => (
                  <li key={p.field}>
                    {FIELD_NAMES[p.field] ?? p.field}: {p.message}
                  </li>
                ))}
              </ul>
            ) : (
              error
            )}
          </div>
        )}
      </div>
    </form>
  )
}

/** The required fields of a listing: the same on "List a space" and on "Evaluate an outside listing". */
export function ListingTermsFields({ form, set, problemFor }: { form: Form; set: (patch: Partial<Form>) => void; problemFor: (...fields: string[]) => string | undefined }) {
  const field = (key: keyof Form, label: string, opts: { unit?: string; numeric?: boolean; placeholder?: string; problem?: string[] } = {}) => (
    <Field label={label} unit={opts.unit} problem={problemFor(...(opts.problem ?? [key]))}>
      <input
        value={form[key] as string}
        onChange={(e) => set({ [key]: e.target.value })}
        inputMode={opts.numeric ? "decimal" : undefined}
        placeholder={opts.placeholder}
        className={cx(INPUT, opts.numeric && "tnum")}
      />
    </Field>
  )

  return (
    <>
        <Card title="The space">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("title", "Title", { placeholder: "Lokal 60 m2 na Limanu" })}</div>
            <Field label="City" problem={problemFor("city")}>
              <select value={form.city} onChange={(e) => set({ city: e.target.value })} className={INPUT}>
                <option value="">Choose</option>
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            {field("district", "Part of town", { placeholder: "Liman 3" })}
            {field("street", "Street", { placeholder: "Street name, without the house number" })}
            {field("areaM2", "Area", { unit: "m²", numeric: true })}
            <Field label="Floor" problem={problemFor("floor")}>
              <select value={form.floor} onChange={(e) => set({ floor: e.target.value })} className={INPUT}>
                <option value="-1">Basement</option>
                <option value="0">Ground floor</option>
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    Floor {i + 1}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Permitted use" problem={problemFor("permittedUses")} wide>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((use) => {
                  const on = form.permittedUses.includes(use)
                  return (
                    <button
                      key={use}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ permittedUses: on ? form.permittedUses.filter((u) => u !== use) : [...form.permittedUses, use] })}
                      className={cx("h-10 rounded-full px-4 text-sm font-medium", on ? "bg-brand-soft text-ink" : "glass-strong text-ink hover:bg-white")}
                    >
                      {BUSINESS_TYPE_LABELS[use]}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        </Card>
        <Card title="Money and lease terms">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("rentMonthly", "Monthly rent", { unit: "EUR", numeric: true })}
            {field("serviceChargeMonthly", "Monthly costs", { unit: "EUR, 0 if none", numeric: true })}
            {field("deposit", "Deposit", { unit: "EUR", numeric: true })}
            {field("minimumTermMonths", "Minimum lease term", { unit: "months", numeric: true })}
            <Field label="Can the tenant end the lease early?" problem={problemFor("earlyTermination")}>
              <select value={form.exitAllowed} onChange={(e) => set({ exitAllowed: e.target.value as Form["exitAllowed"] })} className={INPUT}>
                <option value="">Choose</option>
                <option value="yes">Yes, with notice</option>
                <option value="no">No, not before the term ends</option>
              </select>
            </Field>
            {form.exitAllowed === "yes" ? field("noticeMonths", "Notice period", { unit: "months", numeric: true, problem: ["earlyTermination.noticeMonths"] }) : <div />}
            <Field label="Rent increases" problem={problemFor("indexation")}>
              <select value={form.indexation} onChange={(e) => set({ indexation: e.target.value as Form["indexation"] })} className={INPUT}>
                <option value="">Choose</option>
                <option value="none">No increase during the lease</option>
                <option value="cpi">Once a year with the consumer price index</option>
                <option value="fixed_rate">A fixed percent every year</option>
                <option value="landlord_unilateral">The landlord may change the rent at any time</option>
              </select>
            </Field>
            {form.indexation === "fixed_rate" ? field("indexationRate", "Yearly increase", { unit: "%", numeric: true, problem: ["indexation.ratePercent"] }) : <div />}
            <Field label="Who pays structural repairs (roof, walls, installations)?" problem={problemFor("tenantPaysStructuralRepairs")} wide>
              <select value={form.structural} onChange={(e) => set({ structural: e.target.value as Form["structural"] })} className={INPUT}>
                <option value="">Choose</option>
                <option value="landlord">The landlord</option>
                <option value="tenant">The tenant</option>
              </select>
            </Field>
          </div>
        </Card>
    </>
  )
}

function Field({ label, unit, problem, wide, children }: { label: string; unit?: string; problem?: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cx("block", wide && "sm:col-span-2")}>
      <span className={LABEL}>
        {label}
        {unit && <span className="font-normal text-ink-3"> ({unit})</span>}
      </span>
      {children}
      {problem && <span className="mt-1 block text-xs text-hard">{problem}</span>}
    </label>
  )
}
