/**
 * Screenshots of the Live research screen in demo mode (keyless): Table and Timeline, mid-run and at the end.
 * Needs the dev servers running (npm run dev) and Microsoft Edge or Chrome installed (no browser download).
 *
 * PowerShell:  npm run screenshots            (writes design/screenshots/*.png)
 *              npm run screenshots -- --url http://localhost:5173
 */
import { mkdirSync } from "node:fs"
import { chromium } from "playwright-core"

const args = process.argv.slice(2)
const base = args[args.indexOf("--url") + 1] && args.includes("--url") ? args[args.indexOf("--url") + 1]! : "http://localhost:5173"
const out = "design/screenshots"
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch({ channel: "chrome" }))
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
await page.goto(`${base}/?autorun=demo`)
await page.getByRole("tab", { name: "Table" }).waitFor()

const shot = async (name: string, tab: "Table" | "Timeline") => {
  await page.getByRole("tab", { name: tab }).click()
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log(`${out}/${name}.png`)
}

// Mid-run: wait until the lease has rejected demo-07 while other loops still run (the key moment), then capture.
await page.getByRole("tab", { name: "Timeline" }).click()
await page.getByText("demo-07 rejected").first().waitFor({ timeout: 30_000 })
await page.waitForTimeout(250)
await shot("live-timeline-mid", "Timeline")
await shot("live-table-mid", "Table")

// End: the metrics strip appears with research.done.
await page.getByText(/done in \d/).waitFor({ timeout: 60_000 })
await shot("live-table-end", "Table")
await shot("live-timeline-end", "Timeline")
await page.getByRole("tab", { name: "Cards" }).click()
await page.waitForTimeout(150)
await page.screenshot({ path: `${out}/live-cards-end.png`, fullPage: true })
console.log(`${out}/live-cards-end.png`)

await page.getByRole("button", { name: "Assumptions" }).click()
await page.getByText("How the Ranker scores").waitFor()
await page.screenshot({ path: `${out}/assumptions.png`, fullPage: true })
console.log(`${out}/assumptions.png`)

await page.goto(base)
await page.getByRole("button", { name: "Run demo" }).waitFor()
await page.screenshot({ path: `${out}/new-research.png`, fullPage: true })
console.log(`${out}/new-research.png`)
await browser.close()
