import { ImageUp, X } from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { createPortal } from "react-dom"
import { uploadAvatarImage } from "./auth"

/** The crop frame on screen, in CSS pixels (the stored photo is AVATAR_PX square). */
const FRAME = 260
const AVATAR_PX = 256
const MAX_ZOOM = 3
const ACCEPT = "image/jpeg,image/png,image/webp"

type Offset = { x: number; y: number }

/** Keeps the image covering the whole frame: its top left corner stays between (FRAME - size) and 0. */
const clamp = (offset: Offset, width: number, height: number): Offset => ({
  x: Math.min(0, Math.max(FRAME - width, offset.x)),
  y: Math.min(0, Math.max(FRAME - height, offset.y)),
})

/**
 * The profile photo dialog: choose a picture, move it and zoom it inside a round frame, save. The crop is drawn on a
 * canvas in the browser and only that small square is uploaded; the original never leaves the device.
 */
export function PhotoDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; startX: number; startY: number; from: Offset } | null>(null)
  const objectUrl = useRef<string | null>(null)

  const base = image ? FRAME / Math.min(image.naturalWidth, image.naturalHeight) : 1
  const scale = base * zoom
  const width = image ? image.naturalWidth * scale : FRAME
  const height = image ? image.naturalHeight * scale : FRAME

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !saving && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, saving])
  useEffect(() => () => void (objectUrl.current && URL.revokeObjectURL(objectUrl.current)), [])

  const choose = (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError("Choose a JPEG, PNG or WebP image.")
    if (file.size > 15 * 1024 * 1024) return setError("The image is too large (at most 15 MB).")
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = url
      const s = FRAME / Math.min(img.naturalWidth, img.naturalHeight)
      setImage(img)
      setZoom(1)
      setOffset({ x: (FRAME - img.naturalWidth * s) / 2, y: (FRAME - img.naturalHeight * s) / 2 })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError("This image could not be read. Try another one.")
    }
    img.src = url
  }

  /** Zooms around the centre of the frame, so the part in the middle stays in the middle. */
  const changeZoom = (next: number) => {
    if (!image) return
    const nextScale = base * next
    const centre = { x: (FRAME / 2 - offset.x) / scale, y: (FRAME / 2 - offset.y) / scale }
    setZoom(next)
    setOffset(clamp({ x: FRAME / 2 - centre.x * nextScale, y: FRAME / 2 - centre.y * nextScale }, image.naturalWidth * nextScale, image.naturalHeight * nextScale))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!image) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, from: offset }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointer !== event.pointerId) return
    setOffset(clamp({ x: d.from.x + event.clientX - d.startX, y: d.from.y + event.clientY - d.startY }, width, height))
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const save = async () => {
    if (!image || saving) return
    setSaving(true)
    setError(null)
    try {
      const side = FRAME / scale
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = Math.min(AVATAR_PX, Math.round(side))
      const context = canvas.getContext("2d")
      if (!context) throw new Error("This browser cannot prepare the photo.")
      context.fillStyle = "#ffffff" // a transparent PNG gets a white background in the JPEG
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.imageSmoothingQuality = "high"
      context.drawImage(image, -offset.x / scale, -offset.y / scale, side, side, 0, 0, canvas.width, canvas.height)
      await uploadAvatarImage(canvas.toDataURL("image/jpeg", 0.86))
      onSaved()
    } catch (failure) {
      setError((failure as Error).message)
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 p-4" onPointerDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-dialog-title"
        tabIndex={-1}
        className="popover glass-strong flex w-full max-w-[340px] flex-col items-center gap-4 p-5 outline-none"
      >
        <div className="flex w-full items-center justify-between">
          <h2 id="photo-dialog-title" className="text-base font-semibold text-ink">
            Profile photo
          </h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white">
            <X size={18} aria-hidden />
          </button>
        </div>

        <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(event) => {
            choose(event.target.files?.[0])
            event.target.value = "" // the same file can be chosen again after an error
          }} />
        {image ? (
          <>
            <div
              className="relative cursor-grab touch-none overflow-hidden rounded-[20px] bg-white/70 select-none active:cursor-grabbing"
              style={{ width: FRAME, height: FRAME }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-label="Drag to move the photo"
            >
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
                style={{ width, height, transform: `translate(${offset.x}px, ${offset.y}px)` }}
              />
              {/* the round part that becomes the avatar; the corners are dimmed */}
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_200px_rgba(255,255,255,0.6)]" />
            </div>
            <label className="flex w-full items-center gap-3 text-[13px] text-ink-2">
              Zoom
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => changeZoom(Number(event.target.value))}
                className="flex-1 accent-[var(--color-brand)]"
              />
            </label>
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-ink/15 bg-white/60 text-sm font-medium text-ink hover:bg-white"
            style={{ width: FRAME, height: FRAME }}
          >
            <ImageUp size={28} aria-hidden />
            Upload a photo
          </button>
        )}

        <p className="text-[12px] text-ink-2">JPEG, PNG or WebP</p>
        {error && (
          <p role="alert" className="text-center text-[13px] text-hard">
            {error}
          </p>
        )}

        {image && (
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={saving}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-full glass-strong px-4 text-sm font-medium text-ink hover:bg-white disabled:opacity-60"
            >
              Choose another
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
