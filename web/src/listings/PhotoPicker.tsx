import { ImagePlus, LoaderCircle, Star, X } from "lucide-react"
import { useRef, useState } from "react"
import { authHeaders } from "../app/auth"
import { cx } from "../ui"

/** The same limit as the domain (LISTING_LIMITS.photosMax). */
export const MAX_LISTING_PHOTOS = 6
const LONG_SIDE_PX = 1600
const ACCEPT = "image/jpeg,image/png,image/webp"

/** Shrinks a picture in the browser (at most 1600 px on the long side, JPEG) so only that copy is uploaded. */
async function shrink(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: choose a JPEG, PNG or WebP image.`)
  if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: the image is too large (at most 25 MB).`)
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`${file.name} could not be read. Try another image.`))
      img.src = url
    })
    const scale = Math.min(1, LONG_SIDE_PX / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("This browser cannot prepare the photo.")
    context.fillStyle = "#ffffff" // a transparent PNG gets a white background in the JPEG
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function upload(image: string): Promise<string> {
  const response = await fetch("/api/me/listing-photos", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ image }) })
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !data.url) throw new Error(data.error ?? "The photo could not be saved. Try again.")
  return data.url
}

/**
 * The listing's photos: add several at once, remove one, or make one the cover (the first photo, shown on the card).
 * Each photo is uploaded as soon as it is chosen; the listing keeps their addresses when it is saved.
 */
export function PhotoPicker({ photos, onChange, problem }: { photos: string[]; onChange: (photos: string[]) => void; problem?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // The latest list, so photos that finish uploading one after another are all kept.
  const latest = useRef(photos)
  latest.current = photos

  const add = async (files: File[]) => {
    setError(null)
    const room = MAX_LISTING_PHOTOS - photos.length - uploading
    if (files.length > room) setError(`At most ${MAX_LISTING_PHOTOS} photos; the first ${Math.max(0, room)} were added.`)
    const chosen = files.slice(0, Math.max(0, room))
    setUploading((n) => n + chosen.length)
    for (const file of chosen) {
      try {
        const url = await upload(await shrink(file))
        latest.current = [...latest.current, url]
        onChange(latest.current)
      } catch (failure) {
        setError((failure as Error).message)
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const remove = (url: string) => onChange(photos.filter((p) => p !== url))
  const makeCover = (url: string) => onChange([url, ...photos.filter((p) => p !== url)])
  const full = photos.length + uploading >= MAX_LISTING_PHOTOS

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((url, index) => (
          <figure key={url} className="group relative aspect-[4/3] overflow-hidden rounded-[18px] bg-white/70">
            <img src={url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
            {index === 0 && <span className="absolute top-2 left-2 rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-white">Cover</span>}
            <div className="absolute top-2 right-2 flex gap-1.5">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => makeCover(url)}
                  aria-label={`Make photo ${index + 1} the cover`}
                  title="Make cover"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm hover:bg-white"
                >
                  <Star size={15} aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                aria-label={`Remove photo ${index + 1}`}
                title="Remove"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm hover:bg-white"
              >
                <X size={15} aria-hidden />
              </button>
            </div>
          </figure>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <div key={`uploading-${i}`} className="flex aspect-[4/3] items-center justify-center rounded-[18px] bg-white/60 text-ink-2" aria-label="Uploading a photo">
            <LoaderCircle size={22} className="animate-spin" aria-hidden />
          </div>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-[18px] border-2 border-dashed border-ink/15 bg-white/50 text-[13px] font-medium text-ink hover:bg-white"
          >
            <ImagePlus size={22} aria-hidden />
            Add photos
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void add([...(event.target.files ?? [])])
          event.target.value = "" // the same file can be chosen again
        }}
      />
      <p className={cx("mt-2 text-[12px] text-ink-2")}>Up to {MAX_LISTING_PHOTOS} photos, JPEG, PNG or WebP. The first one is the cover.</p>
      {(error || problem) && (
        <p role="alert" className="mt-1 text-[13px] text-hard">
          {error ?? problem}
        </p>
      )}
    </div>
  )
}
