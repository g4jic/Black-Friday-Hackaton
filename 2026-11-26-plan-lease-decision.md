# SuiteSpot: build plan (Team Scope, JigJoy Black Friday AI Hackathon)

Read `CLAUDE.md` first, then this file, then `PROGRESS.md`. Talk to the user in Serbian. Code, comments, UI text and the
README are in English. After every meaningful step, explain in a few plain Serbian sentences what you built and why.

**Writing rule for every text in the project (UI, docs, comments, commit messages):** never use long dashes. Use a
plain hyphen `-` or rewrite the sentence.

- App name: **SuiteSpot**
- Repo: https://github.com/g4jic/Black-Friday-Hackaton (public)
- Local path on Andrej's machine: `C:\Users\Lenovo LOQ\Desktop\SuiteSpot`
- We work in **Claude Code CLI in PowerShell** (Windows). Give PowerShell commands.

## 1. The product in one sentence
A small business fills in a questionnaire and either submits a commercial space it is considering (mode A) or asks
SuiteSpot to find candidates (mode B). A team of Mozaik agents evaluates every candidate **at the same time** from
different angles and answers one question: **"Is this lease a good financial decision for my business?"** Every number
points to its source or is clearly marked as an estimate with its method. The output always says it is not financial
or legal advice.

**Framing rule:** this is a finance product (a lease is a multi-year financial commitment), not a real-estate search.
The finance analysis is the core of the result; location and premises findings confirm or break the financial case.

## 2. Users and the problem
- Small businesses (cafes and food, retail shops, small offices and studios, small workshops) choosing a space to rent.
- Today they compare listings by asking rent only. They miss hidden costs (service charges, VAT on rent, deposit,
  agency fee, indexation over the term, utilities, fit-out), risky lease clauses (personal guarantee, long notice,
  tenant pays structural repairs) and whether the location can generate the revenue the rent requires.
- Mode A is mode B with one candidate. **Build one pipeline, not two.**

## 3. Scope

**Must have (the demo depends on it)**
- Web app (English), designed with Uizze from the start: questionnaire, mode choice, follow-up questions, live
  research view (agents working in parallel, candidates appearing, flags, cancellations), ranked report with sources,
  research history.
- Live research: web search for listings, OpenStreetMap data for the area, estimates with method and sources.
- Candidate pipeline with parallel evaluators, hard and soft flags, cancellation on hard flag, auditor, scoring.
- **Demo mode (keyless, deterministic):** a labelled synthetic dataset plus one recorded real research run, replayed
  without any API key. One command. This is also what the judges run.
- History of research runs: Supabase in live mode, a local JSON file in demo mode.
- Mozaik Cloud tracing (automatic when paired) and our own JSONL trace.
- Unit tests for the domain rules; one end-to-end demo-mode run as `npm test`.
- Deployed live link (Railway) running demo mode by default.

**Out of scope (say so in the README)**
- Scraping listing portals beyond what web search returns and public listing pages. Photo analysis. Legal verdicts on
  permitted use. Stripe and Solana (no natural fit for this problem).

## 4. Data: live, on demand, nothing stored except results

### 4.1 Listings (mode B): live web search
- Mozaik only sends our own function tools to the model, so Anthropic's server-side `web_search` tool cannot pass
  through Mozaik directly. Implement a Mozaik `FunctionTool` named `search_listings` whose `invoke` calls the Anthropic
  Messages API directly (`@anthropic-ai/sdk`, already a dependency of `@mozaik-ai/core`) with the server tool
  `{ "type": "web_search_20250305", "name": "web_search", "max_uses": 5, "user_location": {...} }`.
- Same `ANTHROPIC_API_KEY`. Price: $10 per 1,000 searches plus tokens. Cap searches per research run (default 8).
- **First check:** does `claude-haiku-4-5` support web search for our key? (Models API:
  `capabilities.server_tools.web_search.supported`, or one test call.) If not, use the cheapest supported model for this
  one tool only.
- Results carry `url`, `title` and citations. Every listing value we keep stores its URL as the source. Values the page
  does not state stay `null`. Never fill a `null` with a guess.
- Respect sites: read only search results and public listing pages, at a slow rate. If a page blocks us, skip it.
- **Always open the listing page and use its values, never the search snippet.** Tested on 26 Nov: a snippet showed
  1,800 EUR/month while the live page of the same listing said 1,400 EUR/month. Store `updatedAt` from the page.
- **Noise filter in code (before a listing becomes a candidate):** drop listings for sale, apartments and houses,
  placeholder prices (for example 1 EUR/month), prices per m² far outside the range of the other results, and listings
  outside the requested city or size. Listings not updated in the last 60 days get a soft "may be outdated" finding.
- **Personal data:** never store or show phone numbers, emails or agents' names from listing pages. Keep only the URL.
- **Page fetch failures** (tested: some pages return a client error) become a soft finding "listing page could not be
  read" and the candidate is skipped. Never crash, never retry the same page in a loop.
- Fetching the listing page: a `fetch_listing` function tool. Use Anthropic's server-side web fetch tool through the
  same direct SDK call as search if it is available for our key, otherwise a plain HTTP GET with a real `User-Agent`
  and HTML-to-text conversion. Decide after the step 1 check.

### 4.2 Area data: OpenStreetMap (free, public, no key)
- Geocode the address or neighbourhood with Nominatim, then query Overpass for: competitors of the same business type
  within a radius, public transport stops, parking, `landuse` (residential, commercial, industrial, retail).
- Follow the OSM usage policies: a real `User-Agent`, at most 1 request per second to Nominatim, cache per research
  run. Every value stores the OSM element id or query as its source.

### 4.3 Estimates (a service to the user, never a guess)
- Where data is missing, the code produces an **estimate**: a range, the method and the sources. Example: "estimated
  rent 850-1,100 EUR/month, median of 6 comparable listings found in this area" with the 6 URLs.
- Fewer than 3 comparables: no estimate, show "not enough data".
- Estimates are computed by code, never by the model, and the UI marks them visually as estimates.

### 4.4 Lease
- Mode A: the user uploads or pastes the lease draft. The Lease reader analyses it clause by clause.
- Mode B: live listings have no lease. The Lease reader produces "questions to ask the landlord before signing",
  based on the business and the listing.

### 4.5 Demo mode data (synthetic, labelled)
- `data/demo/` holds a synthetic city scenario that shows the app at its best (several candidates, one hard-flag
  cancellation, one fair-price estimate, a lease with a risky clause) and one **recorded real research run**
  (search results and OSM responses saved as fixtures).
- Every synthetic record has `"synthetic": true`, and the UI shows a "Demo data" badge.

### 4.6 Our assumptions (labelled, user can change)
`config/weights.json`: aspect weights per business type and the rent-to-revenue thresholds. Shown in the UI as
"SuiteSpot assumptions".

## 5. Domain model (`src/domain/`, plain TypeScript, no I/O, no LLM)
- Value objects: `Money`, `AreaM2`, `SourceRef` (`{ kind: "listing" | "osm" | "lease" | "profile" | "calc" | "estimate", ref, field?, clause? }`).
- `BusinessProfile`: business type and description, headcount, required m² range, monthly budget, expected monthly
  revenue, walk-in customers, lease length, city or area, fit-out and equipment budget, special needs.
- `Requirement`: `{ id, text, hard, aspect: "premises" | "location" | "lease" | "finance", source }`, produced by the
  Interviewer (examples: delivery van needs van parking and loading access; a loud wood workshop needs an industrial or
  mixed zone, not a residential building; a cafe needs kitchen ventilation, water and drain, a customer toilet;
  machines need enough power; walk-in customers need a storefront and foot traffic).
- `Candidate`: listing + status `pending | evaluating | rejected | scored`. `reject(flag)` is idempotent.
- `Finding`: `{ candidateId, aspect, severity: "hard" | "soft" | "info", claim, value?, source }`.
  Invariant: no valid `source` -> `DomainError("Finding has no source")`.
- `LeaseCostCalculator` (pure functions, each output carries its source or estimate method):
  monthly cost (rent, service charge, VAT on rent, utilities by heating type, local sign tax only if sourced),
  initial costs (deposit, agency fee, fit-out, equipment), total cost over the term with indexation, **exit cost after
  12 months** (notice rent, penalties, lost deposit, unrecovered fit-out), rent as % of revenue, **break-even revenue**,
  **payback months**, fair-price check against comparables.
- Hard flags are decided in code, never by the model: monthly cost above budget by more than 10%; a hard requirement
  definitely not met; area outside the required range; rent above the threshold share of expected revenue.
- Never a legal verdict: permitted use and technical conditions are reported as "check before signing: <what>".
- Every domain rule has a unit test that proves the violation is rejected.

## 6. Shared state (`RuntimeState` subclass)
`profile`, `mode`, `requirements`, `candidates`, `findings`, `estimates`, `weights`, `inferenceSemaphore` (max parallel
model calls, default 4), `searchBudget`, `trace`.

## 7. Participants (`src/application/`)

| Participant | Kind | Wakes on | Does |
|---|---|---|---|
| User | human | - | Answers questions, picks the mode, reads the report. |
| Interviewer | AI | `profile.submitted` | Asks 2 to 4 follow-up questions that depend on the business, then writes the requirements list. |
| Scout | AI + tools | `requirements.ready` (mode B) | Uses `search_listings` to find listings matching the profile, extracts fields with URLs, publishes `candidate.found` **one by one**, so evaluation starts while the search continues. |
| Finance analyst | AI + tools | `candidate.found` | Answers the core question with the calculator tools. Explains; never computes numbers itself. |
| Lease reader | AI | `candidate.found` | Mode A: clause analysis with citations. Mode B: questions to ask the landlord. |
| Location analyst | AI + tools | `candidate.found` | Goal: can this location produce the revenue the rent requires? Uses OSM tools and the location requirements. |
| Premises inspector | AI | `candidate.found` | Listing text: floor, storefront, condition, technical fit, previous use (existing installations lower fit-out cost), signs of frequent tenant changes. Checks premises requirements. |
| Auditor | AI + code | `finding.added` | Code checks the source exists and the value matches; AI checks the claim follows from the cited text. Also flags **contradictions inside a listing** (tested: title says private parking, feature list says shared parking; floor count conflicts with the description) as "check before signing". Rejected findings go back to the author. |
| Ranker | code | all candidates done | Scores with `weights.json`, ranks, writes the report and saves the run to history. |

Each evaluator runs one `runLoop` per candidate (for example 8 candidates x 4 evaluators = 32 loops, bounded by the
semaphore). Findings use `structuredOutput` and are validated by the domain before entering state.

## 8. Hard flag cancels the candidate
Mozaik has no API to stop a running loop. Every evaluator loop gets an `InterceptionHandler` that, before each
`inference` or `function_call` step, checks the candidate status. If rejected, it rewrites the step so the model
receives "Candidate rejected by <aspect>: <reason>. Stop and answer 'stopped'." **Never return `idle` from `handle`**
(crashes the process, tested on 6.0.0). **Spike this first.** The UI shows who raised the flag and which loops stopped.

## 9. Web app
- Stack: Vite + React + TypeScript + Tailwind for the frontend; a small Node server (Fastify) that runs the Mozaik
  runtime and streams events to the browser with Server-Sent Events. One service, deployed on Railway.
- Screens: questionnaire, mode choice, follow-up questions, live research (agent lanes over time, candidates as cards
  that update, flags and cancellations visible), report (ranked candidates, every figure with a source link or an
  estimate badge, "not financial or legal advice"), history list and history detail.
- Design with Uizze (see `CLAUDE.md`). Clean, calm, finance-grade. The live research view is the hero of the demo.
- Run metrics on the report: candidates, loops, peak loops in parallel, flags, cancellations, duration, tokens, cost.

## 10. Reliability (required)
Resilient inference runner (retry with backoff, then a "failed" answer instead of a throw), try/catch around every
processor, last-resort process handlers, idempotent `reject`, search and OSM failures become soft findings, an
end-to-end test where one evaluator fails and the others still finish.

## 11. Build order (targets)
1. **Thu 13:00-15:00:** repo skeleton (server + web), `@mozaik-ai/core@6.0.0`, mock runner, resilience helpers, domain
   model with tests. Spike the cancellation interception. Check web search and web fetch support for the model with one
   real call (needs `ANTHROPIC_API_KEY` in `.env`).
2. **Thu 15:00-18:00:** thin slice in demo mode: Scout (fixtures) + Finance analyst + Lease reader on 3 candidates,
   events streamed to a first live research screen.
3. **Thu 18:00-22:00:** Location analyst (OSM), Premises inspector, Auditor, Ranker, hard-flag cancellation, history.
   Design pass with Uizze on the questionnaire and live research screens.
4. **Fri 09:00-13:00:** live mode end to end (real search, OSM, `claude-haiku-4-5`), Interviewer, mode A, record one
   real run as a fixture, report screen.
5. **Fri 13:00-16:00:** Railway deploy, design polish, metrics, fixes. Feature freeze at 16:00.
6. **Fri 16:00-17:00:** rehearse the demo, record the video. **17:00-19:00:** demo.
7. **Fri 19:00-22:00:** README (it is scored, make it excellent), screenshots, fresh-clone test, submit.

## 12. How we work (relay, one person at a time)
- One person works in Claude Code at a time. When their usage runs out or they take a break, they **push everything**
  and the other continues. The next session starts by reading `CLAUDE.md`, this plan and `PROGRESS.md`.
- **Before every push, update `PROGRESS.md`:** what is done, what is in progress, the exact next step, open problems,
  decisions made and why. Keep it short and current, newest at the top.
- `main` must always run in demo mode (`npm test` passes). Small commits with clear messages.
- `.env` is in `.gitignore`; only `.env.example` is committed. Never commit keys (`sk-ant-...`, `jjk_...`, `pk_...`).
  Commit `package-lock.json`. Pin `@mozaik-ai/core` to exactly `6.0.0`.
- **Uizze:** the Uizze MCP is only on Andrej's machine. Design-heavy steps (new screens, design passes) are done in
  Andrej's sessions. In Aleksa's sessions, use the free Uizze skills if installed (`npx skills@latest add uizze/uizze`)
  and the existing design system in the repo; write design work that needs the MCP into `PROGRESS.md` as "for Andrej".
- The person not coding: tests the app, prepares the demo scenario and the demo script, collects screenshots.

## 12a. Feasibility check (done 26 Nov, 13:10, on a real Novi Sad listing)
A real listing page gave: rent, deposit, m² per floor, shop windows, parking, heating, ceiling height, toilet, suitable
activities, condition, update date. Missing: agency fee, VAT, service charges, power, ventilation, lease terms,
history. Expected coverage per aspect: finance core yes (gaps flagged), premises yes, location partly (OSM still to be
tested), lease only as questions to the landlord, history mostly no. The report must show this honestly per candidate
("what we know, what we estimated, what to check").

## 13. Known holes (state them in the README)
- Live listings depend on what web search finds; coverage varies by city.
- OSM data can be incomplete; missing data becomes "check before signing", not a guess.
- Synthetic demo data and our weights are labelled as such.
- No zoning or legal verification; the decision stays with the human.
