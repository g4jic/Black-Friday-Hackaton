import { ArrowRight, CalendarClock, HandCoins } from "lucide-react"
import { Link, paths } from "../app/router"
import { Card } from "../app/Shell"
import { dealsApi, monthLabel } from "../deals/deals-api"
import { DueStatus, Empty, LandlordDeals, OfferRow } from "../deals/DealViews"
import { formatMoney } from "../format"
import { listingsApi, useLoad } from "../listings/listings-api"

const SECONDARY = "inline-flex h-9 items-center gap-1.5 rounded-full glass-strong px-4 text-[13px] font-medium text-ink hover:bg-white"

/**
 * Home for a space owner (and the owner half of Home for "both"): a short overview, not the list of spaces (that is
 * My listings). Three counts, the offers waiting for an answer (answer them here) and the next rent each lease is
 * due. Every number is counted from SuiteSpot's own records: the listings, their page views and the deals.
 */
export function OwnerOverview() {
  const listings = useLoad("my-listings", listingsApi.mine)
  const deals = useLoad("deals-landlord", dealsApi.overview)
  const views = listings.data?.reduce((sum, l) => sum + l.views, 0)
  const waiting = deals.data?.offersReceived.filter((o) => o.status === "pending") ?? []
  const leases = deals.data?.tenancies.filter((t) => t.role === "landlord" && t.nextDue) ?? []
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Published spaces" value={listings.data?.length} note="Your listings on SuiteSpot" />
        <Stat label="Views" value={views} note="Openings of your listing pages, all time" />
        <Stat label="Open offers" value={deals.data ? waiting.length : undefined} note="Offers waiting for your answer" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card
          title="Offers waiting"
          collapsible
          id="owner-home-offers"
          count={deals.data ? waiting.length : undefined}
          action={
            <Link to={paths.offers()} className={SECONDARY}>
              All offers <ArrowRight size={14} aria-hidden />
            </Link>
          }
        >
          {deals.error && (
            <p role="alert" className="text-hard">
              {deals.error}
            </p>
          )}
          {!deals.data && !deals.error && <p>Loading...</p>}
          {deals.data && waiting.length === 0 && (
            <Empty icon={<HandCoins size={16} className="text-ink" aria-hidden />}>No offers waiting for an answer.</Empty>
          )}
          {waiting.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {waiting.map((o) => (
                <OfferRow key={o.id} offer={o} side="landlord" onChange={deals.reload} />
              ))}
            </ul>
          )}
        </Card>
        <Card title="Next rent due" collapsible id="owner-home-rent" count={deals.data ? leases.length : undefined}>
          {!deals.data && !deals.error && <p>Loading...</p>}
          {deals.data && leases.length === 0 && <Empty icon={<CalendarClock size={16} className="text-ink" aria-hidden />}>No leased spaces yet.</Empty>}
          {leases.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {leases.map((v) => (
                <li key={v.tenancy.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[16px] bg-white/70 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{v.tenancy.listingTitle}</span>
                    <span className="tnum block text-[13px] text-ink-2">
                      {formatMoney(v.nextDue!.amount, "EUR")} for {monthLabel(v.nextDue!.period)} · rented by {v.tenancy.tenantName}
                    </span>
                  </span>
                  <DueStatus due={v.nextDue!} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: number | undefined; note: string }) {
  return (
    <div className="glass rounded-[28px] p-[22px]" title={note}>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="tnum mt-1.5 text-[32px] leading-none font-bold text-ink">{value ?? "-"}</p>
      <p className="mt-2 text-xs text-ink-3">{note}</p>
    </div>
  )
}

/** Offers: the offers on the owner's listings and the spaces they lease out, with the tenants' rent status. */
export function OffersPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <LandlordDeals />
    </div>
  )
}
