import { Bookmark, KeyRound } from "lucide-react"
import { Link, paths } from "../app/router"
import { Card } from "../app/Shell"

const CTA = "inline-flex h-10 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e]"

/** My spaces: the spaces I saved (watchlist) and the spaces I rent. */
export function MySpacesPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Saved spaces">
        <div className="flex flex-col items-start gap-4">
          <p className="inline-flex items-center gap-2">
            <Bookmark size={16} className="text-ink" aria-hidden /> Nothing saved yet. Press Save on a listing or a result to keep it here.
          </p>
          <Link to={paths.findSpaces()} className={CTA}>
            Find spaces
          </Link>
        </div>
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
