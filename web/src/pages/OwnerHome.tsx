import { Building2, Plus } from "lucide-react"
import { Link, paths } from "../app/router"
import { Card, EmptyState } from "../app/Shell"
import { dealsApi } from "../deals/deals-api"
import { LandlordDeals } from "../deals/DealViews"
import { formatMoney } from "../format"
import { floorLabel, listingsApi, useLoad } from "../listings/listings-api"

const PRIMARY = "inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]"

/**
 * Home for a space owner (and the owner half of Home for "both"): what seekers see, how many opened each listing
 * and who made an offer. Every number is counted from SuiteSpot's own records (the listings, their page views and
 * the offers), and each tile says what it counts.
 */
export function OwnerOverview({ showIntro }: { showIntro: boolean }) {
  const listings = useLoad("my-listings", listingsApi.mine)
  const deals = useLoad("deals-landlord", dealsApi.overview)
  const views = listings.data?.reduce((sum, l) => sum + l.views, 0)
  const openOffers = deals.data?.offersReceived.filter((o) => o.status === "pending").length
  // A listing with a lease (the owner is its landlord) shows "Leased" instead of "Published".
  const leased = new Set(deals.data?.tenancies.filter((t) => t.role === "landlord").map((t) => t.tenancy.listingId) ?? [])
  return (
    <div className="flex flex-col gap-4">
      {showIntro && <p className="text-[15px] text-ink-2">What seekers see, how many viewed it and who made an offer.</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Published spaces" value={listings.data?.length} note="Your listings on SuiteSpot" />
        <Stat label="Views" value={views} note="Openings of your listing pages, all time" />
        <Stat label="Open offers" value={openOffers} note="Offers waiting for your answer" />
      </div>
      <Card title="My listings" collapsible id="owner-home-listings" count={listings.data?.length}>
        <div className="flex flex-col gap-3.5">
          {listings.error && (
            <p role="alert" className="text-[13px] text-hard">
              {listings.error}
            </p>
          )}
          {!listings.data && !listings.error && <p className="text-sm text-ink-2">Loading...</p>}
          {listings.data && listings.data.length === 0 && (
            <EmptyState
              text="You have not listed a space yet. Add one and seekers can find it and evaluate it for their business."
              action={
                <Link to={paths.newListing()} className={PRIMARY}>
                  <Plus size={16} aria-hidden /> Add a space
                </Link>
              }
            />
          )}
          {listings.data && listings.data.length > 0 && (
            <div role="table" aria-label="My listings" className="flex flex-col gap-2">
              <div role="row" className="grid grid-cols-[minmax(0,3fr)_repeat(3,minmax(0,1fr))] gap-3 px-3 text-xs font-medium text-ink-3">
                <span role="columnheader">Space</span>
                <span role="columnheader">Monthly rent</span>
                <span role="columnheader">Views</span>
                <span role="columnheader">Status</span>
              </div>
              {listings.data.map((l) => (
                <Link
                  key={l.id}
                  to={paths.listing(l.id)}
                  role="row"
                  className="grid grid-cols-[minmax(0,3fr)_repeat(3,minmax(0,1fr))] items-center gap-3 rounded-[16px] bg-white/70 px-3 py-3.5 text-[15px] text-ink hover:bg-white"
                >
                  <span role="cell" className="flex min-w-0 items-center gap-2.5 font-semibold">
                    <Building2 size={18} className="shrink-0 text-ink-2" aria-hidden />
                    <span className="truncate">
                      {l.district} · {l.areaM2} m², {floorLabel(l.floor).toLowerCase()}
                    </span>
                  </span>
                  <span role="cell" className="tnum">
                    {formatMoney(l.rentMonthly, "EUR")}
                  </span>
                  <span role="cell" className="tnum">
                    {l.views}
                  </span>
                  <span role="cell">
                    {leased.has(l.id) ? (
                      <span className="rounded-full bg-lilac-100 px-3 py-1 text-[13px] font-semibold text-ink">Leased</span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-[13px] font-semibold text-green-700">Published</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
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
    <div className="grid gap-4 lg:grid-cols-2">
      <LandlordDeals />
    </div>
  )
}
