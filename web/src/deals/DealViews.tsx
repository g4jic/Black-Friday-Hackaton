import { CalendarClock, Check, CreditCard, HandCoins, KeyRound, Send, X } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, navigate, paths, setSearchParam, useLocation } from "../app/router"
import { Card } from "../app/Shell"
import { formatMoney } from "../format"
import type { PublicListing } from "../listings/listings-api"
import { useLoad } from "../listings/listings-api"
import { INPUT, LABEL } from "../pages/SettingsPage"
import { Pill, cx } from "../ui"
import { dateLabel, dealsApi, monthLabel, type Offer, type RentDue, type TenancyView } from "./deals-api"

const PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-40"
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full glass-strong px-[18px] text-sm font-medium text-ink hover:bg-white disabled:opacity-50"
const ROW = "glass-strong flex flex-col gap-3 rounded-[24px] p-4"

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.")

function firstOfNextMonth(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
}

const OFFER_PILL: Record<Offer["status"], { variant: "neutral" | "positive" | "hard" | "soft"; text: string }> = {
  pending: { variant: "soft", text: "Waiting for an answer" },
  accepted: { variant: "positive", text: "Accepted" },
  declined: { variant: "hard", text: "Declined" },
  withdrawn: { variant: "neutral", text: "Withdrawn" },
}

/** "Make an offer" on a listing page. */
export function OfferForm({ listing }: { listing: PublicListing }) {
  const [rent, setRent] = useState(String(listing.rentMonthly))
  const [startDate, setStartDate] = useState(firstOfNextMonth())
  const [months, setMonths] = useState(String(listing.minimumTermMonths))
  const [message, setMessage] = useState("")
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; text: string }>({ kind: "idle" })
  const send = async () => {
    setState({ kind: "sending" })
    try {
      await dealsApi.makeOffer(listing.id, { rentMonthly: Number(rent), startDate, termMonths: Number(months), message })
      setState({ kind: "sent" })
    } catch (e) {
      setState({ kind: "error", text: errorText(e) })
    }
  }
  if (state.kind === "sent")
    return (
      <Card title="Offer sent">
        <p>You can follow it in My spaces.</p>
        <Link to={paths.mySpaces()} className={cx(PRIMARY, "mt-4 w-full")}>
          Open My spaces
        </Link>
      </Card>
    )
  return (
    <Card title="Make an offer">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <label>
          <span className={LABEL}>Monthly rent you offer (EUR)</span>
          <input className={INPUT} inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={LABEL}>Start</span>
            <input className={INPUT} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            <span className={LABEL}>Months</span>
            <input className={INPUT} inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
          </label>
        </div>
        <label>
          <span className={LABEL}>Message (optional)</span>
          <textarea
            className={cx(INPUT, "h-20 py-2.5")}
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What your business does, when you could move in"
          />
        </label>
        {state.kind === "error" && (
          <p role="alert" className="text-[13px] text-hard">
            {state.text}
          </p>
        )}
        <button type="submit" className={PRIMARY} disabled={state.kind === "sending"}>
          <Send size={16} aria-hidden /> {state.kind === "sending" ? "Sending..." : "Send offer"}
        </button>
      </form>
    </Card>
  )
}

export function DueStatus({ due }: { due: RentDue }) {
  if (due.status === "paid")
    return (
      <Pill variant="positive" icon={false} title={due.payment ? `Reference ${due.payment.reference}` : undefined}>
        Paid
      </Pill>
    )
  if (due.status === "overdue") return <Pill variant="hard">Overdue</Pill>
  if (due.status === "due")
    return (
      <Pill variant="soft" icon={false}>
        Due {dateLabel(due.dueDate)}
      </Pill>
    )
  return <Pill icon={false}>Due {dateLabel(due.dueDate)}</Pill>
}

/** The rent months of a tenancy, each with its status; the first 12 shown, the rest behind "Show all". */
function Schedule({ view }: { view: TenancyView }) {
  const [all, setAll] = useState(false)
  const shown = all ? view.schedule : view.schedule.slice(0, 12)
  return (
    <div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {shown.map((d) => (
          <li key={d.period} className="flex items-center justify-between gap-2 rounded-[14px] bg-white/60 px-3 py-1.5 text-[13px]">
            <span className="text-ink">{monthLabel(d.period)}</span>
            <DueStatus due={d} />
          </li>
        ))}
      </ul>
      {view.schedule.length > 12 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 text-[13px] font-medium text-ink underline">
          {all ? "Show fewer" : `Show all ${view.schedule.length} months`}
        </button>
      )}
    </div>
  )
}

function TenancyRow({ view, onPaid }: { view: TenancyView; onPaid?: () => void }) {
  const t = view.tenancy
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pay = async (period: string) => {
    setPaying(true)
    setError(null)
    try {
      const { redirectUrl } = await dealsApi.pay(t.id, period)
      if (redirectUrl.startsWith("/")) navigate(redirectUrl)
      else window.location.assign(redirectUrl) // Stripe Checkout (test mode)
    } catch (e) {
      setError(errorText(e))
      setPaying(false)
      onPaid?.()
    }
  }
  const next = view.nextDue
  return (
    <li className={ROW}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={paths.listing(t.listingId)} className="block truncate text-sm font-semibold text-ink hover:underline">
            {t.listingTitle}
          </Link>
          <p className="tnum text-[13px] text-ink-2">
            {formatMoney(t.rentMonthly, t.currency)} / month · from {dateLabel(t.startDate)} · {t.termMonths} months ·{" "}
            {view.role === "tenant" ? "you rent it" : `rented by ${t.tenantName}`}
          </p>
        </div>
      </div>
      {next ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-ink">
            <CalendarClock size={16} aria-hidden /> Next rent: {formatMoney(next.amount, t.currency)} for {monthLabel(next.period)}, due{" "}
            {dateLabel(next.dueDate)}
            {next.status === "overdue" && <Pill variant="hard">Overdue</Pill>}
          </span>
          {view.role === "tenant" && (
            <button type="button" className={PRIMARY} disabled={paying} onClick={() => void pay(next.period)}>
              <CreditCard size={16} aria-hidden />
              {paying ? "Opening checkout..." : "Pay rent"}
            </button>
          )}
        </div>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-sm text-ink">
          <Check size={16} aria-hidden /> All rent for this lease is paid.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-hard">
          {error}
        </p>
      )}
      <Schedule view={view} />
    </li>
  )
}

export function OfferRow({ offer, side, onChange }: { offer: Offer; side: "tenant" | "landlord"; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChange()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }
  const pill = OFFER_PILL[offer.status]
  const answerable = offer.status === "pending" && (side === "landlord" || offer.isDemoListing)
  return (
    <li className={ROW}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={paths.listing(offer.listingId)} className="block truncate text-sm font-semibold text-ink hover:underline">
            {offer.listingTitle}
          </Link>
          <p className="tnum text-[13px] text-ink-2">
            {formatMoney(offer.rentMonthly, offer.currency)} / month · from {dateLabel(offer.startDate)} · {offer.termMonths} months
            {side === "landlord" && ` · from ${offer.tenantName}`}
          </p>
          {offer.message && <p className="mt-1 text-[13px] text-ink">"{offer.message}"</p>}
        </div>
        <Pill variant={pill.variant} icon={false}>
          {pill.text}
        </Pill>
      </div>
      {(answerable || (side === "tenant" && offer.status === "pending")) && (
        <div className="flex flex-wrap items-center gap-2">
          {answerable && (
            <>
              <button type="button" className={PRIMARY} disabled={busy} onClick={() => void act(() => dealsApi.answer(offer.id, "accept"))}>
                <Check size={16} aria-hidden /> Accept
              </button>
              <button type="button" className={SECONDARY} disabled={busy} onClick={() => void act(() => dealsApi.answer(offer.id, "decline"))}>
                <X size={16} aria-hidden /> Decline
              </button>
            </>
          )}
          {side === "tenant" && offer.status === "pending" && (
            <button type="button" className={SECONDARY} disabled={busy} onClick={() => void act(() => dealsApi.withdraw(offer.id))}>
              Withdraw
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-hard">
          {error}
        </p>
      )}
    </li>
  )
}

/** An empty state inside a card: icon and text on one line, under the card's title. */
export function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  )
}

/**
 * The tenant side (My spaces): spaces I rent with their rent, and my offers. After a checkout the browser comes back
 * with ?paid=<reference>: the server confirms the payment with the gateway before it is recorded.
 */
export function TenantDeals() {
  const { data, error, reload } = useLoad("deals", dealsApi.overview)
  const { search } = useLocation()
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null)
  const confirming = useRef<string | null>(null)
  useEffect(() => {
    const reference = search.get("paid")
    if (search.get("payment") === "cancelled") {
      setBanner({ ok: false, text: "The payment was cancelled. Nothing was paid." })
      setSearchParam("payment", null)
    }
    if (!reference || confirming.current === reference) return
    confirming.current = reference
    dealsApi.confirm(reference).then(
      (r) => {
        setBanner(
          r.payment
            ? {
                ok: true,
                text: `Rent for ${monthLabel(r.payment.period)} paid: ${formatMoney(r.payment.amount, r.payment.currency)}.`,
              }
            : { ok: false, text: "The checkout is not paid yet, so nothing was recorded." },
        )
        setSearchParam("paid", null)
        reload()
      },
      (e: unknown) => setBanner({ ok: false, text: errorText(e) }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])
  const rented = data?.tenancies.filter((t) => t.role === "tenant") ?? []
  return (
    <>
      {banner && (
        <p role="status" className={cx("rounded-[20px] px-4 py-3 text-sm font-medium", banner.ok ? "bg-white text-ink" : "bg-hard-50 text-hard")}>
          {banner.text}
        </p>
      )}
      <Card title="Spaces I rent" collapsible id="my-spaces-rent" count={data ? rented.length : undefined}>
        {error && (
          <p role="alert" className="text-hard">
            {error}
          </p>
        )}
        {!data && !error && <p>Loading...</p>}
        {data && rented.length === 0 && (
          <Empty icon={<KeyRound size={16} className="text-ink" aria-hidden />}>
            No rented spaces yet.
          </Empty>
        )}
        {rented.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {rented.map((v) => (
              <TenancyRow key={v.tenancy.id} view={v} onPaid={reload} />
            ))}
          </ul>
        )}
      </Card>
      <Card title="My offers" collapsible id="my-spaces-offers" count={data?.offersMade.length}>
        {data && data.offersMade.length === 0 && (
          <Empty icon={<HandCoins size={16} className="text-ink" aria-hidden />}>No offers yet. Open a listing and press Make an offer.</Empty>
        )}
        {data && data.offersMade.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {data.offersMade.map((o) => (
              <OfferRow key={o.id} offer={o} side="tenant" onChange={reload} />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

/** The owner side (My listings): offers received and leased spaces with the tenants' rent status. */
export function LandlordDeals() {
  const { data, error, reload } = useLoad("deals-landlord", dealsApi.overview)
  const leased = data?.tenancies.filter((t) => t.role === "landlord") ?? []
  return (
    <>
      <Card title="Offers received" collapsible id="offers-received" count={data?.offersReceived.length}>
        {error && (
          <p role="alert" className="text-hard">
            {error}
          </p>
        )}
        {!data && !error && <p>Loading...</p>}
        {data && data.offersReceived.length === 0 && (
          <Empty icon={<HandCoins size={16} className="text-ink" aria-hidden />}>No offers on your listings yet.</Empty>
        )}
        {data && data.offersReceived.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {data.offersReceived.map((o) => (
              <OfferRow key={o.id} offer={o} side="landlord" onChange={reload} />
            ))}
          </ul>
        )}
      </Card>
      <Card title="Leased spaces" collapsible id="offers-leased" count={data ? leased.length : undefined}>
        {data && leased.length === 0 && (
          <Empty icon={<KeyRound size={16} className="text-ink" aria-hidden />}>
            No leased spaces yet.
          </Empty>
        )}
        {leased.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {leased.map((v) => (
              <TenancyRow key={v.tenancy.id} view={v} />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

/** The simulated checkout: SuiteSpot's own form, used when no Stripe test keys are set. */
export function SimulatedPaymentPage({ reference }: { reference: string }) {
  const { search } = useLocation()
  const { data, error } = useLoad(`checkout:${reference}`, () => dealsApi.simulatedCheckout(reference))
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  /** Only paths on this site (the server builds them; never follow another origin). */
  const localPath = (url: string | null, fallback: string) => {
    try {
      const u = new URL(url ?? "", window.location.origin)
      return u.origin === window.location.origin ? u.pathname + u.search : fallback
    } catch {
      return fallback
    }
  }
  const pay = async () => {
    setPaying(true)
    setPayError(null)
    try {
      await dealsApi.simulatedPay(reference)
      navigate(localPath(search.get("success"), `${paths.mySpaces()}?paid=${encodeURIComponent(reference)}`))
    } catch (e) {
      setPayError(errorText(e))
      setPaying(false)
    }
  }
  return (
    <div className="mx-auto w-full max-w-[460px]">
      <Card title="Pay rent">
        {error && (
          <p role="alert" className="mt-4 text-hard">
            {error}
          </p>
        )}
        {!data && !error && <p className="mt-4">Loading...</p>}
        {data && (
          <>
            <p className="tnum mt-5 text-3xl font-semibold text-ink">{formatMoney(data.amount, data.currency)}</p>
            <p className="mt-1">Rent for {monthLabel(data.period)}</p>
            {payError && (
              <p role="alert" className="mt-3 text-[13px] text-hard">
                {payError}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" className={PRIMARY} disabled={paying || data.paid} onClick={() => void pay()}>
                <CreditCard size={16} aria-hidden />{" "}
                {data.paid ? "Already paid" : paying ? "Paying..." : `Pay ${formatMoney(data.amount, data.currency)}`}
              </button>
              <button type="button" className={SECONDARY} onClick={() => navigate(localPath(search.get("cancel"), `${paths.mySpaces()}?payment=cancelled`))}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
