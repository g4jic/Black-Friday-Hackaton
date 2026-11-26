import { Calculator, FileText, Search, OctagonAlert, TriangleAlert, Check, Info, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { FieldDTO, SourceDTO, ValueDTO } from "./types"

/** Agents that exist today (no placeholders for agents that are not built). */
export const AGENTS: { name: string; short: string; icon: LucideIcon }[] = [
  { name: "Scout", short: "Scout", icon: Search },
  { name: "Finance analyst", short: "Finance", icon: Calculator },
  { name: "Lease reader", short: "Lease", icon: FileText },
]
export const agentIcon = (name: string): LucideIcon => AGENTS.find((a) => a.name === name)?.icon ?? Info

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ")
}

export function formatMoney(amount: number, currency: string): string {
  const fraction = Math.round(amount * 100) % 100 !== 0
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: fraction ? 2 : 0, maximumFractionDigits: 2 }).format(amount)} ${currency}`
}

const KIND_LABEL: Record<string, string> = { listing: "listing", profile: "profile", osm: "osm", calc: "calc", estimate: "est", lease: "lease", assumption: "assumption" }

/** One line per source, inputs indented: what the hover shows behind every number. */
export function describeSource(s: SourceDTO, depth = 0): string {
  const pad = "  ".repeat(depth)
  const head =
    s.kind === "listing" || s.kind === "lease"
      ? `${pad}${s.kind} ${s.ref}${s.field ? ` / ${s.field}` : ""}${s.clause ? ` / ${s.clause}` : ""}${s.quote ? `: "${s.quote}"` : ""}`
      : s.kind === "profile"
        ? `${pad}questionnaire / ${s.field ?? s.ref}`
        : `${pad}${s.kind}: ${s.ref}`
  return [head, ...(s.inputs ?? []).map((i) => describeSource(i, depth + 1))].join("\n")
}

/** The tiny pill after every number (DESIGN.md 6.6). */
export function SourceLabel({ source }: { source: SourceDTO }) {
  return (
    <span
      tabIndex={0}
      title={describeSource(source)}
      className="ml-1.5 inline-flex h-[18px] cursor-help items-center rounded-full border border-line bg-white/80 px-1.5 align-middle text-[11px] font-medium leading-none text-ink-2"
    >
      {KIND_LABEL[source.kind] ?? source.kind}
    </span>
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
  neutral: "bg-white text-ink shadow-[var(--shadow-soft)]",
  brand: "bg-purple-100 text-purple-700",
  hard: "bg-red-50 text-red-700",
  soft: "bg-amber-50 text-amber-800",
  positive: "bg-green-50 text-green-700",
  "solid-hard": "bg-red-600 text-white",
}
const PILL_ICON: Partial<Record<PillVariant, LucideIcon>> = { hard: OctagonAlert, soft: TriangleAlert, positive: Check }

export function Pill({ variant = "neutral", children, title, icon = true }: { variant?: PillVariant; children: ReactNode; title?: string; icon?: boolean }) {
  const Icon = icon ? PILL_ICON[variant] : undefined
  return (
    <span title={title} className={cx("inline-flex h-6 max-w-full items-center gap-1 rounded-full px-2.5 text-xs font-medium leading-none whitespace-nowrap", PILL[variant])}>
      {Icon && <Icon size={13} strokeWidth={2} aria-hidden />}
      <span className="truncate">{children}</span>
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
        "fade-in relative inline-flex shrink-0 items-center justify-center rounded-full bg-white shadow-[var(--shadow-soft)]",
        state === "busy" && "ring-busy",
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={size / 2} strokeWidth={1.75} className={state === "busy" ? "text-ink" : "text-ink-3"} />
      {state === "cancelled" && <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-600" />}
    </span>
  )
}

export function CountCircle({ n, tone }: { n: number; tone: "ink3" | "purple" | "amber" | "red" }) {
  const cls = { ink3: "bg-ink-3 text-white", purple: "bg-purple-600 text-white", amber: "bg-amber-400 text-ink", red: "bg-red-600 text-white" }[tone]
  return <span className={cx("tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium", cls)}>{n}</span>
}
