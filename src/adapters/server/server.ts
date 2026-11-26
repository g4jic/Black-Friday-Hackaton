import Fastify, { type FastifyInstance } from "fastify"
import fastifyStatic from "@fastify/static"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const webDist = fileURLToPath(new URL("../../../web/dist", import.meta.url))

/** Demo mode is the default (keyless, deterministic). Live mode needs SUITESPOT_MODE=live and a key. */
export function runMode(): "demo" | "live" {
  return process.env.SUITESPOT_MODE === "live" && Boolean(process.env.ANTHROPIC_API_KEY) ? "live" : "demo"
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } })

  app.get("/api/health", async () => ({ status: "ok", mode: runMode() }))

  // In production the built web app is served by this same process (one Railway service).
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist })
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" })
      return reply.sendFile("index.html")
    })
  }
  return app
}
