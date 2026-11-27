import type { ReactNode } from "react"
import type { ProfileField, ProfileFields, ProfileProblems } from "../app/business-profile"
import { BUSINESS_TYPE_LABELS, MUST_HAVES, type BusinessType, type Currency } from "../app/settings"
import { cx } from "../ui"
import { Select } from "../Select"
import { INPUT, LABEL } from "./SettingsPage"

/**
 * The business profile fields of "Find a space" in the onboarding and of Settings (one component, so both stay the
 * same). Must haves and preferred districts become the business description that the live agents read.
 */
export function BusinessProfileFields({
  fields,
  set,
  problems,
  currency,
  extra,
}: {
  fields: ProfileFields
  set: (patch: Partial<ProfileFields>) => void
  problems: ProfileProblems
  currency: Currency
  /** More fields at the end of the grid (Settings adds the currency). */
  extra?: ReactNode
}) {
  const input = (key: ProfileField, label: string, opts: { numeric?: boolean; placeholder?: string; wide?: boolean } = {}) => (
    <FieldBox label={label} problem={problems[key]} wide={opts.wide}>
      <input
        value={fields[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        inputMode={opts.numeric ? "decimal" : undefined}
        placeholder={opts.placeholder}
        aria-invalid={Boolean(problems[key])}
        className={cx(INPUT, opts.numeric && "tnum")}
      />
    </FieldBox>
  )
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldBox label="Business type" problem={problems.businessType}>
          <Select value={fields.businessType} onChange={(businessType) => set({ businessType })} options={Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value: value as BusinessType, label }))} className={INPUT} />
        </FieldBox>
        {input("city", "City", { placeholder: "Novi Sad or Beograd" })}
        {input("districts", "Preferred districts", { placeholder: "e.g. Liman, Grbavica, Centar", wide: true })}
        {input("areaMinM2", "Area from (m²)", { numeric: true, placeholder: "50" })}
        {input("areaMaxM2", "Area to (m²)", { numeric: true, placeholder: "90" })}
        {input("monthlyBudget", `Max monthly cost (${currency})`, { numeric: true, placeholder: "Rent plus building costs" })}
        {input("expectedMonthlyRevenue", `Expected monthly revenue (${currency})`, { numeric: true, placeholder: "Used for rent to revenue share" })}
        {input("grossMarginPercent", "Gross margin (%), optional", { numeric: true, placeholder: "Needed for break-even" })}
        {input("leaseMonths", "Lease term (months)", { numeric: true, placeholder: "36" })}
        {extra}
      </div>
      <fieldset className="flex flex-col gap-2.5">
        <legend className={cx(LABEL, "mb-2.5")}>Must have</legend>
        <div className="flex flex-wrap gap-2">
          {MUST_HAVES.map((m) => {
            const on = fields.mustHaves.includes(m)
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => set({ mustHaves: on ? fields.mustHaves.filter((x) => x !== m) : [...fields.mustHaves, m] })}
                className={cx("h-10 rounded-full px-4 text-sm font-medium", on ? "bg-brand-soft text-ink" : "glass-strong text-ink hover:bg-white")}
              >
                {m}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-ink-2">Find spaces shows listings in your preferred districts first (others still follow). Must haves and districts are also added to your business description, which the agents read.</p>
      </fieldset>
    </div>
  )
}

export function FieldBox({ label, problem, wide, children }: { label: string; problem?: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cx("block", wide && "col-span-full")}>
      <span className={LABEL}>{label}</span>
      {children}
      {problem && (
        <span role="alert" className="mt-1 block text-xs text-hard">
          {problem}
        </span>
      )}
    </label>
  )
}
