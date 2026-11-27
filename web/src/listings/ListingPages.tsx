import { Building2, Eye, Mail, MapPin, Pencil, Phone, Play, Plus, Trash2 } from "lucide-react"
import { SaveButton } from "./SaveButton"
import { OfferForm } from "../deals/DealViews"
import { dealsApi } from "../deals/deals-api"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../app/auth"
import { Link, navigate, paths } from "../app/router"
import { BUSINESS_TYPE_LABELS } from "../app/settings"
import { Card, EmptyState } from "../app/Shell"
import { formatMoney } from "../format"
import { INPUT, LABEL } from "../pages/SettingsPage"
import { cx } from "../ui"
import { Select } from "../Select"
import { CITIES, exitLabel, floorLabel, indexationLabel, listingsApi, useLoad, type PublicListing, type RevealedContact } from "./listings-api"

const PRIMARY = "inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-40"
const SECONDARY = "inline-flex h-10 items-center gap-2 rounded-full glass-strong px-[18px] text-sm font-medium text-ink hover:bg-white disabled:opacity-50"

const money = (amount: number) => formatMoney(amount, "EUR")
const monthly = (l: PublicListing) => l.rentMonthly + l.serviceChargeMonthly

/** All published listings, with a simple filter (city, max monthly cost, minimum area). */
export function BrowseListingsPage() {
  const { data, error } = useLoad("listings", listingsApi.list)
  const [city, setCity] = useState<string>("")
  const [maxCost, setMaxCost] = useState("")
  const [minArea, setMinArea] = useState("")
  const shown = useMemo(
    () => (data ?? []).filter((l) => (!city || l.city === city) && (!maxCost || monthly(l) <= Number(maxCost)) && (!minArea || l.areaM2 >= Number(minArea))),
    [data, city, maxCost, minArea],
  )
  return (
    <div className="flex flex-col gap-4">
      <section className="glass flex flex-wrap items-end gap-3 rounded-[28px] p-5">
        <label className="min-w-[160px] flex-1">
          <span className={LABEL}>City</span>
          <Select
            value={city}
            onChange={setCity}
            options={[{ value: "", label: "All cities" }, ...CITIES.map((c) => ({ value: c, label: c }))]}
            className={INPUT}
          />
        </label>
        <label className="min-w-[160px] flex-1">
          <span className={LABEL}>Max monthly cost (EUR)</span>
          <input value={maxCost} onChange={(e) => setMaxCost(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className={cx(INPUT, "tnum")} />
        </label>
        <label className="min-w-[160px] flex-1">
          <span className={LABEL}>Min area (m²)</span>
          <input value={minArea} onChange={(e) => setMinArea(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className={cx(INPUT, "tnum")} />
        </label>
      </section>
      {error && <EmptyState text={error} />}
      {!data && !error && <p className="text-sm text-ink-2">Loading listings...</p>}
      {data && shown.length === 0 && <EmptyState text="No listing matches these filters." />}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((l) => (
          <li key={l.id}>
            <ListingCard listing={l} />
          </li>
        ))}
      </ul>
      {data && (
        <p className="text-center text-[13px] text-ink-3">
          {shown.length} of {data.length} listings
        </p>
      )}
    </div>
  )
}

/**
 * The photo the landlord linked in the listing form (the "Image link" field), or nothing: no stock photo stands in
 * for a space nobody photographed. A link that does not load hides itself. No referrer goes to the image host.
 */
function ListingPhoto({ url, title, className }: { url: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return null
  return (
    <img
      src={url}
      alt={`Photo of ${title}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cx("aspect-[16/9] w-full rounded-[18px] bg-white/60 object-cover", className)}
    />
  )
}

function ListingCard({ listing: l }: { listing: PublicListing }) {
  return (
    <Link to={paths.listing(l.id)} className="flex h-full flex-col gap-3 rounded-[24px] glass p-5 hover:bg-white/90">
      <ListingPhoto url={l.imageUrl} title={l.title} />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base leading-6 font-semibold text-ink">{l.title}</h3>
        {l.leased && <LeasedPill />}
      </div>
      <p className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
        <MapPin size={14} aria-hidden /> {l.district}, {l.street}, {l.city}
      </p>
      <div className="mt-auto flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-ink">
        <span className="tnum font-semibold">{money(l.rentMonthly)} / month</span>
        <span className="tnum text-ink-2">{l.areaM2} m²</span>
        <span className="text-ink-2">{floorLabel(l.floor)}</span>
        {l.leaseDraft && <span className="text-ink-2">Lease draft</span>}
      </div>
    </Link>
  )
}

/** A space with a lease: the server sends only the flag. */
function LeasedPill() {
  return <span className="shrink-0 rounded-full bg-lilac-100 px-2.5 py-0.5 text-xs font-semibold text-ink">Leased</span>
}

/** The public page of one listing. The contact appears only after "Show contact". */
/** Listing ids whose view was already counted in this page load. */
const countedViews = new Set<string>()

export function ListingDetailPage({ id }: { id: string }) {
  const { data: l, error } = useLoad(`listing:${id}`, () => listingsApi.get(id))
  // One view per opening of the page (StrictMode runs effects twice in development, so guard per id).
  useEffect(() => {
    if (countedViews.has(id)) return
    countedViews.add(id)
    void listingsApi.recordView(id)
  }, [id])
  const [contact, setContact] = useState<RevealedContact | null>(null)
  const [contactError, setContactError] = useState<string | null>(null)
  const [showLease, setShowLease] = useState(false)
  if (error)
    return (
      <EmptyState
        text={error}
        action={
          <Link to={paths.listings()} className={PRIMARY}>
            All listings
          </Link>
        }
      />
    )
  if (!l) return <p className="text-sm text-ink-2">Loading listing...</p>
  const reveal = () => {
    setContactError(null)
    listingsApi.revealContact(l.id).then(setContact, (e: unknown) => setContactError(e instanceof Error ? e.message : "Could not load the contact"))
  }
  const rows: [string, string][] = [
    ["Monthly rent", money(l.rentMonthly)],
    ["Monthly costs", money(l.serviceChargeMonthly)],
    ["Deposit", money(l.deposit)],
    ["Area", `${l.areaM2} m²`],
    ["Floor", floorLabel(l.floor)],
    ["Minimum lease term", `${l.minimumTermMonths} months`],
    ["Ending the lease early", exitLabel(l.earlyTermination)],
    ["Rent increases", indexationLabel(l.indexation)],
    ["Permitted use", l.permittedUses.map((u) => BUSINESS_TYPE_LABELS[u]).join(", ")],
    ["Structural repairs", l.tenantPaysStructuralRepairs ? "Paid by the tenant" : "Paid by the landlord"],
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <Card>
          <ListingPhoto url={l.imageUrl} title={l.title} className="mb-4" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
              <MapPin size={14} aria-hidden /> {l.district}, {l.street}, {l.city}
            </span>
            {l.leased && <LeasedPill />}
          </div>
          <h2 className="mt-3 text-xl leading-7 font-semibold text-ink">{l.title}</h2>
          {l.description && <p className="mt-2 text-sm leading-6 text-ink-2">{l.description}</p>}
          <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="border-b border-white/70 pb-2">
                <dt className="text-xs text-ink-3">{label}</dt>
                <dd className="tnum mt-0.5 text-sm font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13px] text-ink-3">
            The landlord typed these terms. SuiteSpot checks them against the lease draft when it evaluates the space.
          </p>
        </Card>
        <Card title="Lease draft">
          {l.leaseDraft ? (
            <>
              <div>
                <button type="button" onClick={() => setShowLease(!showLease)} className={SECONDARY}>
                  {showLease ? "Hide the draft" : "Read the draft"}
                </button>
              </div>
              {showLease && (
                <pre className="mt-4 max-h-[480px] overflow-auto rounded-[18px] bg-white/80 p-4 text-[13px] leading-5 whitespace-pre-wrap text-ink">
                  {l.leaseDraft}
                </pre>
              )}
            </>
          ) : (
            <p>The landlord has not added a lease draft. An evaluation will list the lease terms to ask about.</p>
          )}
        </Card>
      </div>
      <div className="flex flex-col gap-4 max-lg:order-first">
        <Card>
          <p className="tnum text-2xl font-semibold text-ink">{money(l.rentMonthly)}</p>
          <p className="text-[13px] text-ink-2">per month, plus {money(l.serviceChargeMonthly)} monthly costs</p>
          <button
            type="button"
            onClick={() => navigate(`${paths.newResearch()}?mode=evaluate&listing=${encodeURIComponent(l.id)}`)}
            className={cx(PRIMARY, "mt-5 w-full justify-center")}
          >
            <Play size={16} aria-hidden /> Evaluate for my business
          </button>
          <SaveButton listingId={l.id} className="mt-3" />
          <div className="mt-3">
            {contact ? (
              <ContactBox contact={contact} />
            ) : (
              <button type="button" onClick={reveal} className={cx(SECONDARY, "w-full justify-center")}>
                <Eye size={16} aria-hidden /> Show contact
              </button>
            )}
            {contactError && (
              <p role="alert" className="mt-2 text-[13px] text-hard">
                {contactError}
              </p>
            )}
          </div>
        </Card>
        {l.leased ? (
          <Card title="Make an offer">
            <p>This space is already leased.</p>
          </Card>
        ) : (
          <OfferForm listing={l} />
        )}
      </div>
    </div>
  )
}

function ContactBox({ contact }: { contact: RevealedContact }) {
  const line = (Icon: typeof Phone, text: string, href: string) => (
    <p className="flex items-center gap-2 text-sm text-ink">
      <Icon size={16} aria-hidden />
      {contact.links ? (
        <a href={href} className="underline">
          {text}
        </a>
      ) : (
        <span className="tnum">{text}</span>
      )}
    </p>
  )
  return (
    <div className="flex flex-col gap-2 rounded-[18px] bg-white/80 p-4">
      <p className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">{contact.name}</p>
      {contact.phone && line(Phone, contact.phone, `tel:${contact.phone.replace(/\s/g, "")}`)}
      {contact.email && line(Mail, contact.email, `mailto:${contact.email}`)}
    </div>
  )
}

/** The landlord's own listings: edit or delete (deleting removes the contact too). */
export function MyListingsPage() {
  const role = useAuth().landlord?.role ?? null
  const { data, error, reload } = useLoad("my-listings", listingsApi.mine)
  const deals = useLoad("deals-landlord", dealsApi.overview)
  const leased = new Set(deals.data?.tenancies.filter((t) => t.role === "landlord").map((t) => t.tenancy.listingId) ?? [])
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const remove = (l: PublicListing) => {
    if (busy) return
    setBusy(l.id)
    setActionError(null)
    listingsApi
      .remove(l.id)
      .then(reload, (e: unknown) => setActionError(e instanceof Error ? e.message : "Could not delete"))
      .finally(() => setBusy(null))
  }
  if (error) return <EmptyState text={error} />
  const ROW = "grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto] items-center gap-3"
  return (
    <div className="flex flex-col gap-4">
      {actionError && (
        <p role="alert" className="text-[13px] text-hard">
          {actionError}
        </p>
      )}
      {!data && <p className="text-sm text-ink-2">Loading...</p>}
      {data && data.length === 0 && (
        <EmptyState
          text="You have not listed a space yet."
          action={
            <Link to={paths.newListing()} className={PRIMARY}>
              <Plus size={16} aria-hidden /> Add a space
            </Link>
          }
        />
      )}
      {data && data.length > 0 && (
        <Card
          title="Your spaces"
          collapsible
          id="my-listings-table"
          count={data.length}
          action={
            // An owner has Add a space in the sidebar; "both" does not (its rail is longer), so it sits here.
            role === "both" ? (
              <Link
                to={paths.newListing()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full glass-strong px-4 text-[13px] font-medium text-ink hover:bg-white"
              >
                <Plus size={14} aria-hidden /> Add a space
              </Link>
            ) : undefined
          }
        >
          <div role="table" aria-label="Your spaces" className="flex flex-col gap-2">
            <div role="row" className={cx(ROW, "px-3 text-xs font-medium text-ink-3 max-md:hidden")}>
              <span role="columnheader">Space</span>
              <span role="columnheader">Monthly rent</span>
              <span role="columnheader">Views</span>
              <span role="columnheader">Status</span>
              <span role="columnheader" className="sr-only">
                Actions
              </span>
            </div>
            {data.map((l) => (
              <div
                key={l.id}
                role="row"
                className={cx(ROW, "rounded-[16px] bg-white/70 px-3 py-2.5 text-sm text-ink max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-y-1")}
              >
                <span role="cell" className="flex min-w-0 items-center gap-2.5">
                  <Building2 size={18} className="shrink-0 text-ink-2" aria-hidden />
                  <Link to={paths.listing(l.id)} className="min-w-0 hover:underline">
                    <span className="block truncate font-semibold">{l.title}</span>
                    <span className="tnum block truncate text-[13px] text-ink-2">
                      {l.district}, {l.city} · {l.areaM2} m² · {floorLabel(l.floor)}
                    </span>
                  </Link>
                </span>
                <span role="cell" className="tnum max-md:hidden">
                  {money(l.rentMonthly)}
                </span>
                <span role="cell" className="tnum max-md:hidden" title="How often the listing page was opened">
                  {l.views}
                </span>
                <span role="cell" className="max-md:hidden">
                  {leased.has(l.id) ? (
                    <span className="rounded-full bg-lilac-100 px-3 py-1 text-[13px] font-semibold text-ink">Leased</span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-[13px] font-semibold text-green-700">Published</span>
                  )}
                </span>
                <span role="cell" className="flex items-center justify-end gap-2">
                  <Link to={paths.editListing(l.id)} className={SECONDARY} aria-label={`Edit ${l.title}`}>
                    <Pencil size={16} aria-hidden /> Edit
                  </Link>
                  <ConfirmDelete disabled={busy === l.id} onConfirm={() => remove(l)} />
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/** Two-step delete inside the page (no browser dialog). */
function ConfirmDelete({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [asking, setAsking] = useState(false)
  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className={SECONDARY} disabled={disabled}>
        <Trash2 size={16} aria-hidden /> Delete
      </button>
    )
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[13px] text-ink">Delete the listing and its contact?</span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="inline-flex h-10 items-center rounded-full bg-hard px-[18px] text-sm font-medium text-white disabled:opacity-50"
      >
        Delete
      </button>
      <button type="button" onClick={() => setAsking(false)} className={SECONDARY}>
        Keep
      </button>
    </span>
  )
}
