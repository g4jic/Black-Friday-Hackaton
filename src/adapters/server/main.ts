import "dotenv/config"
import { installProcessGuards } from "../../application/resilience/process-guards.js"
import { buildServer } from "./server.js"

// Last-resort guards first: one failing agent must never take the server down.
installProcessGuards()

// `--port N` (the dev script) wins over PORT, so a dev tool that sets PORT for the web app cannot move the API.
const portArg = process.argv.indexOf("--port")
const port = Number(portArg > 0 ? process.argv[portArg + 1] : (process.env.PORT ?? 3000))
const app = await buildServer()
await app.listen({ port, host: "0.0.0.0" })
