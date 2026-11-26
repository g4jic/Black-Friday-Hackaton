import Fastify, { type FastifyInstance } from "fastify"
import fastifyStatic from "@fastify/static"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { InferenceRunner } from "@mozaik-ai/core"
import type { DemoLatency } from "../inference/scripts/demo-script.js"
import { registerResearchRoutes } from "./research-routes.js"

const webDist = fileURLToPath(new URL("../../../web/dist", import.meta.url))

/** Demo mode is the default (keyless, deterministic). Live mode needs SUITESPOT_MODE=live and a key. */
export function runMode(): "demo" | "live" {
  return process.env.SUITESPOT_MODE === "live" && Boolean(process.env.ANTHROPIC_API_KEY) ? "live" : "demo"
}

export type ServerOptions = { readonly demoPace?: DemoLatency; readonly liveRunner?: () => InferenceRunner }

export async function buildServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } })

  app.get("/api/health", async () => ({ status: "ok", mode: runMode() }))
  // The API key stays in this process: no route returns it, and every outgoing event is scrubbed of it.
  registerResearchRoutes(app, { liveAvailable: () => runMode() === "live", demoPace: options.demoPace, liveRunner: options.liveRunner })

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
