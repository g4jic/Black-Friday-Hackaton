/**
 * Runs before every test file (vitest.config.ts, setupFiles). Tests never leave this machine:
 *
 * 1. Mozaik Cloud is off. The core creates a cloud client for every loop and takes its key from process.env, then
 *    from the .env file in the working directory, then from ~/.mozaik/credentials.json (the pairing). An EMPTY value
 *    in process.env stops that search (the SDK uses `??`), so no test session reaches Cloud on a paired machine.
 * 2. Any fetch to a host other than this machine fails at once. Fastify's inject does not use the network, so a
 *    test that tries to reach a real service (Anthropic, Supabase, Mozaik Cloud) fails loudly instead of silently
 *    depending on the network or spending money.
 */
process.env.MOZAIK_API_KEY = ""
process.env.MOZAIK_PROJECT_KEY = ""

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"])
const realFetch = globalThis.fetch

globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error(`Tests run offline: blocked a request to ${url.hostname}`)
  return realFetch(input, init)
}) as typeof fetch
