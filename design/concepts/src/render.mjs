// Renders the concept mockups to PNG with a locally installed Chrome (headless). Node only, no extra packages.
// Run: node design/concepts/src/render.mjs
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync)
if (!chrome) throw new Error("No Chrome or Edge found")

const screens = [["1", "1-live-research", 1100], ["2", "2-report", 1240], ["3", "3-questionnaire", 960], ["4", "4-history", 900]]
for (const theme of ["era", "spade"]) {
  const out = resolve(here, "..", theme)
  mkdirSync(out, { recursive: true })
  for (const [n, name, height] of screens) {
    const url = `${pathToFileURL(join(here, "mock.html")).href}?theme=${theme}&screen=${n}`
    const file = join(out, `${name}.png`)
    execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
      `--window-size=1440,${height}`, "--virtual-time-budget=8000", `--screenshot=${file}`, url], { stdio: "ignore" })
    console.log(file)
  }
}
