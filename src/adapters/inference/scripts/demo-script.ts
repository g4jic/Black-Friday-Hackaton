import type { InferenceInput } from "@mozaik-ai/core"
import { developerText, lastUserText, toolOutputs, type MockReply, type MockScript } from "../mock-runner.js"
import { scoutDemoScript } from "./scout-script.js"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type DemoLatency = { scout?: (listingId: string) => number; leaseReader?: number; financeStep?: number; locationStep?: number; premisesStep?: number; reportWriter?: number }

/** Demo-mode "model" for the Lease reader: replays the scripted answer for the lease id in the message. */
export function leaseReaderDemoScript(answers: Record<string, unknown>, latencyMs = 0): MockScript {
  return async (input): Promise<MockReply> => {
    const id = /Lease id: (\S+)/.exec(lastUserText(input))?.[1]
    if (latencyMs > 0) await sleep(latencyMs)
    if (!id || !(id in answers)) return { text: `No scripted answer for lease "${id ?? "?"}"` }
    return { text: JSON.stringify(answers[id]) }
  }
}

/**
 * Demo-mode "model" for the Finance analyst: follows its instruction (two calculate calls, one per turn), then
 * explains using only the numbers the tool returned. It never computes anything itself.
 */
export function financeDemoScript(stepLatencyMs = 0): MockScript {
  return async (input): Promise<MockReply> => {
    if (stepLatencyMs > 0) await sleep(stepLatencyMs)
    const outputs = toolOutputs(input)
    if (outputs.length === 0) return { toolCall: { name: "calculate", args: { calculations: ["monthly_cost", "initial_costs", "rent_per_m2"] } } }
    if (outputs.length === 1) {
      return { toolCall: { name: "calculate", args: { calculations: ["total_cost_over_term", "exit_cost_after_12_months", "cost_share_of_revenue", "break_even_revenue", "payback_months"] } } }
    }
    const value = (name: string) => new RegExp(`^${name} = ([^\\[;]+)`, "m").exec(outputs.join("\n"))?.[1]?.trim() ?? "missing data"
    const exit = value("exit_cost_after_12_months")
    const explanation = [
      `The space costs ${value("monthly_cost")} per month and ${value("total_cost_over_term")} in total.`,
      exit.startsWith("needs lease terms") ? "The cost of leaving after 12 months needs the lease terms (the notice period is unknown)." : `Leaving after 12 months would cost ${exit}.`,
      `That is ${value("cost_share_of_revenue")} of the expected revenue. Break-even revenue: ${value("break_even_revenue")}.`,
    ].join(" ")
    return { text: JSON.stringify({ explanation }) }
  }
}

/**
 * Demo-mode "model" for the Location analyst: calls area_data once, then copies the counts the tool returned into two
 * sentences (no number of its own). When the address was not found, it says so.
 */
export function locationDemoScript(stepLatencyMs = 0): MockScript {
  return async (input): Promise<MockReply> => {
    if (stepLatencyMs > 0) await sleep(stepLatencyMs)
    const outputs = toolOutputs(input)
    if (outputs.length === 0) return { toolCall: { name: "area_data", args: {} } }
    const out = outputs.join("\n")
    const line = (metric: string) => new RegExp(`^${metric} = (\\d+) (.+)$`, "m").exec(out)
    const parts = ["transit", "offices", "schools", "parking", "food", "shops"].map(line).filter((m): m is RegExpExecArray => Boolean(m))
    if (parts.length === 0) return { text: JSON.stringify({ explanation: "The location could not be checked: the address was not found in OpenStreetMap." }) }
    const listed = parts.slice(0, 4).map((m) => `${m[1]} ${m[2]}`).join(", ")
    return { text: JSON.stringify({ explanation: `OpenStreetMap maps ${listed} near this address. It does not show foot traffic or revenue, so check the street at the hours you would open.` }) }
  }
}

/** Scripted cues for the Premises inspector: a phrase in the text, the field it states, and the value it states. */
const PREMISES_CUES: readonly { field: string; value: unknown; pattern: RegExp }[] = [
  { field: "floor", value: "ground", pattern: /\bground floor\b|\bprizemlj\w*/i },
  { field: "floor", value: "basement", pattern: /\b(?:second )?basement\b|\bu suterenu\b/i },
  { field: "floor", value: "upper", pattern: /\bfloor [1-9]\d*\b|\bna (?:prvom|drugom|trećem|spratu)\b/i },
  { field: "storefront", value: true, pattern: /\bizlog\w*(?: (?:prema|ka) ulici)?|\bdva izloga\b|\bstorefront\b|\bshop window\b/i },
  { field: "parking", value: true, pattern: /\bparking\w*(?: [a-zčćšžđ]+){0,3}/i },
  { field: "heating", value: null, pattern: /\bgrejanje:? [^.,;\n]+|\bheating:? [^.,;\n]+/i },
  { field: "kitchenVentilation", value: true, pattern: /\bventilacij\w*(?: za kuhinju)?|\bkitchen ventilation\b/i },
  { field: "waterAndDrain", value: true, pattern: /\bpriključak za vodu i odvod\b|\bwater and (?:a )?drain\b/i },
  { field: "needsRenovation", value: false, pattern: /\brenoviran\w*(?: pre [a-z]+ godin[ae])?|\bbez renoviranja\b/i },
  { field: "needsRenovation", value: true, pattern: /\bpotrebno renoviranje\b|\bzahteva renoviranje\b|\bneeds renovation\b/i },
  { field: "stepFreeAccess", value: true, pattern: /\bbez stepenika\b|\bstep-free\b/i },
]

/**
 * Demo-mode "model" for the Premises inspector: finds a few fixed phrases in the text and copies each one as the quote
 * (so code can check it). A feature without a phrase is not found. It does not judge anything: code does.
 */
export function premisesDemoScript(stepLatencyMs = 0): MockScript {
  return async (input): Promise<MockReply> => {
    if (stepLatencyMs > 0) await sleep(stepLatencyMs)
    const text = /"""\n([\s\S]*)\n"""/.exec(lastUserText(input))?.[1] ?? ""
    const answer: Record<string, unknown> = {}
    for (const field of ["floor", "storefront", "parking", "heating", "kitchenVentilation", "waterAndDrain", "needsRenovation", "stepFreeAccess"]) answer[field] = { found: false }
    for (const cue of PREMISES_CUES) {
      if ((answer[cue.field] as { found: boolean }).found) continue
      const m = cue.pattern.exec(text)
      if (!m) continue
      // "Bez parkinga", "bez izloga": the phrase is negated, so the quote includes the negation and the value flips.
      const negation = typeof cue.value === "boolean" ? /\b(bez|nema|no|without) $/i.exec(text.slice(Math.max(0, m.index - 8), m.index)) : null
      const quote = negation ? `${negation[0]}${m[0]}` : m[0]
      const value = cue.field === "heating" ? m[0].replace(/^\w+:?\s*/, "") : negation ? !cue.value : cue.value
      answer[cue.field] = { found: true, value, quote }
    }
    return { text: JSON.stringify(answer) }
  }
}

/**
 * Demo-mode "model" for the Report writer: builds the report only from the FACTS in its message (rank facts for the
 * top 3, then checks, rejections and unknowns), copying the fact texts, so it passes the Auditor. It computes nothing.
 */
export function reportWriterDemoScript(latencyMs = 0): MockScript {
  return async (input): Promise<MockReply> => {
    if (latencyMs > 0) await sleep(latencyMs)
    const facts = [...lastUserText(input).matchAll(/^(F\d+) \[(\w+)\] ([a-z0-9][a-z0-9-]*[a-z0-9])\b(.*)$/gm)].map((m) => ({ id: m[1]!, kind: m[2]!, candidateId: m[3]!, text: `${m[3]}${m[4]}` }))
    const ranks = facts.filter((f) => f.kind === "rank").slice(0, 3)
    const reasonOf = (id: string) => facts.find((f) => f.kind === "reason" && f.candidateId === id)
    const sentence = (fs: { id: string; text: string }[]) => ({ text: fs.map((f) => f.text).join(" "), facts: fs.map((f) => f.id) })
    return {
      text: JSON.stringify({
        recommended: ranks.map((f) => f.candidateId),
        recommendation: ranks.map((r) => sentence([r, ...(reasonOf(r.candidateId) ? [reasonOf(r.candidateId)!] : [])])),
        checkBeforeSigning: facts.filter((f) => f.kind === "check").slice(0, 4).map((f) => sentence([f])),
        rejected: facts.filter((f) => f.kind === "rejected").map((f) => sentence([f])),
        unknowns: facts.filter((f) => f.kind === "unknown").slice(0, 4).map((f) => sentence([f])),
      }),
    }
  }
}

/** One MockScript for the whole demo room: routes each request to the scripted agent by its instruction. */
export function demoRoomScript(answers: { scout: Record<string, unknown>; lease: Record<string, unknown> }, latency: DemoLatency = {}): MockScript {
  const scout = scoutDemoScript(answers.scout, { latencyMs: latency.scout })
  const lease = leaseReaderDemoScript(answers.lease, latency.leaseReader)
  const finance = financeDemoScript(latency.financeStep)
  const location = locationDemoScript(latency.locationStep ?? latency.financeStep)
  const premises = premisesDemoScript(latency.premisesStep ?? latency.financeStep)
  const report = reportWriterDemoScript(latency.reportWriter)
  return (input: InferenceInput) => {
    const role = developerText(input)
    if (role.startsWith("You are the Scout")) return scout(input)
    if (role.startsWith("You are the Lease reader")) return lease(input)
    if (role.startsWith("You are the Finance analyst")) return finance(input)
    if (role.startsWith("You are the Location analyst")) return location(input)
    if (role.startsWith("You are the Premises inspector")) return premises(input)
    if (role.startsWith("You are the Report writer")) return report(input)
    return { text: "mock answer" }
  }
}
