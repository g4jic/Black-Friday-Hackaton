import { describe, expect, it } from "vitest"
import { buildServer } from "../src/adapters/server/server.js"

describe("server skeleton", () => {
  it("answers the health check in demo mode by default", async () => {
    delete process.env.SUITESPOT_MODE
    const app = await buildServer()
    const res = await app.inject({ method: "GET", url: "/api/health" })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: "ok", mode: "demo" })
    await app.close()
  })
})
