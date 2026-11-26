import type { InferenceInput } from "@mozaik-ai/core"
import { lastUserText, type MockReply, type MockScript } from "../mock-runner.js"

export function listingIdOf(input: InferenceInput): string | null {
  return /Listing id: (\S+)/.exec(lastUserText(input))?.[1] ?? null
}

export type ScoutScriptOptions = {
  /** Per-listing simulated model latency, so the demo shows loops finishing at different times. */
  latencyMs?: (listingId: string) => number
}

/**
 * Demo-mode "model" for the Scout: replays the scripted structured answer for the listing id in the message.
 * It does not read the text; plain code (buildListing) still checks every quote in the answer against the text.
 */
export function scoutDemoScript(answers: Record<string, unknown>, options: ScoutScriptOptions = {}): MockScript {
  return async (input): Promise<MockReply> => {
    const id = listingIdOf(input)
    const latency = id && options.latencyMs ? options.latencyMs(id) : 0
    if (latency > 0) await new Promise((r) => setTimeout(r, latency))
    if (!id || !(id in answers)) return { text: `No scripted answer for listing "${id ?? "?"}"` }
    return { text: JSON.stringify(answers[id]) }
  }
}
