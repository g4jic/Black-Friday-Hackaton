import { describe, expect, it } from "vitest"
import { DEMO_SCENARIOS, loadRecording, type DemoScenarioId } from "../src/adapters/fixtures/demo-scenarios.js"
import { buildServer } from "../src/adapters/server/server.js"

type Wire = { type: string; data?: Record<string, unknown> }
const events = (body: string): Wire[] =>
  body
    .split("\n\n")
    .map((part) => part.split("\n").find((l) => l.startsWith("data:")))
    .filter((l): l is string => Boolean(l))
    .map((l) => JSON.parse(l.slice(5)) as Wire)

describe("recorded demo scenarios (keyless replay of real model runs)", () => {
  for (const scenario of Object.keys(DEMO_SCENARIOS) as DemoScenarioId[]) {
    it(`${scenario}: replays to an audited report, labelled "recorded", with no request missing from the recording`, async () => {
      delete process.env.ANTHROPIC_API_KEY
      expect(loadRecording(scenario)).not.toBeNull()
      const app = await buildServer({ replaySpeed: 0 })
      const post = await app.inject({ method: "POST", url: "/api/research", payload: { source: "demo", scenario } })
      expect(post.statusCode).toBe(201)
      const { id, answers, mode } = post.json() as { id: string; answers: string; mode: string }
      expect({ answers, mode }).toEqual({ answers: "recorded", mode: "demo" })
      const all = events((await app.inject({ method: "GET", url: `/api/research/${id}/events` })).body)
      expect(all.at(-1)?.type).toBe("research.done")
      const ready = all.find((e) => e.type === "report.ready")?.data as { failed: unknown; audit: { problems?: unknown[] } }
      expect(ready.failed).toBeFalsy()
      expect(ready.audit.problems ?? []).toEqual([])
      expect(JSON.stringify(all)).not.toContain("not in the recording")
      expect(all.filter((e) => e.type === "candidate.scored").length).toBeGreaterThan(0)
      await app.close()
    }, 60_000)
  }

  it("the config lists the three scenarios as recorded", async () => {
    const app = await buildServer()
    const config = (await app.inject({ method: "GET", url: "/api/config" })).json() as { scenarios: { id: string; recorded: boolean }[] }
    expect(config.scenarios).toEqual(Object.keys(DEMO_SCENARIOS).map((id) => ({ id, title: DEMO_SCENARIOS[id as DemoScenarioId].title, recorded: true })))
    await app.close()
  })
})
