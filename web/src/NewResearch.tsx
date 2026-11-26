import { Play, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import type { Config } from "./types"
import { Pill } from "./ui"

type Draft = { text: string; lease: string; showLease: boolean }
const empty = (): Draft => ({ text: "", lease: "", showLease: false })

const INPUT = "w-full rounded-[18px] border border-white/80 bg-white/85 px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"

export function NewResearch({
  config,
  busy,
  error,
  onRunDemo,
  onRunPasted,
}: {
  config: Config | null
  busy: boolean
  error: string | null
  onRunDemo: () => void
  onRunPasted: (listings: { text: string; lease?: string }[]) => void
}) {
  const [drafts, setDrafts] = useState<Draft[]>([empty()])
  const max = config?.maxListings ?? 8
  const filled = drafts.filter((d) => d.text.trim())
  const live = Boolean(config?.liveAvailable)
  const update = (i: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)))

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="surface flex flex-col rounded-[24px] p-6">
        <span className="self-start title-pill rounded-full glass-strong px-3.5 py-1.5 text-lg leading-6 font-semibold">Run the demo</span>
        <p className="mt-4 text-sm leading-5 text-ink-2">
          Eight synthetic commercial listings in Novi Sad and three lease drafts, checked for a specialty coffee bar with a budget of
          1,500 EUR a month. Keyless and deterministic: the agents' answers are scripted, every number is still computed and checked by code.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Pill variant="brand" icon={false}>
            Demo data
          </Pill>
          <Pill icon={false}>8 listings</Pill>
          <Pill icon={false}>3 lease drafts</Pill>
          <Pill icon={false}>no API key</Pill>
        </div>
        <button
          type="button"
          onClick={onRunDemo}
          disabled={busy}
          className="mt-6 inline-flex h-10 items-center gap-2 self-start rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-50"
        >
          <Play size={16} strokeWidth={2} /> Run demo
        </button>
      </section>

      <section className="glass rounded-[28px] p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="title-pill rounded-full glass-strong px-3.5 py-1.5 text-lg leading-6 font-semibold">Paste listings</span>
          <span className="text-[13px] text-ink-2">
            1 to {max} listings, pasted as text. SuiteSpot never opens listing sites. Phone numbers and emails are removed before anything is stored.
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {drafts.map((d, i) => (
            <div key={i} className="glass-strong rounded-[24px] p-4">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor={`listing-${i}`} className="text-xs font-medium text-ink">
                  Listing {i + 1}
                </label>
                {drafts.length > 1 && (
                  <button type="button" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))} aria-label={`Remove listing ${i + 1}`} className="rounded-full p-1 text-ink-3 hover:bg-white/95 hover:text-ink">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <textarea id={`listing-${i}`} rows={4} value={d.text} onChange={(e) => update(i, { text: e.target.value })} placeholder="Paste the full text of the listing" className={INPUT} />
              {d.showLease ? (
                <textarea rows={3} value={d.lease} onChange={(e) => update(i, { lease: e.target.value })} placeholder="Paste the lease draft (optional)" className={`${INPUT} mt-2`} aria-label={`Lease draft for listing ${i + 1}`} />
              ) : (
                <button type="button" onClick={() => update(i, { showLease: true })} className="mt-2 text-xs font-medium text-ink hover:underline">
                  Add lease draft
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setDrafts([...drafts, empty()])}
            disabled={drafts.length >= max}
            className="inline-flex h-10 items-center gap-2 rounded-full glass-strong px-[18px] text-sm font-medium text-ink hover:bg-white disabled:opacity-50"
          >
            <Plus size={16} /> Add listing
          </button>
          <button
            type="button"
            onClick={() => onRunPasted(filled.map((d) => ({ text: d.text, ...(d.lease.trim() ? { lease: d.lease } : {}) })))}
            disabled={!live || busy || filled.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-[#26262e] disabled:opacity-40"
          >
            <Play size={16} /> Run with {filled.length || ""} pasted listing{filled.length === 1 ? "" : "s"}
          </button>
          {!live && <span className="text-[13px] text-ink-2">Live mode is off on this server. Pasted listings need a model ({config?.liveModel ?? "claude-haiku-4-5"}); the demo runs keyless.</span>}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-hard">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
