import { Building2, Calculator, FileText, MapPin, ListOrdered, PenLine, Search, ShieldCheck, OctagonAlert, TriangleAlert, Check, Info, type LucideIcon } from "lucide-react"
import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from "react"
import { createPortal } from "react-dom"
import { formatMoney } from "./format"
import type { FieldDTO, SourceDTO, ValueDTO } from "./types"

/** Agents that exist today (no placeholders for agents that are not built). */
export const AGENTS: { name: string; short: string; icon: LucideIcon }[] = [
  { name: "Scout", short: "Scout", icon: Search },
  { name: "Finance analyst", short: "Finance", icon: Calculator },
  { name: "Lease reader", short: "Lease", icon: FileText },
  { name: "Location analyst", short: "Location", icon: MapPin },
  { name: "Premises inspector", short: "Premises", icon: Building2 },
  { name: "Ranker", short: "Ranker", icon: ListOrdered },
  { name: "Report writer", short: "Report", icon: PenLine },
  { name: "Auditor", short: "Auditor", icon: ShieldCheck },
]
export const agentIcon = (name: string): LucideIcon => AGENTS.find((a) => a.name === name)?.icon ?? Info

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ")
}

export { formatMoney }

const KIND_LABEL: Record<string, string> = { listing: "listing", profile: "profile", osm: "osm", calc: "calc", estimate: "est", lease: "lease", assumption: "assumption" }

/** One line per source, inputs indented: what the hover shows behind every number. */
export function describeSource(s: SourceDTO, depth = 0): string {
  const pad = "  ".repeat(depth)
  const head =
    s.kind === "listing" || s.kind === "lease"
      ? `${pad}${s.kind} ${s.ref}${s.field ? ` / ${s.field}` : ""}${s.clause ? ` / ${s.clause}` : ""}${s.quote ? `: "${s.quote}"` : ""}${s.missing ? ": not stated in the text" : ""}${s.form ? " (as typed in the listing form)" : ""}`
      : s.kind === "profile"
        ? `${pad}questionnaire / ${s.field ?? s.ref}`
        : `${pad}${s.kind}: ${s.ref}`
  return [head, ...(s.inputs ?? []).map((i) => describeSource(i, depth + 1))].join("\n")
}

const SOURCE_POPOVER_W = 280

/**
 * The tiny pill after every number (DESIGN.md 6.6). A hover shows the source chain as a tooltip; a tap or a click
 * (phones and tablets have no hover) or Enter opens it as a small panel, closed by another tap, Escape, scrolling or
 * focus leaving. The panel is fixed to the window (portalled), so a scrolling or clipped card never cuts it off.
 */
export function SourceLabel({ source }: { source: SourceDTO }) {
  const [at, setAt] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  // A span with the button role, not a <button>: the pill often sits inside a card that is a link, where a real
  // button would be invalid HTML. The click never reaches the link (no navigation when the user opens a source).
  const button = useRef<HTMLSpanElement>(null)
  const id = useId()
  const text = describeSource(source)
  const toggle = (event: SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (at) return setAt(null)
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(SOURCE_POPOVER_W, window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    // In the lower part of the window the panel opens upwards, so it is never cut off by the bottom edge.
    setAt(r.bottom > window.innerHeight * 0.6 ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 })
  }
  useEffect(() => {
    if (!at) return
    const close = () => setAt(null)
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close()
    // Safari does not focus a button on click, so a tap elsewhere closes it here instead of through blur.
    const onPointer = (event: PointerEvent) => !button.current?.contains(event.target as Node) && close()
    window.addEventListener("pointerdown", onPointer, true)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onPointer, true)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
      window.removeEventListener("keydown", onKey)
    }
  }, [at])
  return (
    <>
      <span
        ref={button}
        role="button"
        tabIndex={0}
        title={at ? undefined : text}
        aria-label={`Source: ${text}`}
        aria-expanded={at !== null}
        aria-controls={at ? id : undefined}
        onClick={toggle}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && toggle(event)}
        onBlur={() => setAt(null)}
        className="ml-1.5 inline-flex h-[18px] cursor-help items-center rounded-full border border-line bg-white/80 px-1.5 align-middle text-[11px] font-medium leading-none text-ink-2 hover:bg-white"
      >
        {KIND_LABEL[source.kind] ?? source.kind}
      </span>
      {at &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="popover glass-strong fixed z-[60] block p-3 text-left text-[12px] leading-[1.45] font-normal whitespace-pre-wrap text-ink"
            style={{ left: at.left, top: at.top, bottom: at.bottom, width: Math.min(SOURCE_POPOVER_W, window.innerWidth - 16) }}
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  )
}

export function MissingValue({ value }: { value: Extract<ValueDTO, { kind: "missing" }> }) {
  if (value.unverified) {
    return (
      <Pill variant="soft" title={`Could not be verified from the text: ${value.unverified}`}>
        unverified
      </Pill>
    )
  }
  return <span className="text-[13px] italic text-ink-3">missing data</span>
}

export function ValueText({ value }: { value: ValueDTO }) {
  switch (value.kind) {
    case "money":
      return <span className="tnum">{formatMoney(value.amount, value.currency)}</span>
    case "area":
      return <span className="tnum">{value.m2} m²</span>
    case "number":
      return <span className="tnum">{value.value}</span>
    case "text":
      return <span>{value.value}</span>
    case "bool":
      return <span>{value.value ? "yes" : "no"}</span>
    case "rent_multiple":
      return <span>{value.months} month(s) of rent</span>
    case "missing":
      return <MissingValue value={value} />
    default:
      return <span className="text-ink-3">-</span>
  }
}

/** A value with its source label, or MissingData. Estimates get the dashed chip (none exist yet). */
export function Sourced({ field, render }: { field: FieldDTO | undefined; render?: (v: ValueDTO) => ReactNode }) {
  if (!field) return <span className="text-[13px] italic text-ink-3">missing data</span>
  if (field.value.kind === "missing") return <ValueText value={field.value} />
  const body = render ? render(field.value) : <ValueText value={field.value} />
  if (field.source?.kind === "estimate") {
    return (
      <span className="inline-flex items-center rounded-lg border border-dashed border-est-border bg-est-bg px-2 py-0.5 text-est-text">
        {body}
        <SourceLabel source={field.source} />
      </span>
    )
  }
  return (
    <span className="whitespace-nowrap">
      {body}
      {field.source && <SourceLabel source={field.source} />}
    </span>
  )
}

type PillVariant = "neutral" | "brand" | "hard" | "soft" | "positive" | "solid-hard"
const PILL: Record<PillVariant, string> = {
  neutral: "glass-strong text-ink",
  brand: "bg-lilac text-ink",
  hard: "bg-hard-50 text-hard",
  soft: "bg-amber-50 text-amber-800",
  positive: "bg-green-50 text-green-700",
  "solid-hard": "bg-hard text-white",
}
/** Hard flags always carry an icon (never colour alone); the text says "Hard flag" where the flag is named. */
const PILL_ICON: Partial<Record<PillVariant, LucideIcon>> = { hard: OctagonAlert, "solid-hard": OctagonAlert, soft: TriangleAlert, positive: Check }

/** wrap: long text (flag reasons) breaks onto a second line instead of being cut off. */
export function Pill({ variant = "neutral", children, title, icon = true, wrap = false }: { variant?: PillVariant; children: ReactNode; title?: string; icon?: boolean; wrap?: boolean }) {
  const Icon = icon ? PILL_ICON[variant] : undefined
  return (
    <span
      title={title}
      className={cx(
        "inline-flex max-w-full items-center gap-1 px-2.5 text-xs font-medium",
        wrap ? "min-h-6 rounded-[12px] py-1 leading-4" : "h-6 rounded-full leading-none whitespace-nowrap",
        PILL[variant],
      )}
    >
      {Icon && <Icon size={13} strokeWidth={2} aria-hidden className="shrink-0" />}
      <span className={wrap ? "" : "truncate"}>{children}</span>
    </span>
  )
}

/** Agent icon chip (DESIGN.md 6.8): purple ring while busy, grey when idle, red dot when cancelled. */
export function AgentChip({ name, state, size = 32 }: { name: string; state: "busy" | "idle" | "cancelled"; size?: number }) {
  const Icon = agentIcon(name)
  return (
    <span
      title={`${name}${state === "busy" ? " (working)" : state === "cancelled" ? " (cancelled)" : ""}`}
      aria-label={`${name} ${state}`}
      className={cx(
        "fade-in relative inline-flex shrink-0 items-center justify-center rounded-full glass-strong",
        state === "busy" && "ring-busy",
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={size / 2} strokeWidth={1.75} className={state === "busy" ? "text-ink" : "text-ink-3"} />
      {state === "cancelled" && <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-hard" />}
    </span>
  )
}

export function CountCircle({ n, tone }: { n: number; tone: "ink3" | "purple" | "amber" | "red" }) {
  const cls = { ink3: "bg-ink-3 text-white", purple: "bg-brand text-ink", amber: "bg-amber-400 text-ink", red: "bg-hard text-white" }[tone]
  return <span className={cx("tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium", cls)}>{n}</span>
}
