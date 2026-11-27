import { ArrowRight, Camera, Check, LogOut, Trash2 } from "lucide-react"
import { ROLE_ICONS } from "../app/role-icons"
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { logOut, MAX_NAME_LENGTH, removeAvatar, ROLES, updateIdentity, updateOnboarding, uploadAvatar, useAuth, type Role } from "../app/auth"
import { AvatarFace } from "../app/Avatar"
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
  "h-11 w-full rounded-[16px] border border-white/80 bg-white/85 px-4 text-base text-ink sm:text-sm placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-white/50 disabled:text-ink-2"
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
    <div className="flex flex-col gap-4">
      <AccountSection />
      <RoleSection />
      {seeksSpaces(role) && <BusinessProfileSection />}
      {listsSpaces(role) && <YourSpacesSection />}
    </div>
  )
}

type Notice = { readonly tone: "ok" | "error"; readonly text: string } | null

function NoticeLine({ notice }: { notice: Notice }) {
  return (
    <span role="status" className="min-h-5 text-[13px]">
      {notice?.tone === "ok" && (
        <span className="inline-flex items-center gap-1.5 text-green-700">
          <Check size={16} aria-hidden /> {notice.text}
        </span>
      )}
      {notice?.tone === "error" && <span className="text-hard">{notice.text}</span>}
    </span>
  )
}

/** The account: the profile photo, the name and the email (all editable), and signing out. */
function AccountSection() {
  const auth = useAuth()
  const account = auth.landlord
  const name = account?.displayName ?? "Account"
  const [displayName, setDisplayName] = useState(name)
  const [email, setEmail] = useState(account?.email ?? "")
  const [busy, setBusy] = useState<"details" | "photo" | null>(null)
  const [details, setDetails] = useState<Notice>(null)
  const [photo, setPhoto] = useState<Notice>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const changed = displayName.trim() !== name || email.trim().toLowerCase() !== (account?.email ?? "").toLowerCase()

  const saveDetails = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !changed) return
    setBusy("details")
    setDetails(null)
    try {
      const { emailPending } = await updateIdentity({ displayName, email })
      setDetails({ tone: "ok", text: emailPending ? `Saved. Confirm ${email.trim().toLowerCase()} from the link we sent there; until then sign in with your current email.` : "Saved on your account." })
      if (emailPending) setEmail(account?.email ?? "")
    } catch (failure) {
      setDetails({ tone: "error", text: (failure as Error).message })
    } finally {
      setBusy(null)
    }
  }
  const choosePhoto = async (file: File | undefined) => {
    if (!file || busy) return
    setBusy("photo")
    setPhoto(null)
    try {
      await uploadAvatar(file)
      setPhoto({ tone: "ok", text: "Photo saved." })
    } catch (failure) {
      setPhoto({ tone: "error", text: (failure as Error).message })
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = "" // the same file can be chosen again
    }
  }
  const dropPhoto = async () => {
    if (busy) return
    setBusy("photo")
    setPhoto(null)
    try {
      await removeAvatar()
      setPhoto({ tone: "ok", text: "Photo removed." })
    } catch (failure) {
      setPhoto({ tone: "error", text: (failure as Error).message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card title="Account" collapsible id="settings-account">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <AvatarFace name={displayName || name} url={account?.avatarUrl ?? null} className="h-16 w-16 bg-lilac text-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                id="settings-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="sr-only"
                onChange={(event) => void choosePhoto(event.target.files?.[0])}
                disabled={busy !== null}
              />
              <label htmlFor="settings-photo" className={cx(SECONDARY, "cursor-pointer", busy !== null && "pointer-events-none opacity-60")}>
                <Camera size={16} aria-hidden /> {busy === "photo" ? "Saving..." : account?.avatarUrl ? "Change photo" : "Add a photo"}
              </label>
              {account?.avatarUrl && (
                <button type="button" onClick={() => void dropPhoto()} disabled={busy !== null} className={cx(SECONDARY, "disabled:opacity-60")}>
                  <Trash2 size={16} aria-hidden /> Remove
                </button>
              )}
            </div>
            <span className="text-[12px] text-ink-2">JPEG, PNG or WebP. Cropped to a square and shrunk in your browser before it is uploaded.</span>
            <NoticeLine notice={photo} />
          </div>
        </div>

        <form onSubmit={saveDetails} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="min-w-0">
              <span className={LABEL}>Name or company</span>
              <input
                className={INPUT}
                value={displayName}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="name"
                onChange={(event) => {
                  setDisplayName(event.target.value)
                  setDetails(null)
                }}
              />
            </label>
            <label className="min-w-0">
              <span className={LABEL}>Email</span>
              <input
                className={INPUT}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setDetails(null)
                }}
              />
              {account?.pendingEmail && <span className="mt-1.5 block text-[12px] text-ink-2">Waiting for you to confirm {account.pendingEmail}.</span>}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!changed || busy !== null}
              className="inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "details" ? "Saving..." : "Save details"}
            </button>
            <NoticeLine notice={details} />
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/70 pt-4">
          <span className="text-[13px] text-ink-2">
            {auth.mode === "local" ? "This account is kept on this computer only (no Supabase configured)." : "Signed in with SuiteSpot (Supabase Auth)."}
          </span>
          <button type="button" onClick={() => void logOut().then(() => navigate(paths.dashboard()))} className={SECONDARY}>
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      </div>
    </Card>
  )
}

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
