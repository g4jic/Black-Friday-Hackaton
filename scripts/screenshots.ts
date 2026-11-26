/**
 * Screenshots of SuiteSpot (Edge or Chrome via playwright-core, no browser download).
 *
 * PowerShell:
 *   npm run screenshots
 *     Demo mode (keyless) against the dev servers (npm run dev): the run orbit mid-run and at the end, the results
 *     list, a candidate page, the rejected block, Timeline, Report, Assumptions and New research.
 *     Writes design/screenshots/*.png.
 *   npm run screenshots -- --live --url http://localhost:3001
 *     One LIVE run of the whole demo (claude-haiku-4-5, costs money) against a server started with
 *     ANTHROPIC_API_KEY in .env (see PROGRESS.md "How to run"). If the server sets SUITESPOT_ACCESS_CODE, put the same value
 *     in this shell's environment. Writes design/screenshots/live-run-*.png and report-live.md.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { chromium } from "playwright-core"

const args = process.argv.slice(2)
const live = args.includes("--live")
const base = args.includes("--url") ? args[args.indexOf("--url") + 1]! : "http://localhost:5173"
const out = "design/screenshots"
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch({ channel: "chrome" }))
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
const save = async (name: string) => {
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log(`${out}/${name}.png`)
}
const prefix = live ? "live-run-" : ""

// Start the run: the demo through the app's own autorun, a live run of the demo through the API.
let researchId = ""
if (live) {
  await page.goto(base)
  researchId = await page.evaluate(async (accessCode) => {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessCode ? { "X-Access-Code": accessCode } : {}) },
      body: JSON.stringify({ mode: "live", source: "demo" }),
    })
    if (!response.ok) throw new Error(`Live run refused: ${response.status} ${await response.text()}`)
    return ((await response.json()) as { id: string }).id
  }, process.env.SUITESPOT_ACCESS_CODE ?? "")
  await page.goto(`${base}/research/${researchId}/run`)
} else {
  await page.goto(`${base}/?autorun=demo`)
  await page.waitForURL(/\/research\/[^/]+\/run$/)
  researchId = page.url().split("/research/")[1]!.split("/")[0]!
}

// Mid-run: the first hard flag has taken a candidate out of the orbit while other loops still run.
await page.getByText(/^Hard flag: /).first().waitFor({ timeout: live ? 300_000 : 30_000 })
await save(`${prefix}run-mid`)

// The orbit settles and the page moves on to the results by itself.
await page.waitForURL(new RegExp(`/research/${researchId}$`), { timeout: live ? 300_000 : 60_000 })
await page.getByText(/^(Best option|No space is recommended)/).waitFor()
await save(`${prefix}results-list`)

await page.locator("ol a[href*='/candidate/']").first().click()
await page.getByRole("heading", { name: "Costs" }).waitFor()
await save(`${prefix}candidate`)

await page.goto(`${base}/research/${researchId}`)
await page.getByRole("button", { name: /Rejected by a hard flag/ }).click()
await save(`${prefix}results-rejected-open`)

await page.goto(`${base}/research/${researchId}?tab=timeline`)
await page.getByText("Under the hood").waitFor()
await save(`${prefix}timeline`)

await page.goto(`${base}/research/${researchId}?tab=report`)
await page.getByText(/Audited: \d+ claims checked/).waitFor({ timeout: 30_000 })
await save(`${prefix}report`)

if (live) {
  // Save the audited report and the run metrics (from the server, computed from runtime events).
  const report = (await page.evaluate(async (id) => (await fetch(`/api/research/${id}/report`)).json(), researchId)) as any
  const status = (await page.evaluate(async (id) => (await fetch(`/api/research/${id}`)).json(), researchId)) as any
  const m = status.metrics
  const lines = [
    "# Live run: audited report (claude-haiku-4-5, 8 SYNTHETIC demo listings)",
    "",
    `Run on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC. Not financial or legal advice.`,
    "",
    `- Time: ${(m.durationMs / 1000).toFixed(1)} s, ${m.loops} loops, peak ${m.peakParallel} in parallel, ${m.toolCalls} calculator calls`,
    `- Tokens: ${m.tokens.input} in, ${m.tokens.output} out; cost about $${m.costUsd} (at $1 / $5 per million tokens)`,
    `- Rejected: ${m.rejected}; loops cancelled: ${m.loopsCancelled}; rejected extractions: ${m.rejectedExtractions}; agents halted: ${m.agentsHalted}`,
    `- Audit: ${report.audit.checked} claims checked, ${report.audit.corrected} corrected, ${report.audit.removed} removed, ${report.audit.attempts} attempt(s)`,
    `- Recommended: ${report.recommended.join(", ")}`,
    "",
  ]
  const titles: Record<string, string> = { recommendation: "Recommendation", checkBeforeSigning: "Check before signing", rejected: "Why these were rejected", unknowns: "What we do not know" }
  for (const [key, title] of Object.entries(titles)) {
    lines.push(`## ${title}`, "")
    for (const s of report.sections[key] as { text: string; status: string; note?: string; facts: { id: string; source: { kind: string; ref: string } }[] }[]) {
      const src = s.facts.map((f) => `${f.id}: ${f.source.kind}`).join(", ")
      lines.push(s.status === "removed" ? `- ~~${s.text}~~ (${s.note})` : `- ${s.text} [${src}]`)
    }
    lines.push("")
  }
  writeFileSync(`${out}/report-live.md`, lines.join("\n"))
  console.log(`${out}/report-live.md`)
} else {
  await page.goto(`${base}/assumptions`)
  await page.getByText("How the Ranker scores").waitFor()
  await save("assumptions")
  await page.goto(`${base}/research/new?mode=find`)
  await page.getByText("Demo profile").waitFor()
  await save("new-research")
}
await browser.close()
