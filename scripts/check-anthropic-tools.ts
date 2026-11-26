/**
 * One-off capability check (plan step 1): does our key + claude-haiku-4-5 support Anthropic's server-side
 * web search and web fetch? Prints results and cost only. Never prints the key.
 * Run (PowerShell): npm run check:anthropic
 * Cost: one web search ($0.01) plus a few thousand Haiku tokens, well under $0.05.
 */
import "dotenv/config"
import Anthropic from "@anthropic-ai/sdk"

const MODEL = process.env.CHECK_MODEL ?? "claude-haiku-4-5"
// claude-haiku-4-5 predates the _20260209 variants, so it takes the basic tool versions.
const WEB_SEARCH = { type: "web_search_20250305", name: "web_search", max_uses: 1 } as const
// Note: user_location with country RS is rejected ("Country code RS is not supported", tested 26 Nov 2026), so the city goes in the query.
const WEB_FETCH = { type: "web_fetch_20250910", name: "web_fetch", max_uses: 1, max_content_tokens: 4000 } as const

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set in .env")
  process.exit(1)
}
const client = new Anthropic({ maxRetries: 1 })
let inputTokens = 0
let outputTokens = 0
let searches = 0

type Block = { type: string; [k: string]: any }

function track(usage: any): void {
  inputTokens += usage?.input_tokens ?? 0
  outputTokens += usage?.output_tokens ?? 0
  searches += usage?.server_tool_use?.web_search_requests ?? 0
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.APIError) return `HTTP ${error.status}: ${error.message}`
  return String(error)
}

async function checkModel(): Promise<void> {
  console.log(`\n1) Models API: ${MODEL}`)
  try {
    const m = (await client.models.retrieve(MODEL)) as unknown as Record<string, any>
    console.log(`   id=${m.id} display_name=${m.display_name} max_input_tokens=${m.max_input_tokens ?? "?"}`)
    const caps = m.capabilities
    if (!caps) console.log("   (no capabilities field returned)")
    else console.log(`   capabilities: ${JSON.stringify(caps)}`)
  } catch (error) {
    console.log(`   FAILED: ${describeError(error)}`)
  }
}

async function checkSearch(): Promise<string | null> {
  console.log("\n2) Web search (web_search_20250305, max_uses 1)")
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      tools: [WEB_SEARCH as any],
      messages: [{ role: "user", content: "Search the web once for: poslovni prostor izdavanje Novi Sad. Then reply with only the single best listing URL from the results." }],
    })
    track(res.usage)
    const blocks = res.content as unknown as Block[]
    const results = blocks.filter((b) => b.type === "web_search_tool_result")
    console.log(`   stop_reason=${res.stop_reason} search_result_blocks=${results.length}`)
    const first = results[0]
    if (!first) {
      console.log("   NOT SUPPORTED or not used: no web_search_tool_result block")
      return null
    }
    if (!Array.isArray(first.content)) {
      console.log(`   SEARCH ERROR: ${JSON.stringify(first.content)}`)
      return null
    }
    console.log(`   SUPPORTED: ${first.content.length} results`)
    for (const r of first.content.slice(0, 3)) console.log(`     - ${r.title} | ${r.url} | page_age=${r.page_age ?? "?"}`)
    return (first.content[0]?.url as string | undefined) ?? null
  } catch (error) {
    console.log(`   FAILED: ${describeError(error)}`)
    return null
  }
}

async function checkFetch(url: string): Promise<void> {
  console.log(`\n3) Web fetch (web_fetch_20250910, max_uses 1) on ${url}`)
  const params = {
    model: MODEL,
    max_tokens: 512,
    tools: [WEB_FETCH as any],
    messages: [{ role: "user" as const, content: `Fetch this page once with the web_fetch tool: ${url}\nThen reply with the monthly rent and area if the page states them, otherwise say "not stated".` }],
  }
  try {
    // Web fetch shipped behind a beta header; sending it is harmless if the tool is GA for this key.
    const res = await client.beta.messages.create({ ...params, betas: ["web-fetch-2025-09-10"] } as any)
    track(res.usage)
    const blocks = res.content as unknown as Block[]
    const fetched = blocks.find((b) => b.type === "web_fetch_tool_result")
    console.log(`   stop_reason=${res.stop_reason}`)
    if (!fetched) {
      console.log("   NOT SUPPORTED or not used: no web_fetch_tool_result block")
      return
    }
    const content = fetched.content as Block
    if (content.type !== "web_fetch_result") {
      console.log(`   FETCH ERROR: ${JSON.stringify(content)}`)
      return
    }
    const doc = content.content as Block | undefined
    const text = typeof doc?.source?.data === "string" ? doc.source.data : ""
    console.log(`   SUPPORTED: retrieved_at=${content.retrieved_at ?? "?"} title=${doc?.title ?? "?"} chars=${text.length}`)
    const answer = blocks.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim()
    console.log(`   model answer: ${answer.slice(0, 200)}`)
  } catch (error) {
    console.log(`   FAILED: ${describeError(error)}`)
  }
}

await checkModel()
const url = await checkSearch()
await checkFetch(url ?? "https://www.openstreetmap.org/about")

// claude-haiku-4-5: $1 / $5 per million tokens; web search $10 per 1,000 searches; web fetch has no extra fee.
const cost = (inputTokens / 1e6) * 1 + (outputTokens / 1e6) * 5 + searches * 0.01
console.log(`\nUsage: input=${inputTokens} output=${outputTokens} searches=${searches} -> about $${cost.toFixed(4)}`)
