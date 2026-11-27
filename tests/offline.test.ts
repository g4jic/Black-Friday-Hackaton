import { afterEach, describe, expect, it, vi } from "vitest"
import { buildServer } from "../src/adapters/server/server.js"

describe("tests run offline (tests/setup.ts)", () => {
  afterEach(() => vi.restoreAllMocks())

  it("blocks every request that would leave this machine", async () => {
    await expect(fetch("https://api.app.jigjoy.ai/v1/health")).rejects.toThrow("Tests run offline: blocked a request to api.app.jigjoy.ai")
    await expect(fetch("https://api.anthropic.com/v1/messages")).rejects.toThrow("blocked a request to api.anthropic.com")
  })

  it("a full recorded run sends nothing to Mozaik Cloud, even on a paired machine", async () => {
    const lines: string[] = []
    const keep = (...args: unknown[]) => void lines.push(args.map(String).join(" "))
    vi.spyOn(console, "log").mockImplementation(keep)
    vi.spyOn(console, "warn").mockImplementation(keep)
    delete process.env.ANTHROPIC_API_KEY
    const app = await buildServer({ replaySpeed: 0 })
    const post = await app.inject({ method: "POST", url: "/api/research", payload: { source: "demo", scenario: "cafe-novi-sad" } })
    const { id } = post.json() as { id: string }
    const body = (await app.inject({ method: "GET", url: `/api/research/${id}/events` })).body
    await app.close()
    expect(body).toContain("research.done")
    // An enabled cloud client prints "mozaik cloud - watching live: <url>" for every loop; a disabled one says so.
    expect(lines.some((l) => l.includes("watching live"))).toBe(false)
    expect(lines.some((l) => l.includes("telemetry disabled"))).toBe(true)
  }, 60_000)
})
