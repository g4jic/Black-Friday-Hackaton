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
A small business fills in a questionnaire and either pastes the text of 1 to 8 listings it is considering (mode A) or
asks SuiteSpot to find candidates (mode B). A team of Mozaik agents evaluates every candidate **at the same time** from
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
- **Mode A takes 1 to 8 listings at once** (decided 26 Nov). The user pastes the text of each listing they are
  considering, and each one becomes a candidate. So real data also has volume: candidates are evaluated in parallel, a
  hard flag cancels a candidate mid-run, and the Ranker compares them. One listing is just the special case.
- The user pastes **text, not a link**. Our server never opens pages of listing sites.
- Mode B (SuiteSpot finds candidates) feeds the same pipeline. It runs on synthetic listings in demo mode and goes live
  only for a site that gives us written permission (section 4.1). **Build one pipeline, not two.**

## 3. Scope

**Must have (the demo depends on it)**
- Web app (English), designed from the start (look defined in `DESIGN.md`): questionnaire, mode choice, listing paste
  (1 to 8 listings, each with an optional lease draft), follow-up questions, live research view (agents working in
  parallel, candidates appearing, flags, cancellations), ranked report with sources, research history.
- Real research in mode A: 1 to 8 pasted listings, OpenStreetMap data for the area, estimates with method and sources.
  Live web search for listings (mode B) only for a site that gave written permission (section 4.1).
- Candidate pipeline with parallel evaluators, hard and soft flags, cancellation on hard flag, auditor, scoring.
- **Demo mode (keyless, deterministic):** a labelled synthetic dataset (optionally plus one recorded real run that
  keeps only links and extracted facts, section 4.5), replayed without any API key. One command. This is also what
  the judges run.
- History of research runs: Supabase in live mode, a local JSON file in demo mode.
- Mozaik Cloud tracing (automatic when paired) and our own JSONL trace.
- Unit tests for the domain rules; one end-to-end demo-mode run as `npm test`.
- Deployed live link (Railway) running demo mode by default.

**Out of scope (say so in the README)**
- Automated reading of listing portals without the site's written permission (we read their terms of use, see
  section 4.1). Photo analysis. Legal verdicts on permitted use. Stripe and Solana (no natural fit for this problem).

## 4. Data: real when the user brings it, synthetic in demo, nothing stored except results

### 4.1 Listings
**Decision (26 Nov, after reading the terms of use, see `PROGRESS.md`):** 4zida.rs forbids automated use by the letter
of its terms; oglasi.rs and svenekretnine.com are unclear and restrict copying. So we do not read listing sites
automatically.

**Mode A: pasted listings (real data, 1 to 8 per run)**
- The user pastes the text of each listing. Each paste becomes one candidate; there is no URL and nothing is fetched.
- The Scout reads each pasted text and fills the listing fields, one loop per pasted listing (section 7). Every
  value's source is the pasted text: `{ kind: "listing", ref: "pasted-<n>", field, line }`. Values the text does not
  state stay `null`.
- **Personal data:** code removes phone numbers, emails and agents' names from the pasted text before it enters state.
- The same noise filter as below runs on pasted listings (for sale, apartments, placeholder prices, wrong city or
  size), but in mode A it produces a visible finding instead of silently dropping the user's listing.

**Demo mode (what the judges run):** synthetic listings in exactly the same shape as pasted ones, every record
`"synthetic": true`, the UI shows a "Demo data" badge.

**Mode B: live web search, OFF by default.** Enabled only for a site that gives us written permission (permission
emails drafted on 26 Nov, Aleksa sends them), and only for that site through `allowed_domains`. Until then mode B
runs on synthetic listings. The design below stays for that case.
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
- Per candidate, not per run. In mode A the user can paste a lease draft next to any of the 1 to 8 listings (optional).
- Candidate with a pasted lease draft: the Lease reader analyses it clause by clause, citing the clause.
- Candidate without a lease (every mode B candidate, and mode A listings without a draft): the Lease reader produces
  "questions to ask the landlord before signing", based on the business and the listing.
- Demo mode includes at least one synthetic lease with a risky clause.

### 4.5 Demo mode data (synthetic, labelled)
- `data/demo/` holds a synthetic city scenario that shows the app at its best (several candidates, one hard-flag
  cancellation, one fair-price estimate, a lease with a risky clause). Synthetic listings have exactly the shape of
  pasted listings (section 4.1), so demo and mode A run the same code.
- Every synthetic record has `"synthetic": true`, and the UI shows a "Demo data" badge.
- **Recorded real run (optional):** it never enters the public repo with listing text or photos. If we make one, it
  keeps only links and the extracted facts (price, m2, floor, with their field names) plus OSM responses; otherwise
  it is replaced by synthetic data.

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
| Interviewer | AI | `profile.submitted` | NOT BUILT (26 Nov): a fixed questionnaire `fixtures/requirements/demo.json` is used instead. Plan: asks 2 to 4 follow-up questions that depend on the business, then writes the requirements list. |
| Scout | AI (structured output) | `listings.submitted` (runs in parallel with the Interviewer; extraction does not need the requirements) | Mode A and demo: one loop per pasted (or synthetic) listing, in parallel; reads the text, extracts the fields with `pasted-<n>` + line as source, publishes `candidate.found` **as soon as each listing is read**, so evaluation of the first candidates starts while the others are still being read. Mode B (only for a site with written permission): uses `search_listings`, publishes candidates one by one in the same way. |
| Finance analyst | AI + tools | `candidate.found` | Answers the core question with the calculator tools. Explains; never computes numbers itself. |
| Lease reader | AI | `candidate.found` | Per candidate: with a pasted lease draft, clause analysis with citations; without one, questions to ask the landlord. |
| Location analyst | AI + tools | `candidate.found` | NOT BUILT yet (optional; normalise addresses like "grbavici" before Nominatim). Goal: can this location produce the revenue the rent requires? Uses OSM tools and the location requirements. |
| Premises inspector | AI | `candidate.found` | NOT BUILT yet. Listing text: floor, storefront, condition, technical fit, previous use (existing installations lower fit-out cost), signs of frequent tenant changes. Checks premises requirements. |
| Ranker | code | every listing read and no loop running | Scores with `RANKING_ASSUMPTIONS` (src/domain/ranking.ts): worst-case score ranges, confidence, 2-3 sourced reasons; ranks every candidate that was not rejected; publishes `candidate.scored` and `ranking.done`. |
| Report writer | AI | `ranking.done` | Writes the report (top 3 with reasons, check before signing, why rejected, unknowns) only from facts written by code, citing them per sentence; rewrites once on `report.audit_failed`. |
| Auditor | code (no AI, decided 26 Nov) | `report.drafted` | Checks every sentence of the report against the facts it cites (numbers, candidate ids, rejected never recommended, top 3 only); sends problems back once, then removes and marks failing sentences. The planned in-listing contradiction check (private vs shared parking) is NOT built yet. Every finding is already rejected without a source by `SuiteSpotState.addFinding`. |

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
- Screens: questionnaire, mode choice, listing paste (1 to 8 listing texts, each with an optional lease draft),
  follow-up questions, live research (agent lanes over time, candidates as cards that update, flags and
  cancellations visible), report (ranked candidates, every figure with a source link or an
  estimate badge, "not financial or legal advice"), history list and history detail.
- The look follows `DESIGN.md`. Clean, calm, finance-grade. The live research view is the hero of the demo.
- Run metrics on the report: candidates, loops, peak loops in parallel, flags, cancellations, duration, tokens, cost.

## 10. Reliability (required)
Resilient inference runner (retry with backoff, then a "failed" answer instead of a throw), try/catch around every
processor, last-resort process handlers, idempotent `reject`, search and OSM failures become soft findings, an
end-to-end test where one evaluator fails and the others still finish.

## 11. Build order (targets)
Status 26 Nov evening: steps 1-3 done except Location analyst, Premises inspector and history; from step 4 the live
mode, mode A, the report screen, the Ranker, the Report writer and the Auditor are done; Interviewer, Railway and the
README are open (see PROGRESS.md HANDOFF).

1. **Thu 13:00-15:00:** repo skeleton (server + web), `@mozaik-ai/core@6.0.0`, mock runner, resilience helpers, domain
   model with tests. Spike the cancellation interception. Check web search and web fetch support for the model with one
   real call (needs `ANTHROPIC_API_KEY` in `.env`).
2. **Thu 15:00-18:00:** thin slice in demo mode: Scout (fixtures) + Finance analyst + Lease reader on 3 candidates,
   events streamed to a first live research screen.
3. **Thu 18:00-22:00:** Location analyst (OSM), Premises inspector, Auditor, Ranker, hard-flag cancellation, history.
   Design pass on the questionnaire and live research screens.
4. **Fri 09:00-13:00:** live mode end to end with mode A (1 to 8 pasted listings, OSM, `claude-haiku-4-5`),
   Interviewer, report screen. Real search in mode B only for a site that gave written permission. A recorded real run
   is optional and keeps only links and extracted facts (section 4.5).
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
- **Design:** Design is done by Aleksa and Claude in Aleksa's sessions; `DESIGN.md` is the single source of truth for
  the look.
- The person not coding: tests the app, prepares the demo scenario and the demo script, collects screenshots.

## 12a. Feasibility check (done 26 Nov, 13:10, on a real Novi Sad listing)
A real listing page gave: rent, deposit, m² per floor, shop windows, parking, heating, ceiling height, toilet, suitable
activities, condition, update date. Missing: agency fee, VAT, service charges, power, ventilation, lease terms,
history. Expected coverage per aspect: finance core yes (gaps flagged), premises yes, location partly (OSM still to be
tested), lease only as questions to the landlord, history mostly no. The report must show this honestly per candidate
("what we know, what we estimated, what to check"). This check fetched a page before we read the terms of use; we no
longer fetch listing pages, the same fields now come from pasted text (section 4.1).

## 13. Known holes (state them in the README)
- Real listings come only from what the user pastes (1 to 8 per run). SuiteSpot does not search listing sites,
  because their terms of use forbid or restrict it; mode B search goes live only for a site that gives written
  permission. Pasted text can be incomplete; missing values stay "missing data", never a guess.
- OSM data can be incomplete; missing data becomes "check before signing", not a guess.
- Synthetic demo data and our weights are labelled as such.
- No zoning or legal verification; the decision stays with the human.
