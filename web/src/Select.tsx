import { Check, ChevronDown } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { cx } from "./ui"

export type SelectOption<V extends string> = { readonly value: V; readonly label: string }

/**
 * The one dropdown of the app (DESIGN.md 4 and 6.12). Closed it looks like the other fields; open, a glass panel
 * (strong glass, card radius) lists the options with a soft brand hover and a check next to the chosen one. The panel
 * is portalled to <body> with a fixed position, so a card edge never clips it; it opens upwards when there is no room
 * below. Keyboard: Enter, Space or the arrows open it; the arrows move, Home and End jump, Enter or Space choose,
 * Escape and Tab close, a letter jumps to the next option starting with it. A click outside closes it. The placeholder
 * ("Choose") is shown while nothing is chosen and is not an option. No motion with reduced motion (.pop-in).
 */
export function Select<V extends string>({
  value,
  onChange,
  options,
  placeholder = "Choose",
  className,
  ariaLabel,
  disabled,
}: {
  value: V | ""
  onChange: (value: V) => void
  options: readonly SelectOption<V>[]
  placeholder?: string
  className?: string
  ariaLabel?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const chosen = options.findIndex((o) => o.value === value)
  const label = chosen >= 0 ? options[chosen]!.label : placeholder

  const openAt = (index: number) => {
    if (disabled) return
    setActive(Math.max(0, Math.min(options.length - 1, index)))
    setOpen(true)
  }
  const close = (focusButton = true) => {
    setOpen(false)
    setPlace(null)
    if (focusButton) buttonRef.current?.focus()
  }
  const choose = (index: number) => {
    const option = options[index]
    if (option) onChange(option.value)
    close()
  }

  // Place the panel under the field (or above it when the window has no room below), in viewport coordinates.
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const r = buttonRef.current?.getBoundingClientRect()
      if (!r) return
      const below = window.innerHeight - r.bottom - 12
      const above = r.top - 12
      const want = Math.min(320, options.length * 40 + 12)
      const down = below >= Math.min(want, 200) || below >= above
      setPlace({
        left: r.left,
        width: r.width,
        maxHeight: Math.max(120, Math.min(320, down ? below : above)),
        ...(down ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }),
      })
    }
    measure()
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [open, options.length])

  // Focus the list once it is on screen (it renders after its place is measured).
  const shown = open && place !== null
  useEffect(() => {
    if (shown) listRef.current?.focus({ preventScroll: true })
  }, [shown])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!listRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  // Keep the active option in view while moving with the keyboard.
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [open, active])

  /** A letter jumps to the next option whose label starts with it. */
  const jumpTo = (key: string, from: number) => {
    const letter = key.toLowerCase()
    for (let step = 1; step <= options.length; step++) {
      const i = (from + step) % options.length
      if (options[i]!.label.toLowerCase().startsWith(letter)) return i
    }
    return -1
  }

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault()
      openAt(chosen >= 0 ? chosen : event.key === "ArrowUp" ? options.length - 1 : 0)
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      const i = jumpTo(event.key, chosen)
      if (i >= 0) onChange(options[i]!.value)
    }
  }

  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const move = (to: number) => {
      event.preventDefault()
      setActive((to + options.length) % options.length)
    }
    if (event.key === "ArrowDown") move(active + 1)
    else if (event.key === "ArrowUp") move(active - 1)
    else if (event.key === "Home") move(0)
    else if (event.key === "End") move(options.length - 1)
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      choose(active)
    } else if (event.key === "Escape") {
      event.preventDefault()
      close()
    } else if (event.key === "Tab") close(false)
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      const i = jumpTo(event.key, active)
      if (i >= 0) move(i)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel ? `${ariaLabel}: ${label}` : undefined}
        onClick={() => (open ? close() : openAt(chosen >= 0 ? chosen : 0))}
        onKeyDown={onButtonKey}
        className={cx(className, "flex items-center justify-between gap-2 text-left")}
      >
        <span className={cx("truncate", chosen < 0 && "text-ink-3")}>{label}</span>
        <ChevronDown size={16} className={cx("shrink-0 text-ink-2 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      {open &&
        place &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKey}
            style={{ position: "fixed", left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
            className="pop-in z-[70] overflow-y-auto rounded-[24px] glass-strong p-1.5 shadow-[var(--shadow-pop)] outline-none"
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={cx(
                  "flex items-center justify-between gap-3 rounded-[16px] px-3 py-2 text-sm text-ink",
                  i === active && "bg-brand-soft/25",
                  o.value === value && "font-semibold",
                )}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={16} className="shrink-0" aria-hidden />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}
