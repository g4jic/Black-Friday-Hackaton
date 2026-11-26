/**
 * Feasibility check for the Scout: can we read SINGLE listing pages (not index pages)?
 * For every URL it tries (a) Anthropic web_fetch through claude-haiku-4-5 and (b) a plain HTTP GET fallback, and
 * reports whether the page we got is really that listing (not a homepage, not a block page) and states rent and area.
 *
 * Run (PowerShell): npm run check:listings -- <url> <url> ...
 *   or:             npm run check:listings -- --search "site:nekretnine.rs izdavanje poslovni prostor Novi Sad" 3
 * Cost: about $0.01 per web_fetch (Haiku tokens) + $0.01 per search. Never prints the key.
 * Personal data: prints no phone numbers, emails or names; only URL, title, status and whether rent/area were found.
 */
import "dotenv/config"
import Anthropic from "@anthropic-ai/sdk"

const MODEL = "claude-haiku-4-5"
// Honest identity, never a browser or search engine (CLAUDE.md, "Listing sources").
const UA = "SuiteSpot/0.1 (hackathon; +https://github.com/g4jic/Black-Friday-Hackaton)"
const client = new Anthropic({ maxRetries: 1 })
let inputTokens = 0
let outputTokens = 0
let searches = 0

type Block = { type: string; [k: string]: any }
type Check = { ok: boolean; note: string }

const PRICE = /(\d[\d.\s]{1,8})\s?(€|eur|EUR|e\/mes)/
const AREA = /(\d{1,4}(?:[.,]\d+)?)\s?(m2|m²|kvadrat)/i

function track(usage: any): void {
  inputTokens += usage?.input_tokens ?? 0
  outputTokens += usage?.output_tokens ?? 0
  searches += usage?.server_tool_use?.web_search_requests ?? 0
}

/** A page is "the listing" if it is not a homepage/block page and states a price and an area. */
function judge(requested: string, finalUrl: string, title: string, text: string): Check {
  const reqPath = new URL(requested).pathname.replace(/\/$/, "")
  const gotPath = new URL(finalUrl).pathname.replace(/\/$/, "")
  if (gotPath === "" || (gotPath !== reqPath && !gotPath.startsWith(reqPath.slice(0, 20)))) return { ok: false, note: `redirected to ${finalUrl}` }
  if (/just a moment|attention required|access denied|captcha|403 forbidden/i.test(title + text.slice(0, 2000))) return { ok: false, note: "block page" }
  const price = PRICE.test(text)
  const area = AREA.test(text)
  if (!price || !area) return { ok: false, note: `page read but ${!price ? "no price" : ""}${!price && !area ? " and " : ""}${!area ? "no area" : ""} found` }
  return { ok: true, note: "listing with price and area" }
}

async function viaWebFetch(url: string): Promise<Check> {
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 300,
      betas: ["web-fetch-2025-09-10"],
      tools: [{ type: "web_fetch_20250910", name: "web_fetch", max_uses: 1, max_content_tokens: 6000 } as any],
      messages: [{ role: "user", content: `Fetch this page once with web_fetch: ${url}\nThen reply in one line: rent=<value or none>; area=<value or none>.` }],
    } as any)
    track(res.usage)
    const blocks = res.content as unknown as Block[]
    const r = blocks.find((b) => b.type === "web_fetch_tool_result")
    if (!r) return { ok: false, note: "model did not call web_fetch" }
    if (r.content?.type !== "web_fetch_result") return { ok: false, note: `fetch error ${JSON.stringify(r.content).slice(0, 120)}` }
    const doc = r.content.content
    const text: string = typeof doc?.source?.data === "string" ? doc.source.data : ""
    const verdict = judge(url, r.content.url ?? url, doc?.title ?? "", text)
    return { ...verdict, note: `${verdict.note} | title="${String(doc?.title ?? "").slice(0, 60)}" chars=${text.length}` }
  } catch (error) {
    return { ok: false, note: error instanceof Anthropic.APIError ? `HTTP ${error.status}: ${error.message.slice(0, 120)}` : String(error) }
  }
}

async function viaPlainGet(url: string): Promise<Check> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "sr,en;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(15000) })
    const html = await res.text()
    if (!res.ok) return { ok: false, note: `HTTP ${res.status}` }
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? ""
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ")
    const verdict = judge(url, res.url, title, text)
    return { ...verdict, note: `${verdict.note} | HTTP ${res.status} title="${title.slice(0, 60)}"` }
  } catch (error) {
    return { ok: false, note: String(error).slice(0, 120) }
  }
}

async function searchListingUrls(query: string, count: number): Promise<string[]> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 } as any],
    messages: [{ role: "user", content: `Search the web once for: ${query}. Reply "done".` }],
  })
  track(res.usage)
  const result = (res.content as unknown as Block[]).find((b) => b.type === "web_search_tool_result")
  const urls: string[] = Array.isArray(result?.content) ? result.content.map((r: Block) => r.url as string) : []
  // Single listings have an id segment; index pages contain /lista/ or end in a city name.
  const single = urls.filter((u) => !/\/lista\/|\/grad\/[^/]+\/?$/.test(u) && /\/[A-Za-z0-9]{6,}\/?$/.test(u))
  console.log(`search: ${urls.length} results, ${single.length} look like single listings`)
  for (const u of urls) console.log(`  result: ${u}`)
  return single.slice(0, count)
}

const args = process.argv.slice(2)
let urls = args
if (args[0] === "--search") urls = await searchListingUrls(args[1] ?? "", Number(args[2] ?? 3))
if (args[0] === "--search-only") {
  await searchListingUrls(args[1] ?? "", 0)
  urls = []
}

let fetchOk = 0
let getOk = 0
for (const url of urls) {
  const a = await viaWebFetch(url)
  await new Promise((r) => setTimeout(r, 2000)) // be gentle with the site
  const b = await viaPlainGet(url)
  if (a.ok) fetchOk++
  if (b.ok) getOk++
  console.log(`\n${url}\n  web_fetch: ${a.ok ? "PASS" : "FAIL"} - ${a.note}\n  plain GET: ${b.ok ? "PASS" : "FAIL"} - ${b.note}`)
  await new Promise((r) => setTimeout(r, 2000))
}
const cost = (inputTokens / 1e6) * 1 + (outputTokens / 1e6) * 5 + searches * 0.01
console.log(`\nweb_fetch ${fetchOk}/${urls.length} | plain GET ${getOk}/${urls.length} | cost about $${cost.toFixed(4)}`)
