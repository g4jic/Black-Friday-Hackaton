/**
 * Replays the three recorded demo scenarios (no key, the app's own replay speed) and prints, for the video table:
 * every hard flag cut (who raised it, which rule), how long the Finance analyst worked on that candidate before the
 * cut, where it stopped, and the audit counts of the report. Usage: `npx tsx scripts/cut-report.ts`.
 */
import { buildServer } from "../src/adapters/server/server.js"

process.env.ANTHROPIC_API_KEY = ""
type Ev = { seq: number; at: number; type: string; agent?: string; candidateId?: string; loopKey?: string; where?: string; rule?: string; raisedBy?: string; data?: Record<string, unknown>; audit?: Record<string, unknown> }

for (const scenario of ["cafe-novi-sad", "office-beograd", "shop-novi-sad"]) {
  const app = await buildServer()
  const started = await app.inject({ method: "POST", url: "/api/research", payload: { source: "demo", scenario } })
  const { id } = started.json() as { id: string }
  for (;;) {
    const s = (await app.inject({ method: "GET", url: `/api/research/${id}` })).json() as { status: string }
    if (s.status === "done") break
    await new Promise((r) => setTimeout(r, 250))
  }
  const raw = (await app.inject({ method: "GET", url: `/api/research/${id}/events` })).body
  const events = raw
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)) as Ev)
  const report = (await app.inject({ method: "GET", url: `/api/research/${id}/report` })).json() as { audit?: Record<string, number> }
  console.log(`\n## ${scenario}: audit ${JSON.stringify(report.audit)}`)
  for (const cut of events.filter((e) => e.type === "loop.cancelled" && e.agent === "Finance analyst")) {
    const start = events.find((e) => e.type === "loop.started" && e.loopKey === cut.loopKey)
    const tools = events.filter((e) => e.type === "tool.started" && e.loopKey === cut.loopKey && e.at <= cut.at).length
    console.log(`${cut.candidateId}: raised by ${cut.raisedBy ?? cut.data?.raisedBy}, ${cut.rule ?? cut.data?.rule}; Finance ran ${start ? cut.at - start.at : "?"} ms (from ${start?.at} to ${cut.at}), ${tools} tool calls, stopped ${cut.where ?? cut.data?.where}`)
  }
  await app.close()
}
