import { ArrowLeft, ArrowRight, LogOut, Sparkles, type LucideIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { logOut, updateOnboarding, useAuth, type Role } from "../app/auth"
import { checkProfileFields, EXAMPLE_PROFILE, toProfileFields, type ProfileFields, type ProfileProblems } from "../app/business-profile"
import { isFormStep, onboardingPath, safeNext } from "../app/onboarding-gate"
import { ROLE_ICONS } from "../app/role-icons"
import { ROLE_LABELS } from "../app/roles"
import { navigate, paths, useLocation } from "../app/router"
import { loadSettings, saveSettings } from "../app/settings"
import { spaceExtrasDescription, type Storefront } from "../app/space-extras"
import { EMPTY_LISTING_FORM, Field, FIELD_NAMES, ListingTermsFields, SECTION_LABEL, toInput, type Form as ListingForm } from "../listings/ListingFormPage"
import { ApiError, listingsApi, type ListingProblem } from "../listings/listings-api"
import { cx } from "../ui"
import { Select } from "../Select"
import { Logo } from "../Logo"
import { BusinessProfileFields } from "./BusinessProfileFields"
import { INPUT } from "./SettingsPage"

/**
 * The onboarding after sign up (and after a sign in while it is not finished): the welcome veil fades into this
 * screen instead of the app, with no sidebar. Step 1: how the user uses SuiteSpot (saved on the account at once).
 * Step 2: "Find a space" asks for the business profile, "List my space" for the first space; "I do both" asks for
 * both (steps 2 and 3). "Skip for now" moves on; the last step saved or skipped finishes the onboarding. A finished
 * account can open a form step later to add the other role (?add=1, from the avatar menu).
 */
export function OnboardingPage() {
  const auth = useAuth()
  const { search } = useLocation()
  const role = auth.landlord?.role ?? null
  const stepParam = search.get("step")
  // A form step needs a role first (a typed address without one shows step 1).
  const step = isFormStep(stepParam) && role ? stepParam : "role"
  const add = search.get("add") === "1"
  const next = search.get("next")
  const both = role === "both" && !add

  /** Ends the onboarding (once) and goes on: to what the step made, or to the page the user wanted. */
  const finish = async (to: string) => {
    if (!auth.landlord?.onboardedAt) await updateOnboarding({ onboarded: true })
    navigate(to, { replace: true })
  }
  const afterSeeker = (saved: boolean) => (both ? navigate(onboardingPath("owner", { next })) : finish(saved ? paths.findSpaces() : safeNext(next)))
  const afterOwner = (published: boolean) => finish(published ? paths.myListings() : safeNext(next))
  const back = () => {
    if (add) return navigate(safeNext(next))
    navigate(step === "owner" && both ? onboardingPath("seeker", { next }) : onboardingPath("role", { next }))
  }

  if (step === "role") return <RoleStep next={next} />
  const label = add
    ? `Add a role · ${ROLE_LABELS[step === "seeker" ? "seeker" : "owner"]}`
    : `Step ${step === "owner" && both ? 3 : 2} of ${both ? 3 : 2} · ${ROLE_LABELS[role!]}`
  return step === "seeker" ? (
    <SeekerStep label={label} saveLabel={both ? "Save and continue" : "Save and find spaces"} onBack={back} onDone={afterSeeker} />
  ) : (
    <OwnerStep label={label} onBack={back} onDone={afterOwner} />
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Step 1: the role

function RoleStep({ next }: { next: string | null }) {
  const [busy, setBusy] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = async (role: Role) => {
    setError(null)
    setBusy(role)
    try {
      await updateOnboarding({ role })
      navigate(onboardingPath(role === "owner" ? "owner" : "seeker", { next }))
    } catch (failure) {
      setError((failure as Error).message)
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 py-6 text-ink sm:px-10 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <span className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="text-[22px] font-semibold tracking-[-0.02em]">SuiteSpot</span>
        </span>
        <StepDots current={1} total={2} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-12 py-12">
        <div className="max-w-[640px] text-center">
          <h1 className="onb-enter text-[40px] leading-[1.1] font-bold tracking-[-0.03em] sm:text-[48px]">How will you use SuiteSpot?</h1>
          <p className="onb-enter mt-4 text-lg leading-normal text-ink-2" style={{ animationDelay: "60ms" }}>
            You can switch or add the other role any time in Settings.
          </p>
        </div>

        <div className="grid w-full max-w-[860px] gap-6 md:grid-cols-2">
          <RoleCard
            icon={ROLE_ICONS.owner}
            title="List my space"
            text="Rent out a commercial space and answer offers."
            busy={busy === "owner"}
            disabled={busy !== null}
            delay={120}
            onChoose={() => void choose("owner")}
          />
          <RoleCard
            icon={ROLE_ICONS.seeker}
            title="Find a space"
            text="Find spaces that fit your business and check the lease."
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
          className="onb-enter inline-flex h-12 items-center gap-2 rounded-full glass-strong px-7 text-base font-semibold text-ink hover:bg-white disabled:opacity-50"
          style={{ animationDelay: "240ms" }}
        >
          {(() => {
            const Both = ROLE_ICONS.both
            return <Both size={18} strokeWidth={1.75} aria-hidden />
          })()}
          {busy === "both" ? "Saving..." : "Set up both roles"}
        </button>
        {error && (
          <p role="alert" className="-mt-8 text-[13px] text-hard">
            {error}
          </p>
        )}
      </main>

      <footer className="flex items-center">
        <button
          type="button"
          onClick={() => void logOut()}
          className="inline-flex h-10 items-center gap-2 rounded-full glass-strong px-4 text-sm font-medium text-ink hover:bg-white"
        >
          <LogOut size={16} aria-hidden /> Sign out
        </button>
      </footer>
    </div>
  )
}

/** The step indicator: one pill per step, the current ones black; the step is said in the label, not in text. */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <span role="img" aria-label={`Step ${current} of ${total}`} className="inline-flex items-center gap-1.5 rounded-full glass-strong px-2.5 py-2">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cx("h-2 rounded-full transition-all duration-300", i < current ? "w-8 bg-ink" : "w-5 bg-ink/20")} />
      ))}
    </span>
  )
}

/** A role card (DESIGN.md glass): the whole card is the button; it lifts a little on hover and focus. */
function RoleCard(props: { icon: LucideIcon; title: string; text: string; busy: boolean; disabled: boolean; delay: number; onChoose: () => void }) {
  const Icon = props.icon
  return (
    <button
      type="button"
      onClick={props.onChoose}
      disabled={props.disabled}
      aria-busy={props.busy}
      className={cx("onb-enter role-card glass flex flex-col gap-7 rounded-[28px] p-9 text-left disabled:cursor-default", props.busy && "is-busy")}
      style={{ animationDelay: `${props.delay}ms` }}
    >
      <span className="flex w-full items-start justify-between">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-ink">
          <Icon size={24} strokeWidth={1.75} aria-hidden />
        </span>
        <ArrowRight size={20} className="mt-4 text-ink-2" aria-hidden />
      </span>
      <span className="flex flex-col gap-2">
        <span className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink">{props.busy ? "Saving..." : props.title}</span>
        <span className="text-base leading-normal text-ink-2">{props.text}</span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Step 2 (and 3): the forms, centred on the screen with "Skip for now" above the card on the right

const TOP_PILL = "inline-flex h-10 items-center gap-1.5 rounded-full glass-strong px-[18px] text-sm font-semibold text-ink hover:bg-white disabled:opacity-50"

function FormStepFrame({
  wide,
  onBack,
  onSkip,
  skipping,
  children,
}: {
  wide?: boolean
  onBack: () => void
  onSkip: () => void
  skipping: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12 text-ink">
      <div className={cx("onb-enter flex w-full flex-col gap-3", wide ? "max-w-[760px] lg:max-w-[1100px]" : "max-w-[720px]")}>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className={TOP_PILL}>
            <ArrowLeft size={14} aria-hidden /> Back
          </button>
          <button type="button" onClick={onSkip} disabled={skipping} className={TOP_PILL}>
            {skipping ? "One moment..." : "Skip for now"} <ArrowRight size={14} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormHeader({ label, title, text, onExample }: { label: string; title: string; text: string; onExample: () => void }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[13px] text-ink-2">{label}</p>
        <h1 className="text-[32px] leading-tight font-bold tracking-[-0.025em]">{title}</h1>
        <p className="mt-2 text-[15px] leading-normal text-ink-2">{text}</p>
      </div>
      <button
        type="button"
        onClick={onExample}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-dashed border-lilac-600 bg-lilac-100 px-4 text-sm font-semibold text-ink hover:bg-white"
      >
        <Sparkles size={16} aria-hidden /> Fill with example
      </button>
    </div>
  )
}

function ExampleNote({ text }: { text: string }) {
  return <p className="rounded-[16px] bg-lilac-100 px-4 py-2.5 text-[13px] text-ink">{text}</p>
}

function FormFooter({ primary, busy, note }: { primary: string; busy: boolean; note?: string }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-white hover:bg-[#26262e] disabled:opacity-50"
        >
          {busy ? "Saving..." : primary} <ArrowRight size={16} aria-hidden />
        </button>
      </div>
      {note && <p className="text-[13px] text-ink-2">{note}</p>}
    </>
  )
}

const CARD = "glass flex flex-col gap-6 rounded-[28px] p-6 sm:p-10"

function SeekerStep({
  label,
  saveLabel,
  onBack,
  onDone,
}: {
  label: string
  saveLabel: string
  onBack: () => void
  onDone: (saved: boolean) => Promise<void> | void
}) {
  const saved = loadSettings()
  const [fields, setFields] = useState<ProfileFields>(() => toProfileFields(saved))
  const [problems, setProblems] = useState<ProfileProblems>({})
  const [example, setExample] = useState(false)
  const [busy, setBusy] = useState<"save" | "skip" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: "save" | "skip", work: () => Promise<void> | void) => {
    setBusy(kind)
    setError(null)
    try {
      await work()
    } catch (failure) {
      setError((failure as Error).message)
      setBusy(null)
    }
  }
  const save = () => {
    const checked = checkProfileFields(fields, { requireAll: true })
    if ("problems" in checked) return setProblems(checked.problems)
    setProblems({})
    void run("save", () => {
      saveSettings({ ...checked.profile, currency: saved.currency })
      return onDone(true)
    })
  }

  return (
    <FormStepFrame onBack={onBack} onSkip={() => void run("skip", () => onDone(false))} skipping={busy === "skip"}>
      <form
        className={CARD}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <FormHeader
          label={label}
          title="Tell us about your business"
          text="SuiteSpot uses this to find spaces that fit and to check every lease against your budget."
          onExample={() => {
            setFields(EXAMPLE_PROFILE)
            setProblems({})
            setExample(true)
          }}
        />
        {example && <ExampleNote text="Example values. Replace them with your own." />}
        <BusinessProfileFields fields={fields} set={(patch) => setFields({ ...fields, ...patch })} problems={problems} currency={saved.currency} />
        {Object.keys(problems).length > 0 && (
          <p role="alert" className="text-[13px] text-hard">
            Check the marked fields.
          </p>
        )}
        {error && (
          <p role="alert" className="text-[13px] text-hard">
            {error}
          </p>
        )}
        <FormFooter primary={saveLabel} busy={busy === "save"} note="You can change this profile later in Settings." />
      </form>
    </FormStepFrame>
  )
}

/** "Fill with example" for the first space: a synthetic listing (no real landlord or address number). Contact stays empty. */
const EXAMPLE_LISTING: ListingForm = {
  ...EMPTY_LISTING_FORM,
  title: "Ground floor corner space near the Liman market",
  city: "Novi Sad",
  district: "Liman 2",
  street: "Narodnog fronta",
  areaM2: "58",
  floor: "0",
  rentMonthly: "950",
  serviceChargeMonthly: "60",
  deposit: "1900",
  minimumTermMonths: "36",
  exitAllowed: "yes",
  noticeMonths: "3",
  indexation: "cpi",
  permittedUses: ["cafe_food", "retail", "office_studio"],
  structural: "landlord",
  leaseDraft:
    "The tenant may end the lease early with 3 months written notice. Rent is adjusted once a year by the official consumer price index.",
}

function OwnerStep({ label, onBack, onDone }: { label: string; onBack: () => void; onDone: (published: boolean) => Promise<void> | void }) {
  const [form, setForm] = useState<ListingForm>(EMPTY_LISTING_FORM)
  const [storefront, setStorefront] = useState<Storefront>("")
  const [parking, setParking] = useState("")
  const [example, setExample] = useState(false)
  const [problems, setProblems] = useState<ListingProblem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"save" | "skip" | null>(null)
  const set = (patch: Partial<ListingForm>) => setForm({ ...form, ...patch })
  const problemFor = (...fields: string[]) => problems.find((p) => fields.includes(p.field))?.message

  const publish = async () => {
    setBusy("save")
    setError(null)
    setProblems([])
    try {
      const contact = { phone: form.phone.trim() || null, email: form.email.trim() || null, consentToPublish: form.consent }
      await listingsApi.create(toInput({ ...form, description: spaceExtrasDescription({ storefront, parking }) ?? "" }), contact)
      await onDone(true)
    } catch (e) {
      if (e instanceof ApiError && e.problems.length > 0) setProblems(e.problems)
      setError(e instanceof Error ? e.message : "Could not publish the listing")
      setBusy(null)
    }
  }
  const skip = async () => {
    setBusy("skip")
    try {
      await onDone(false)
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  return (
    <FormStepFrame wide onBack={onBack} onSkip={() => void skip()} skipping={busy === "skip"}>
      <form
        className={CARD}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void publish()
        }}
      >
        <FormHeader
          label={label}
          title="Add your first space"
          text="You can add more spaces later from My listings."
          onExample={() => {
            setForm({ ...EXAMPLE_LISTING, phone: form.phone, email: form.email, consent: form.consent })
            setStorefront("yes")
            setParking("Public parking in front")
            setProblems([])
            setExample(true)
          }}
        />
        {example && <ExampleNote text="Example values. Replace them with your own and add your contact." />}
        {/* Wide screens: the fields on the left scroll with the page, Contact and Publish stay in view on the right. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <ListingTermsFields
              variant="plain"
              form={form}
              set={set}
              problemFor={problemFor}
              spaceExtras={
                <>
                  <Field label="Storefront window">
                    <Select
                      value={storefront}
                      onChange={setStorefront}
                      options={[
                        { value: "", label: "Not stated" },
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                      ]}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Parking">
                    <input value={parking} onChange={(e) => setParking(e.target.value)} placeholder="Public, in front" className={INPUT} />
                  </Field>
                </>
              }
            />
            <Field label="Lease draft, optional" problem={problemFor("leaseDraft")}>
              <textarea
                rows={4}
                value={form.leaseDraft}
                onChange={(e) => set({ leaseDraft: e.target.value })}
                placeholder="Paste the lease draft text. The Lease reader checks it against the terms above."
                className={cx(INPUT, "h-auto py-3")}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-6 lg:sticky lg:top-6">
            <section className="flex flex-col gap-3">
              <h2 className={SECTION_LABEL}>Contact</h2>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
                <Field label="Phone" problem={problemFor("contact.phone", "contact")}>
                  <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+381 64 123 45 67" className={INPUT} />
                </Field>
                <Field label="Email" problem={problemFor("contact.email")}>
                  <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={INPUT} />
                </Field>
                <label className="col-span-full flex items-start gap-2.5 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => set({ consent: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <span>I agree that this contact is shown publicly on the listing page.</span>
                </label>
                {problemFor("contact.consentToPublish") && <p className="col-span-full text-[13px] text-hard">{problemFor("contact.consentToPublish")}</p>}
              </div>
              <p className="text-[13px] text-ink-2">Contact details stay private until a signed-in user asks to see them.</p>
            </section>
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
            <FormFooter primary="Publish listing" busy={busy === "save"} />
          </div>
        </div>
      </form>
    </FormStepFrame>
  )
}
