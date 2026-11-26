let installed = false

/**
 * Last line of defence. Anything that still escapes (for example a rejected loop promise inside Mozaik)
 * is logged and the process keeps serving the other agents and the web UI.
 */
export function installProcessGuards(log: (message: string, error: unknown) => void = console.error): void {
  if (installed) return
  installed = true
  process.on("unhandledRejection", (reason) => log("[process-guard] unhandled rejection:", reason))
  process.on("uncaughtException", (error) => log("[process-guard] uncaught exception:", error))
}
