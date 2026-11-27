import { useState } from "react"
import { cx } from "../ui"

/**
 * The account's face: the profile photo when there is one (and it loads), else the first letter of the name. The
 * caller sets the size and the background colour.
 */
export function AvatarFace({ name, url, className }: { name: string; url: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const showPhoto = Boolean(url) && failed !== url
  return (
    <span className={cx("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-ink", className)}>
      {showPhoto ? (
        <img src={url!} alt="" draggable={false} decoding="async" onError={() => setFailed(url)} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initialOf(name)}</span>
      )}
    </span>
  )
}

/** The first letter of the name (a whole character, so an emoji or an accented letter is never cut in half). */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0]
  return first ? first.toLocaleUpperCase() : "?"
}
