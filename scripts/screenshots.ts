/**
 * Screenshots of SuiteSpot (Edge or Chrome via playwright-core, no browser download).
 *
 * PowerShell:
 *   npm run screenshots
 *     Demo mode (keyless) against the dev servers (npm run dev): Table and Timeline mid-run and at the end, Cards,
 *     Reports, Assumptions, New research. Writes design/screenshots/*.png.
 *   npm run screenshots -- --live --url http://localhost:3001
 *     One LIVE run of the whole demo (claude-haiku-4-5, costs money) against a server started with
 *     SUITESPOT_MODE=live (see PROGRESS.md "How to run"). Writes design/screenshots/live-*.png and report-live.md.
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
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log(`${out}/${name}.png`)
}
const tab = async (name: "Table" | "Timeline" | "Cards") => page.getByRole("tab", { name }).click()

let researchId = ""
page.on("response", async (res) => {
  if (res.url().endsWith("/api/research") && res.request().method() === "POST") researchId = ((await res.json()) as { id?: string }).id ?? ""
})
await page.goto(`${base}/?autorun=${live ? "live" : "demo"}`)
await page.getByRole("tab", { name: "Table" }).waitFor()

if (!live) {
  // Mid-run: the lease has rejected demo-07 while other loops still run (the key moment).
  await tab("Timeline")
  await page.getByText("Hard flag: demo-07 rejected").first().waitFor({ timeout: 30_000 })
  await save("live-timeline-mid")
  await tab("Table")
  await save("live-table-mid")
}

// End: the metrics strip appears with research.done.
await page.getByText(/done in \d/).waitFor({ timeout: live ? 300_000 : 60_000 })
const prefix = live ? "live-run-" : "live-"
await tab("Table")
await save(`${prefix}table-end`)
await tab("Timeline")
await save(`${prefix}timeline-end`)
if (!live) {
  await tab("Cards")
  await save("live-cards-end")
}
await page.getByRole("button", { name: "Reports" }).click()
await page.getByText(/Audited: \d+ claims checked/).waitFor({ timeout: 30_000 })
await save(live ? "live-run-report" : "reports")

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
  await page.getByRole("button", { name: "Assumptions" }).click()
  await page.getByText("How the Ranker scores").waitFor()
  await save("assumptions")
  await page.goto(base)
  await page.getByRole("button", { name: "Run demo" }).waitFor()
  await save("new-research")
}
await browser.close()
