import "dotenv/config"
import { installProcessGuards } from "../../application/resilience/process-guards.js"
import { buildServer } from "./server.js"

// Last-resort guards first: one failing agent must never take the server down.
installProcessGuards()

const port = Number(process.env.PORT ?? 3000)
const app = await buildServer()
await app.listen({ port, host: "0.0.0.0" })
