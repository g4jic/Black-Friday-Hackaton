import { Bookmark, Building2, KeyRound } from "lucide-react"
import { Link, paths } from "../app/router"
import { Card } from "../app/Shell"
import { formatMoney } from "../format"
import { listingsApi, useLoad } from "../listings/listings-api"
import { SaveButton } from "../listings/SaveButton"

const CTA = "inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]"

/** My spaces: the spaces I saved (watchlist) and the spaces I rent. */
export function MySpacesPage() {
  const { data, error } = useLoad("my-saved", listingsApi.saved)
  return (
    <div className="flex flex-col gap-4">
      <Card title="Saved spaces">
        {error && <p role="alert" className="text-hard">{error}</p>}
        {!data && !error && <p>Loading...</p>}
        {data && data.length === 0 && (
          <div className="flex flex-col items-start gap-4">
            <p className="inline-flex items-center gap-2">
              <Bookmark size={16} className="text-ink" aria-hidden /> Nothing saved yet. Press Save on a listing to keep it here.
            </p>
            <Link to={paths.findSpaces()} className={CTA}>
              Find spaces
            </Link>
          </div>
        )}
        {data && data.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {data.map((l) => (
              <li key={l.id} className="glass-strong flex flex-wrap items-center gap-4 rounded-[24px] p-4">
                <Building2 size={20} className="text-ink-2" aria-hidden />
                <Link to={paths.listing(l.id)} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{l.title}</span>
                  <span className="tnum block text-[13px] text-ink-2">
                    {l.district}, {l.city} · {l.areaM2} m² · {formatMoney(l.rentMonthly, "EUR")} / month
                  </span>
                </Link>
                <SaveButton listingId={l.id} className="w-[200px]" />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Spaces I rent">
        <div className="flex flex-col items-start gap-4">
          <p className="inline-flex items-center gap-2">
            <KeyRound size={16} className="text-ink" aria-hidden /> No rented spaces yet. When you rent a space through SuiteSpot it appears here.
          </p>
          <Link to={paths.findSpaces()} className={CTA}>
            Find spaces
          </Link>
        </div>
      </Card>
    </div>
  )
}

