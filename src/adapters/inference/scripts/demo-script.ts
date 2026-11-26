import type { InferenceInput } from "@mozaik-ai/core"
import { developerText, lastUserText, toolOutputs, type MockReply, type MockScript } from "../mock-runner.js"
import { scoutDemoScript } from "./scout-script.js"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type DemoLatency = { scout?: (listingId: string) => number; leaseReader?: number; financeStep?: number }

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
    const explanation = [
      `The space costs ${value("monthly_cost")} per month and ${value("total_cost_over_term")} in total.`,
      `Leaving after 12 months would cost ${value("exit_cost_after_12_months")}.`,
      `That is ${value("cost_share_of_revenue")} of the expected revenue. Break-even revenue: ${value("break_even_revenue")}.`,
    ].join(" ")
    return { text: JSON.stringify({ explanation }) }
  }
}

/** One MockScript for the whole demo room: routes each request to the scripted agent by its instruction. */
export function demoRoomScript(answers: { scout: Record<string, unknown>; lease: Record<string, unknown> }, latency: DemoLatency = {}): MockScript {
  const scout = scoutDemoScript(answers.scout, { latencyMs: latency.scout })
  const lease = leaseReaderDemoScript(answers.lease, latency.leaseReader)
  const finance = financeDemoScript(latency.financeStep)
  return (input: InferenceInput) => {
    const role = developerText(input)
    if (role.startsWith("You are the Scout")) return scout(input)
    if (role.startsWith("You are the Lease reader")) return lease(input)
    if (role.startsWith("You are the Finance analyst")) return finance(input)
    return { text: "mock answer" }
  }
}
