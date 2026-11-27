# SuiteSpot

**Is this lease a good financial decision for my business?** SuiteSpot answers that for a small business in about
ten seconds: Mozaik agents evaluate every candidate space at the same time, code does every calculation, a hard flag
in code stops the agents still working on a deal breaker, and every number on the screen points to its source.

![SuiteSpot results: ranked spaces, each rank circle coloured by its verdict, with score, monthly cost and the main reason](design/screenshots/results-list.png)

> Built during the JigJoy Black Friday AI Hackathon (26-27 Nov 2026), track "AI agents in finance".
> **All listings, landlords and businesses are synthetic. Not financial or legal advice.**

- Demo video: **[link coming]** (2-3 min)
- Live deployment: **https://suitespot-production.up.railway.app**
- Mozaik Cloud: [screenshot of the project](#how-the-agents-run-concurrently) with the loops of every agent (the Cloud project is private)

### Two ways to try it
Both run the same code from this repository. The only differences come from keys that a public repository cannot
ship; put your own keys in `.env` and the local version does everything the online one does.

| | **Local**, from this README ([Quick start](#quick-start-no-key-no-database)) | **Online**, https://suitespot-production.up.railway.app |
|---|---|---|
| Setup | `npm install`, `npm run dev`: no key, no database, about two minutes | None: open the link and sign up |
| Accounts | Kept on your computer (`data/local-accounts.json`) | Supabase Auth |
| Agents | Find spaces for the three example businesses: recorded real runs of claude-haiku-4-5, replayed with their timing. Every other run (your own questionnaire, any listing, an outside listing): scripted agents. The same code checks every value. The screen labels neither; this README does | The live model (claude-haiku-4-5) on our key, with your own questionnaire or an outside listing |
| Rent payment | A simulated checkout (no card, no money) | A real Stripe Checkout in a Stripe test sandbox (test card `4242 4242 4242 4242`), fake money |
| The same in both | The Mozaik runtime, every rule, calculation, hard flag, ranking, verdict and audit; onboarding with roles; listings, offers, leases and the rent schedule | The same |

Online, spending on the model is capped by a usage limit in the Anthropic Console, and the server runs one live
research at a time.

## Contents
- [The problem](#the-problem)
- [Quick start (no key, no database)](#quick-start-no-key-no-database)
- [With an Anthropic key (live model)](#with-an-anthropic-key-live-model)
- [Optional: Supabase accounts and listings](#optional-supabase-accounts-and-listings)
- [How the agents run concurrently](#how-the-agents-run-concurrently)
- [Care with financial data](#care-with-financial-data)
- [Evidence: ten real-model evaluations](#evidence-ten-real-model-evaluations)
- [What is real, recorded and scripted](#what-is-real-recorded-and-scripted)
- [Architecture and code map](#architecture-and-code-map)
- [Tests](#tests)
- [Known limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Credits](#credits)

## The problem
A small business owner (a cafe, a design office, a food shop) looks at five to eight commercial listings and one or
two lease drafts. To compare them honestly they must work out, for each space: the real monthly cost (rent plus
service charges), the money needed up front (deposit, fit-out, equipment), what leaving early would cost, what share
of expected revenue the space eats, and which lease clauses are deal breakers (no exit for ten years, a landlord who
may raise the rent at will, a permitted use that excludes their business). Done by hand that is an evening with a
spreadsheet per listing, and the clause that matters most is the easiest to miss.

SuiteSpot is a two-sided platform: landlords publish structured listings (rent, costs, area, term, early exit,
indexation, permitted use, optionally the lease draft and up to six photos), and a business either asks **Find spaces** (SuiteSpot picks
the listings that fit its questionnaire) or **Evaluate an outside listing** (it types in the terms of a space it found
elsewhere). Every candidate gets a score range, a verdict decided by code, and a list of what to check before signing.
When the business picks a space it can make an offer; once the landlord accepts, both sides see the same lease with
its rent due dates, and the tenant pays each month's rent (simulated, or Stripe in test mode).

Why a platform and not a scraper: we read the terms of use of the Serbian listing sites (4zida.rs, oglasi.rs,
svenekretnine.com) and none allows automated reading of their listings, so SuiteSpot reads only listings published
on SuiteSpot itself or terms the user types in.

## Quick start (no key, no database)
You need **Node.js 22 or newer** (check with `node -v`) and git. Nothing else: no API key, no database, no Docker.
Commands are for Windows PowerShell; they are the same in a macOS or Linux terminal.

```powershell
git clone https://github.com/g4jic/Black-Friday-Hackaton.git SuiteSpot
```
```powershell
cd SuiteSpot
```
```powershell
npm install
```
```powershell
npm run dev
```

We say `npm install` rather than `npm ci`. Both work on a fresh clone (we tested both), and every dependency is pinned
to an exact version in `package.json` with the lockfile committed, so both install the same versions. `npm install`
is simply the one that does not fail outright if your npm version reads the lockfile slightly differently, and it
does not delete an existing `node_modules` first. Use `npm ci` if you want a strict lockfile install.

`npm run dev` starts two processes: the API with the Mozaik runtime on port 3000 and the web app on port 5173.
Wait for the line `Local: http://localhost:5173/`, then open **http://localhost:5173**. No `.env` file is needed.

Then:
1. **Sign up** with any email and password. Without Supabase the account is kept on this computer only
   (`data/local-accounts.json`, password stored as a scrypt hash); the page says so.
2. **Onboarding:** choose **Find a space** (or **Set up both roles**); the role decides what the menu shows. On the
   business profile form press **Skip for now** (or "Fill with example", then save) and you are in the app.
3. Click **Research** in the side menu; the **Find spaces** tab is open.
4. Under "Demo scenario" pick one of the three: **Cafe in Novi Sad**, **Office in Beograd** or **Shop in Novi Sad**.
   The questionnaire on the left is locked to that scenario.
5. Click **Search and evaluate**.

![Onboarding: choose List my space, Find a space or Set up both roles](design/screenshots/onboarding.png)

What you see:
- **The run** (about 7 to 13 seconds): the agents start on the big circle. An agent with running loops steps into
  the white field and moves around it; **each running agent loop is a small dot circling its agent**, and the centre
  counts them (peak 30 in the office scenario). A thin lilac link joins two agents while both have loops on the same
  space. When code finds a deal breaker, the agent that raised it glows dark red and steps towards the centre, the
  loops it cancelled fly off in red, the agents that owned them recoil, and the space moves to "Ruled out" with the
  reason. When the Lease reader's terms reach a Finance loop that waits for them, the two agents meet and a "Lease
  terms" pulse runs between them; when the Auditor sends a draft back, it meets the Report writer with a "Sent back"
  pulse. At the end the Ranker steps in and glows. Every dot, link, glow and pulse comes from a real bus event, never
  from a timer (`web/src/run/orbit-model.ts`, checked against the three recordings in `tests/orbit-model.test.ts`);
  only the agents' paths are free (they drift, wander and keep out of each other's way), so where an agent stands
  means nothing.
- **Results, List tab**: one ranked list. **The rank circle's colour is the verdict** (green Good, yellow Check
  before signing, red Not recommended; one small legend above the list, the verdict in each circle's tooltip), with
  the score, the monthly cost and the main reason. Rejected spaces are in their own block with the hard flag that
  rejected them, and keep its icon.
- **A space's page** reads like a short financial report: a summary (verdict colour, score or range such as "64-74",
  monthly cost, main reason), then collapsible cards (Costs, Bad year / good year, Lease or buy, Lease terms,
  Location, The space, Strengths and risks, What is unknown). Each card opens with one sentence on what it shows and
  what it means for this space; every number after it carries its source, and two small bar charts use calculated
  values only.
- **Report tab**: the audited report, one sentence per claim, each with the facts it cites and "Audited: N claims
  checked".
- **Timeline tab** ("How your research ran"): one lane per agent loop over time, calculator calls as dots, the loop
  that a hard flag cut, and the totals (duration, loops, peak at once, calculator calls, ruled out, loops stopped).
- Without a key every flow still runs: the three example businesses replay recorded real runs of claude-haiku-4-5,
  everything else uses scripted agents (see [What is real, recorded and scripted](#what-is-real-recorded-and-scripted));
  the screen does not label them.
- **How it works** (avatar menu): every weight, threshold and assumption, served from the code itself.

![The run at its peak: 27 agent loops as dots on the eight candidates, one candidate already ruled out by a deal breaker](design/screenshots/run-mid.png)

![A space's page: summary with the verdict colour, score range, monthly cost and main reason, then the Costs and Lease or buy cards with sourced numbers and charts](design/screenshots/candidate.png)

### Then rent a space, still with no key (offer, lease, rent payment)
1. Open any space (for example from the results, or under **Listings**) and use **Make an offer**: rent, start date,
   term, then **Send offer**.
2. A seeded listing has no real owner, so you answer the offer yourself: under **My spaces**, click **Accept** on your
   offer. Code creates the lease and its rent schedule (one due date per month).
3. Under **My spaces** the lease shows every month as upcoming, due, overdue or paid. Click **Pay rent**: without
   Stripe keys a simulated checkout opens (no card, nothing is charged); confirm it and the month turns **Paid**, with
   the payment reference in its tooltip. With Stripe test keys the same button opens Stripe Checkout in test mode.
   The interface does not tag these as simulated or test: this README and the How it works page state it once.
4. A landlord sees the same lease and the same paid month under **Offers** (sign in with a second account that chose
   "List my space", publish a listing, and make the offer from the first one to see both sides).

With Stripe test keys in `.env` (`STRIPE_SECRET_KEY`: `sk_test_`, `rk_test_` or `rkcs_test_`;
`STRIPE_PUBLISHABLE_KEY`: `pk_test_`), the same button opens a **Stripe Checkout in test mode** instead (test card
`4242 4242 4242 4242`); live keys are refused. No Stripe account is needed: the Stripe CLI command
`stripe sandbox create --email <you>` makes an anonymous test sandbox with working keys for 7 days, which is how the
online version runs it (a Stripe account cannot be opened from Serbia; the sandbox needs no account and no country). Both go through one
payment port (`src/application/payments/payment-gateway.ts`) and are recorded the same way, only the reference
differs (`simulated:<id>` or the Stripe `cs_test_` session id). **Stripe test mode demonstrates the flow; Stripe does
not support businesses registered in Serbia, so a production version would use a local payment processor behind the
same port.** No real money moves in any mode.

Stop the servers with `Ctrl+C` in the terminal.

## With an Anthropic key (live model)
With a key the agents call the real model (`claude-haiku-4-5`, your own cost: about $0.05 to $0.10 per run) and you
can fill in your own questionnaire and evaluate an outside listing.

```powershell
Copy-Item .env.example .env
```
Open `.env`, set `ANTHROPIC_API_KEY=` to your key from console.anthropic.com, save, and run `npm run dev` again.
There is no mode switch: a server with a key runs live, a server without one runs the recorded demo. The key stays on
the server; the browser never receives it, and server events are scrubbed of it before they are streamed.

- Cost guard: set a usage limit for the key in the Anthropic Console. The server also runs at most one live research
  at a time (a second one gets 429).
- `MOZAIK_API_KEY` (optional): Mozaik Cloud tracing. Easier: run the pairing once, see below.
- `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` (optional, test keys only, for example from
  `stripe sandbox create`): rent payments through Stripe Checkout in test mode instead of the simulated checkout.

## Optional: Supabase accounts and listings
Without Supabase, listings come from a local store (the 100 seeded synthetic listings, plus anything you publish
locally into `data/local-listings.json`), accounts are kept on this computer (`data/local-accounts.json`) and offers,
leases and rent payments in `data/local-deals.json`. With a Supabase project:
1. Apply the migrations in `supabase/migrations/` (tables `listings`, `listing_contacts`, `saved_listings`,
   `listing_views`, and for deals `offers`, `tenancies`, `rent_payments`, all with row level security: each party
   reads only its own offers, leases and payments, and only the server writes them, after the domain rules pass).
   `supabase/checks/rls-checks.sql` holds the RLS checks we ran ("all RLS checks passed").
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`. The service role key is used by
   the server and the seed script only, never sent to the browser.
3. `npm run seed:supabase` creates the 100 demo landlords and listings (idempotent).
4. For a public deployment: in Supabase Auth set the Site URL and the redirect URL to the deployed address, and turn
   off "Confirm email" (the default Supabase mail sender is rate limited).

Then sign up, publish a listing, save spaces under My spaces and see view counts under My listings. Contacts live in
their own table that anonymous users cannot read; the server reveals one only on "Show contact", and demo phone
numbers are partly masked with no tel: links.

## How the agents run concurrently
Built on **`@mozaik-ai/core` 6.0.0**. Every research run gets its own Mozaik runtime: one shared typed
`RuntimeState`, and participants that join it. **There is no orchestrator.** Nobody calls or awaits an agent: every
event goes to every participant, and each one decides through its situation handlers whether to react. `runLoop` is
fire-and-forget, so each candidate gets its own loop with its own context, and many loops think and call tools at the
same time.

| Participant | AI or code | Wakes on | Does | Publishes |
|---|---|---|---|---|
| Catalogue match and listing form check | code | the user starts Find spaces or an evaluation | Picks the listings that fit the questionnaire (city, area, business type, budget + 10%; listings in the preferred districts first, the others still follow) and adds each as a candidate, every value sourced to a listing form field; checks permitted use on every candidate, and applies the lease rules to the form terms when there is no lease draft | `catalogue.matched`, `candidate.found` (one per candidate), `candidate.rejected` on a deal breaker |
| **Finance analyst** | **AI** (one loop per candidate) | `candidate.found` | Calls the `calculate` tool (code) for monthly cost, initial costs, cost per m2; waits in state for the lease terms; then cost over the term, exit cost, share of revenue, break-even, payback; explains in at most 120 words using only returned numbers | `finance.explained`, `candidate.rejected` (budget hard flag, decided by code) |
| **Lease reader** | **AI** (one loop per lease draft) | `candidate.found` with a draft | Reads the draft into clauses, each with an exact quote; code checks every quote against the draft and decides hard flags and concerns | `lease.read`, `candidate.rejected` |
| **Location analyst** | **AI** (one loop per candidate) | `candidate.found` | Calls `area_data` (code counts places mapped in OpenStreetMap within 300 m: same business, transport, schools, offices, parking, and the land use around the address); explains them for this business using only returned numbers; code decides the location score and whether noisy work next to housing is a point to check | `location.explained` |
| **Premises inspector** | **AI** (one loop per candidate) | `candidate.found` | Reads the listing and the lease draft for floor, storefront, parking, heating, kitchen ventilation, water and drain, renovation and step-free access, each with an exact quote; code checks the quotes and decides what suits the business | `premises.read` |
| **Scout** | **AI** | pasted listing text (Evaluate an outside listing) | Reads the pasted text into fields with quotes, in its own loop next to the others; code compares them with the typed fields | `listing.compared` |
| Candidate cancellation | code (interception) | before every step of every loop | When the candidate of that loop is rejected, stops the loop at its breakpoint: no further model call, a tool call in flight is answered "stopped" | `loop.cancelled` |
| Ranker | code | the room is quiet (every candidate read, no loop running) | Scores each candidate as a worst-case range, ranks by the low end, sets confidence and the verdict | `candidate.scored`, `ranking.done` |
| **Report writer** | **AI** | `ranking.done`, `report.audit_failed` | Writes the report only from numbered facts that code wrote from state, citing them per sentence | `report.drafted` |
| Auditor | code | `report.drafted` | Checks every sentence against the facts it cites (numbers, candidate ids, no rejected candidate recommended, top 3 only); sends problems back once, then removes failing sentences | `audit.done`, `report.audit_failed`, `report.ready` |
| Wire tap | code (observer) | every event | Streams a whitelisted projection of the bus to the browser over Server-Sent Events and computes the metrics | nothing on the bus |

Where the concurrency honestly comes from:
- **Volume**: with 8 candidates, 8 Finance analyst, 8 Location analyst and 8 Premises inspector loops plus one Lease
  reader loop per draft run at the same time.
- **Independent reviews of the same candidate**: the Finance analyst, the Lease reader, the Location analyst and the
  Premises inspector start on the same `candidate.found` and read different inputs (the numbers, the lease draft,
  the area data, the description of the space).
- **Reactions mid-run**: the Lease reader's lease terms land in shared state while the Finance analyst's loop is
  already running; Finance waits for them in state, not by calling the Lease reader. A hard flag from any participant
  rejects the candidate in state, and the interception stops every other loop on it at its next step.
- **Checks between agents**: code checks every quote the Lease reader and the Scout return against the source text;
  the Auditor checks the Report writer against the facts.

```mermaid
flowchart LR
  U([Business: questionnaire]) --> CM[Catalogue match and<br/>listing form check, code]
  CM -- "candidate.found x N" --> FA["Finance analyst<br/>AI, N loops in parallel"]
  CM -- "candidate.found (has a draft)" --> LR["Lease reader<br/>AI, 1 loop per draft"]
  CM -- "candidate.found x N" --> LA["Location analyst<br/>AI, N loops"]
  CM -- "candidate.found x N" --> PI["Premises inspector<br/>AI, N loops"]
  LA <-- "area_data tool" --> OSM[[OpenStreetMap counts<br/>code]]
  FA <-- "calculate tool" --> CALC[[Lease cost calculator<br/>code]]
  LR -- "lease terms in shared state" --> FA
  LR -- "hard flag" --> REJ{{candidate.rejected}}
  CM -- "hard flag (form terms, permitted use)" --> REJ
  FA -- "budget hard flag" --> REJ
  REJ -. "interception: stop at next breakpoint" .-> FA
  REJ -. "interception: stop at next breakpoint" .-> LR
  REJ -. "interception: stop at next breakpoint" .-> LA
  REJ -. "interception: stop at next breakpoint" .-> PI
  FA -- "model.answer" --> RK[Ranker<br/>code]
  LR -- "model.answer" --> RK
  LA -- "location.explained" --> RK
  PI -- "premises.read" --> RK
  RK -- "ranking.done" --> RW[Report writer<br/>AI]
  RW -- "report.drafted" --> AU[Auditor<br/>code]
  AU -- "report.audit_failed (once)" --> RW
  AU -- "report.ready" --> UI([Browser via SSE])
```

**Proof, not a claim.** The Timeline tab draws every loop as a lane from the runtime's own events, with the peak
number of loops in parallel. The three recorded scenarios, replayed without a key (27 Nov 2026, evening); every report passed the audit on the first draft (11, 10 and 10 claims checked, 0 corrected, 0 removed):

| Scenario | Duration | Agent loops | Peak in parallel | Rejected by a hard flag | Loops stopped |
|---|---|---|---|---|---|
| Cafe in Novi Sad | 12.6 s | 31 | 27 | 2 | 6 |
| Office in Beograd | 10.0 s | 32 | 30 | 2 | 5 |
| Shop in Novi Sad | 7.3 s | 29 | 28 | 4 | 10 |

The cut that shows the mechanism best: in **Office in Beograd** the Finance analyst works on "Voždovac, 51 m2" for
about 4.6 s, then the Lease reader finds that the landlord may raise the rent without a limit, and the Finance loop
stops before its next tool call. In **Shop in Novi Sad** two candidates are cut by the Lease reader at the same
moment (about 3.7 s). `npx tsx scripts/cut-report.ts` prints every cut.

![Timeline: one lane per agent loop, calculator calls, loops cut by a hard flag](design/screenshots/timeline.png)

Each run also appears in Mozaik Cloud, one session per agent loop. The core sends every loop event when it finds a
key (`MOZAIK_API_KEY` in `.env`, or a machine paired once with `npx @mozaik-ai/cloud-sdk pair`); without one it
prints "telemetry disabled" and runs normally. Our Cloud project after the work of 27 Nov 2026:

![Mozaik Cloud, project SuiteSpot: the five AI agents with their loop counts, the sum of every live run and recording of 27 Nov 2026](design/screenshots/mozaik-cloud.png)

The screenshot shows the five AI agents: **Report writer, Finance analyst, Lease reader, Location analyst and
Premises inspector**. Its numbers (for example Finance analyst 227 loops, Report writer 27) are the **sum of every live
run and every demo recording in the project on 27 Nov 2026**, not one run: the Report writer has one loop per
finished research, so the day had about 27 complete researches.

One run on its own, the **Cafe in Novi Sad** scenario live (27 Nov 2026, claude-haiku-4-5, 8 candidates, 15.8 s,
$0.098): **31 loops, peak 27 in parallel, 6 loops cut** by hard flags.

| Agent | Loops | Cut by a hard flag |
|---|---|---|
| Finance analyst | 8 (one per candidate) | 2 |
| Location analyst | 9 (one per candidate, plus one retry) | 2 |
| Premises inspector | 8 (one per candidate) | 2 |
| Lease reader | 5 (one per lease draft) | 0 |
| Report writer | 1 (the audited report) | 0 |

- Ranker, Auditor and the catalogue match are plain code, so they have no loops in Cloud.

Mechanisms, with the file that implements each:

| Mechanism | Where |
|---|---|
| One runtime per run, shared `RuntimeState`, one fresh context per loop | `src/application/runtime.ts`, `src/application/state.ts` |
| Situation handlers per agent (no keywords, typed event checks) | `src/application/agents/*.ts` |
| Hard flag stops other loops at their breakpoint (Mozaik `InterceptionHandler`) | `src/application/cancellation/candidate-cancellation.ts` |
| User "Cancel" stops the whole run the same way | `src/application/cancellation/run-cancellation.ts` |
| Finance waits for the lease terms in state | `waitForLease` in `src/application/state.ts` |
| At most one tool call per answer (`disable_parallel_tool_use`) | `src/adapters/inference/live-runner.ts` |
| Retries with backoff, a semaphore of 8 model calls, a provider error never crashes the room | `src/application/resilience/` |
| Recorded runs replayed with the recorded latencies | `src/adapters/inference/recording-runner.ts` |
| Event stream and metrics for the browser | `src/application/research/research-session.ts` |

## Care with financial data
- **Every number has a source.** A value is a `Sourced<T>` with a `SourceRef`: a listing form field, a lease quote, a
  questionnaire answer, or a calculation that lists its inputs. `validateSource` rejects a malformed source and the
  state rejects a finding without one (`src/domain/source.ts`, `src/application/state.ts`). The UI shows the source
  next to the number in plain words.
- **Models read; code calculates and decides.** The Finance analyst never computes: it calls the `calculate` tool
  (`src/domain/lease-cost.ts`). A deposit stated as "3 months of rent" is converted by code. Every number in an
  explanation must be one the tool returned, or the explanation is rejected (`src/domain/number-check.ts`).
- **Quotes are checked.** The Lease reader and the Scout must return the exact text they read a value from; code
  finds the quote in the source and checks the value against it. A field that fails on the last attempt becomes
  "could not confirm" with the reason, never a guess (`src/domain/quoted-extraction.ts`).
- **Hard flags are code, and they cut running loops.** Over budget (more than 10% above), a permitted use that
  excludes the business, no early exit with a term over 36 months, and a landlord who may raise the rent without a
  limit reject the candidate with a source (`src/domain/hard-flags.ts`, `src/domain/lease.ts`). The first hard flag
  wins, and every loop still working on that candidate stops at its next breakpoint, before the next model call.
- **Ranked by the worst case.** Missing data never inflates a score: an unknown part counts as 0 for the low end and
  full for the high end, the score is shown as a range ("74-94"), and the rank uses the low end. A space with no
  stated rent is never first. The rank goes by verdict first (Good, then Check before signing, then the rest) and by
  the low end inside each verdict, so the best option never has a weaker verdict than another candidate. Confidence says why ("no lease draft: up to 20 points unknown")
  (`src/domain/ranking.ts`).
- **The verdict is code.** Good needs 70 or more in the worst case, high confidence and nothing to check; a space
  outside the required area range is never Good (`src/domain/verdict.ts`). The weights and rules are on the
  How it works page, served from the code itself so the page cannot drift.
- **More answers on each space page, all code figures with sources:**
  - *Rent share of revenue*: the monthly cost as a share of the expected revenue from the questionnaire; above 15%
    it is a point to check (a SuiteSpot assumption, labelled as one, never a rejection) (`rentShareOf` in
    `src/domain/ranking.ts`).
  - *Noise vs land use*: for noisy work (a cafe, a workshop) code reads the OpenStreetMap land use around the address;
    dense housing nearby is a point to check about neighbours (`noiseCheck` in `src/domain/location.ts`, data
    `fixtures/osm/seed-areas.json`, © OpenStreetMap contributors, ODbL).
  - *A bad year, a good year*: what leaving after 12 months would cost (from the lease's own exit terms), and when
    the money put in comes back in a normal year (from the Finance analyst's calculator figures only).
  - *Lease or buy*: rent over the planned stay against buying a similar space with a bank loan. Prices per m2 from
    RGZ (first half of 2026), the loan rate from NBS (August 2026), the transfer and property tax from the Law on
    property taxes; down payment 30%, 10 years, fees 2%, maintenance 1% and a 3% return on cash are SuiteSpot
    assumptions, labelled as such (`src/domain/lease-or-buy.ts`).
- **The report is audited by code.** The Report writer gets numbered facts written by code and must cite them in
  every sentence. The Auditor checks each number, candidate id and recommendation against the cited facts and the
  ranking; one rewrite, then failing sentences are removed and marked (`src/domain/report.ts`,
  `src/application/agents/auditor.ts`).
- **Not financial or legal advice** is shown on every result screen, in the report and here. SuiteSpot never says
  whether to sign and never gives a legal verdict on permitted use; it lists what to check before signing.

## Evidence: ten real-model evaluations
Before recording the demo we ran ten outside listings through the live model (`scripts/eval-scenarios.ts`), each
built to test one rule. The first pass found two wrong verdicts (a space with no lease draft rated Good with high
confidence; a 140 m2 space rated Good for a business that needs 40 to 90 m2). Both were fixed in code, with tests.
Second pass:

| # | Scenario | Expected | Score (confidence), verdict | Hard flags | Concerns |
|---|---|---|---|---|---|
| 1 | Cafe Novi Sad, good lease | good, top score | 96 (high), Good | - | - |
| 2 | Cafe Novi Sad, over budget | budget hard flag | rejected, Not recommended | monthly_cost_over_budget | - |
| 3 | Cafe Novi Sad, office use only | permitted use hard flag | rejected, Not recommended | permitted_use_excludes_business | - |
| 4 | Cafe Novi Sad, locked in, landlord raises rent | no exit, unlimited increase | rejected, Not recommended | locked_in_without_exit, unlimited_rent_increase | - |
| 5 | Cafe Novi Sad, no lease draft | lower confidence | 92 (medium), Check before signing | - | - |
| 6 | Office Beograd, good | good | 85 (high), Good | - | - |
| 7 | Office Beograd, harsh lease | guarantee, penalty, structural, 8% a year | 66 (high), Check before signing | - | personal guarantee, tenant pays structural repairs, long notice, high indexation, early exit penalty |
| 8 | Shop Novi Sad, good | good | 84 (high), Good | - | - |
| 9 | Shop Novi Sad, too big | area outside the range | 73 (high), Check before signing | - | - |
| 10 | Workshop Beograd, vague lease | missing data, low confidence | 64-84 (medium), Check before signing | - | - |

All ten verdicts are right. Details, including the first report sentence of each run, are in `PROGRESS.md` ("P4
quality check").

## What is real, recorded and scripted
| Part | Status |
|---|---|
| Mozaik runtime, concurrency, interception, shared state | Real, in every mode |
| Domain rules, calculations, hard flags, ranking, verdict, audit | Real code, in every mode |
| Model answers with a key | Real: claude-haiku-4-5, live |
| Model answers without a key, Find spaces | **Recorded**: three real claude-haiku-4-5 runs (`fixtures/recordings/*.json`, recorded 27 Nov 2026: 23, 27 and 21 model calls) replayed with their latencies; code still checks every value. A request that is not in the recording fails as a provider error, it is never invented. Not labelled on screen (stated here) |
| Model answers without a key, every other run (Find spaces with your own questionnaire, "Evaluate for my business" on any listing, an outside listing) | **Scripted**: the agents follow fixed scripts (the calculator calls, the Lease reader's answers for the seed drafts built from the seed's own clause sentences); every number still comes from the calculator and code still checks every quote. A lease draft that is not in the seed is not read without a key (its terms come from the listing form), and the area data of an address outside the seed is not looked up. Not labelled on screen (stated here) |
| Listings, landlords, contacts, businesses | **Synthetic**: 100 generated listings (50 Novi Sad, 50 Beograd) from a frozen seed (stated in this README and on the How it works page). The seed listings have no photos (a plain tile stands in, never a stock photo); photos come only from owners who upload them. Prices per m2 are a synthetic assumption roughly aligned with public 2025-2026 ranges (Kurir Biznis, Biznis.rs): medians Novi Sad 10, Beograd 16.2 EUR/m2 |
| Accounts, saved spaces, view counts | Real: Supabase Auth with Supabase, local accounts on this computer without it |
| Area data (OpenStreetMap) | Real public data: counted once for the seeded addresses and stored in `fixtures/osm/` (© OpenStreetMap contributors, ODbL); an outside listing is looked up live (at most 1 request per second) |
| Offers, leases, rent schedule | Real code and storage (Supabase or local); on a seeded listing, which has no real owner, the tenant answers the offer |
| Rent payments | **Simulated** without Stripe keys (no card, nothing charged); **Stripe test mode** with test keys (the online version uses an anonymous Stripe test sandbox, tested end to end on 27 Nov 2026: Checkout, test card, the month marked paid with the `cs_test_` session as its reference). Never real money |
| Signing a lease, contacting landlords | Not built |

## Architecture and code map
Domain-driven layers; the domain never imports from adapters (checked by `tests/architecture.test.ts`).

```
src/domain/        entities, value objects, rules, typed domain errors (no I/O, no model)
src/application/   agents (participants), situation handlers, interception, shared state, the research session
src/adapters/      server (Fastify + SSE), inference runners (live, recorded, scripted), storage, Supabase auth, seed
web/               React + Vite + Tailwind front end, styled by DESIGN.md
fixtures/          locked demo questionnaires and the recorded runs
supabase/          migrations and RLS checks
```

Production build: `npm run build`, then `npm start` (one process serves the web app and the API on `PORT`).

## Tests
```powershell
npm test
```
```powershell
npm run typecheck
```
284 tests in 38 files, no key and no network needed (`tests/setup.ts` turns Mozaik Cloud off and blocks any request
to another host): every domain rule and invariant (with the violation it rejects), the schema
rules for every structured output, cancellation mid-run, a failing agent that does not stop the others, the server
and its cost guards, the three recorded scenarios replayed end to end to an audited report, the run animation
replayed against the real bus events of those recordings (every dot is a real loop), the onboarding and role rules,
the business profile form against the domain, Find spaces with preferred districts (a preference that never filters), editing the account (name, email, a profile photo checked by type, size and magic bytes), listing photos (at most six, safe addresses only, upload, storage and display), the frozen seed, and the full deal loop over HTTP (offer, accept, lease,
simulated payment, status on both sides, leased spaces, someone else's offer or rent refused; the Stripe test gateway
against a fake fetch, test keys only).

## Known limitations
- Without a key, only the three example businesses replay real model runs; your own questionnaire, your own listings
  and outside listings run with scripted agents, which do not read a lease draft outside the seed or look up the area
  of a new address.
- A recording matches the agent instructions it was made with; after changing an instruction it must be re-recorded
  (`npm run record:demo`), and `tests/recorded-demo.test.ts` fails until it is.
- Code removes phone numbers and emails from pasted listing text but cannot reliably detect a person's name; the
  Scout has no field for names. Do not paste text with private details.
- A Stripe test sandbox made without an account lasts 7 days; we make a new one and swap the keys on the online
  version before it expires. Without Stripe keys the simulated checkout is used.
- Not built: an inspection of the premises on site, signing a lease, messages between users, a real payment
  processor (Stripe does not support businesses registered in Serbia; production would use a local processor
  behind the same payment port). Only EUR and the two seeded cities are covered by the demo data.
- OpenStreetMap counts what is mapped, not foot traffic or revenue; the Location analyst says so and never estimates
  them.
- Lease or buy is a rough comparison with labelled assumptions (no price change, no VAT on a new building), not a
  valuation.
- `RequireLandlord` and `auth.landlord` keep old names in code (the UI texts are neutral).

## Troubleshooting
| Problem | Fix |
|---|---|
| `npm run dev` says port 3000 is in use, or the page says "The SuiteSpot server is not answering" | Another program uses port 3000. Close it and run `npm run dev` again. |
| Vite opens on 5174 instead of 5173 | Port 5173 was taken; open the address Vite prints. |
| `node -v` shows 20 or lower | Install Node.js 22 LTS or newer from nodejs.org. |
| Find spaces shows example businesses | Expected without a key (pick "Your business" for your own questionnaire). Add `ANTHROPIC_API_KEY` to `.env` and restart for live runs. |
| A live run answers 429 | One live run at a time per server; wait for it to finish. |
| `npm install` warns that install scripts were skipped (npm 11) | Nothing to do: tested on a fresh clone with npm 11.20 and Node 26 (install, tests, build and the keyless demo all work). If `npm run dev` ever fails with an esbuild error, run `npm rebuild esbuild`. |
| Signing up asks for an email confirmation (Supabase) | Turn off "Confirm email" in Supabase Auth, or use the local accounts (leave SUPABASE_* empty). |

## Credits
- Team **Scope**: Aleksa Ćupina and Andrej Gajić.
- Built on [`@mozaik-ai/core`](https://www.npmjs.com/package/@mozaik-ai/core) 6.0.0 by JigJoy; traces in Mozaik
  Cloud.
- Model: Anthropic claude-haiku-4-5.
- Fastify, React, Vite, Tailwind CSS, Supabase, Vitest, playwright-core (screenshots). Font: Hanken Grotesk (SIL Open
  Font License 1.1). Icons: lucide (ISC).
- All data is synthetic. Not financial or legal advice.
