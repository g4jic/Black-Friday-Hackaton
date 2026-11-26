/**
 * Every call to our own API ("/api/...") goes through the browser's fetch. When the SuiteSpot server is not running
 * (or the dev proxy cannot reach it), the browser only says "Failed to fetch" and the proxy answers with an HTML or
 * empty error page. Both become one plain JSON answer here, so every screen shows a human message instead.
 */
export const SERVER_DOWN_MESSAGE = "The SuiteSpot server is not answering. Check that it is running (npm run dev) and try again."

const isApi = (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  return url.startsWith("/api/") || new URL(url, window.location.href).pathname.startsWith("/api/")
}

const serverDown = () => new Response(JSON.stringify({ error: SERVER_DOWN_MESSAGE }), { status: 503, headers: { "Content-Type": "application/json" } })

/** Installs the wrapper once, at start-up. */
export function installApiFetch(): void {
  const original = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    if (!isApi(input)) return original(input, init)
    let response: Response
    try {
      response = await original(input, init)
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error
      return serverDown()
    }
    // The dev proxy answers 502/503/504 (or a bare 500) without our JSON body when the server is down.
    const json = (response.headers.get("content-type") ?? "").includes("application/json")
    if (!response.ok && !json && response.status >= 500) return serverDown()
    return response
  }
}

/** A thrown value as a sentence for the screen (never "TypeError: ..."). */
export function humanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch|networkerror|load failed/i.test(message) ? SERVER_DOWN_MESSAGE : message
}
