# PROGRESS - SuiteSpot

Read this at the start of every session. Update it before every push. Newest entries at the top.
No long dashes in this file; use a plain hyphen.

## Listing sites: terms of use and robots.txt (read 26 Nov 2026, ~15:00, Aleksa + Claude)
Only the terms pages, robots.txt, llms.txt / AI info pages and the home page (to find the terms link) were read. No
listings were downloaded. Read with `User-Agent: SuiteSpot/0.1 (hackathon; +repo URL)`, 2 s between requests.
This is our reading of the texts, not legal advice.

| Site | Automated reading | Exact text (source) | robots.txt for listing pages |
|---|---|---|---|
| 4zida.rs | **Forbidden by the letter of the terms** (broad wording), but its llms.txt invites AI assistants to fetch live pages. Contradictory signals; the safe reading is "forbidden". | Terms 12.2 (prohibited activities): "bilo koje automatsko korišćenje sistema, kao što je, ali ne ograničavajući se na korišćenje skripti za slanje fotografija, ili video zapisa" and footer: "Sadržaj sajta je vlasništvo 4zida.rs. Zabranjeno je njegovo preuzimanje bez dozvole 4zida.rs, zarad komercijalne upotrebe ili u druge svrhe, osim za lične potrebe posetilaca sajta." Also 7.1: unauthorized copying of the service, incl. its databases, is an IP violation. Source: https://www.4zida.rs/pravila-i-uslovi-koriscenja (published 24.08.2026, in force 02.09.2026). Counter-signal: https://www.4zida.rs/llms.txt says "uvek preuzmi aktuelnu stranicu umesto keširane vrednosti" and documents the listing URL pattern. | Allowed for `*`. Disallowed: `*/favourites*`, `*/stampaj`, `*/replacement*`, `/agenti/*`, two calculators. No AI-specific rules. https://www.4zida.rs/robots.txt |
| oglasi.rs | **Unclear.** No clause about bots or scraping. Copying content needs prior written approval. Its AI info page expects AI assistants to answer about specific listings. | Terms 4 "Kopiranje": "Kopiranje i/ili dopuna celog ili dela sadržaja, pogotovo u komercijalne ili reklamne svrhe, zahteva prethodno pismeno odobrenje". Source: https://www.oglasi.rs/pravila. AI page: https://www.oglasi.rs/llm-info (updated Aug 2026) tells assistants, for a specific listing, to separate the advertiser's claims from the site's and to check the current listing. | Allowed for `*`. Disallowed: `/oglasi?q=*` (site search), `/oglasi?o=*`, `/korisnici/moj-nalog*`. So the Scout must never use the site's own search URLs. https://www.oglasi.rs/robots.txt |
| svenekretnine.com | **Unclear, closest to allowed for reading.** No clause about bots. It forbids unauthorized taking of listings, listing text or photos (written for users who repost ads; the stated sanction is removing the ad). The site is itself an aggregator. | "Svako neovlašćeno preuzimanje oglasa, teksta oglasa ili fotografija oglasa drugih korisnika portala, kao i bilo koje neovlašćeno oglašavanje nepokretnosti smatraće se kršenjem pravila korišćenja". Source: https://www.svenekretnine.com/uslovi-koriscenja | Allowed for `*`. Disallowed: `/visitcount/`, `/sacuvaj-oglas/`, `/phone-clicked/`, `/log-time-on-ad`. https://www.svenekretnine.com/robots.txt |

**Side finding (affects the plan):** plan section 4.5 says we commit "one recorded real research run" as fixtures to the
public repo. That republishes listing content, which all three sites restrict ("preuzimanje", "kopiranje"). If we
keep a recorded run, it should hold only URLs and the few facts we extract (price, m2, floor), never listing text or
photos, or be replaced by synthetic data.

**Options (decided 26 Nov: option D with mode A taking 1 to 8 pasted listings, see "Decisions log")**
- **A. Live search only on sites that do not forbid it** (oglasi.rs, svenekretnine.com; 4zida.rs dropped).
  Pro: real listings in the demo, real "Useful" story. Con: we lose the site with the best data (4zida.rs); the other
  two are "unclear", not "allowed"; copying clauses still apply to what we store.
- **B. Live search only through Anthropic web_search results, no page fetch on forbidding sites.**
  Pro: we never access a forbidding site ourselves. Con: breaks our own rule "always open the listing page, never the
  snippet" (tested: snippet 1,800 EUR vs page 1,400 EUR), so numbers become unreliable; it reads like working around
  the terms through a third party.
- **C. Demo mode only (synthetic listings), no live search.**
  Pro: zero terms risk, deterministic, it is what the judges run anyway. Con: no real data; "Useful" is weaker; the
  "recorded real run" disappears.
- **D. (Claude's proposal) C as the default + live mode A for the user's own listing + ask for permission.**
  The user pastes the listing text or uploads it (mode A already exists in the plan), so no automated reading of any
  site happens; the Scout runs on synthetic fixtures. In parallel, email the three sites for written permission for a
  non-commercial hackathon demo; if one says yes, enable live search for that site only.
  Pro: honest, safe, keeps a real-data path, a strong "we read the terms and respected them" point for the README.
  Con: mode B is not live; a permission reply may not arrive before Fri midnight; the user does more work in mode A.

## Shift handover: Andrej -> Aleksa (26 Nov 2026, 15:05)
**Done so far**
- Plan step 1, sub-steps 1-5: skeleton, resilience (mock runner, retries, failure isolation), domain model with tests,
  hard-flag cancellation spike, real Anthropic web search and web fetch check. Details under "Current state".
- Listing site test on single listing pages: 4zida.rs is the main source, oglasi.rs and svenekretnine.com are extras;
  halooglasi.com and nekretnine.rs are out (table below). `scripts/check-listing-fetch.ts` now uses the honest
  User-Agent but was not re-run with it.
- Two design concepts, 4 target screens each (live research, report, questionnaire, history), with the same synthetic
  content in both so they compare fairly:
  - `design/concepts/era/` (Era pack, deep green #1F5C45 as the only accent)
  - `design/concepts/spade/` (Spade pack chosen by Aleksa, lime #B2EB76, 4px grid, no shadows)
  - Source: `design/concepts/src/mock.html`; re-render with `node design/concepts/src/render.mjs` (needs Chrome or
    Edge; loads free substitute fonts from Google Fonts). Mockups only, not app code.
  - Shared status rules in both: red = hard flag, yellow = soft flag and "check before signing", grey with a dashed
    border = estimate. Every number carries a source label (listing, profile, osm, calc, est).
- 47 tests pass (`npm test`).

**Design**
- Design direction chosen: see DESIGN.md (Era and Spade concepts are superseded). `design/concepts/` stays in the
  repo as history. The app is not styled yet; the design pass follows DESIGN.md.

**Aleksa's next step: plan step 2 (thin slice in demo mode)**
1. DONE: terms of use read, option D chosen (table at the top, "Decisions log").
2. DONE (26 Nov): Scout. See "Current state", step 2.2.
3. NEXT: Finance analyst and Lease reader on 3 candidates, in parallel, in demo mode (MockRunner scripts). Finance calls the
   calculator in `src/domain/lease-cost.ts` through tools; it never computes numbers itself. Every finding goes through
   `SuiteSpotState.addFinding`, which rejects a value without a source.
4. Events to the first live research screen: a Fastify SSE endpoint that streams bus events (loop events plus our
   domain events `candidate.found`, `candidate.rejected`, `candidate.flag_recorded`, `agent.halted` and findings).
   Build the screen FUNCTIONAL with a neutral style (plain Tailwind, greys): agent lanes, candidate cards with status,
   and the findings and flags stream. Structure can follow the concept images; the look comes after the pick.
5. One keyless end-to-end demo test that must pass before every push.

**Watch out for**
- Mozaik 6.0.0 rules (all in CLAUDE.md): never `await` `runLoop` or `sendMessage` inside a processor; one fresh context
  per loop (use `rt.startLoop`); only the first tool call of an inference runs, so every instruction says "one tool per
  turn" and tools take batches; never return `idle` from interception; wrap every handler in `safeHandler`;
  `sendEvent` needs a real participant id as producer.
- Use `structuredOutput` wherever code consumes an agent's answer, and validate it before it changes state.
- Cancellation already exists: wrap per-candidate tools in `cancellableTool`, pass `CandidateCancellation` to each
  evaluator loop, and reject only through `rejectCandidate`.
- Gross margin is optional: break-even and payback return `MissingData`; show "missing data", never a number.
- Data: synthetic or public only; never store phone numbers, emails or agent names from listings.
- Show "Not financial advice" on the report; never a legal verdict on permitted use, only "check before signing".
- No long dashes anywhere. Never print or commit `.env` or keys. Update this file and run `npm test` before every push.

**Open questions**
- Fixed questionnaire instead of an Interviewer agent? For now `fixtures/requirements/demo.json` is the profile and
  the requirements; the Interviewer (follow-up questions, requirements list) is not built.
- Design direction chosen: see DESIGN.md (Era and Spade concepts are superseded). Next: the design pass.
- Terms of use read; option D chosen (see "Decisions log"). Permission emails to the three sites: drafted, Aleksa
  sends them. Waiting for replies.
- The honest User-Agent may be blocked more often than in the earlier test; re-run `npm run check:listings`.
- Railway datacenter IPs may be blocked by listing sites; test live mode from the deployed service.

## Current state
- **Step 2.4 (SSE + Live research screen) done: server part (595a007) and web part committed and pushed.
  Next: the Ranker (scores for the Scored group), then Reports.**
  - Web (`web/src/`): `App.tsx` (sidebar, header with breadcrumb, Demo data pill only for synthetic runs, agent
    stack + "N busy, peak M" from events, search, black "New research"; tabs; SSE client with reconnect-safe
    reducer; `?autorun=demo&tab=timeline` for screenshots), `LiveResearch.tsx` (sections Pending / Evaluating /
    Check before signing / Scored / Rejected with count circles, all open; table with fixed columns: candidate,
    monthly cost, rent share, exit cost, flags, agents, score; cards view; Rejected rows with reason, source label,
    raised by, cancelled agents and how long they worked; metrics strip from `research.done`), `Timeline.tsx` (lanes
    per loop grouped by agent, calculator-call dots and waiting segments, red x where a loop was cut, dashed line
    per rejection, now line, peak pill), `NewResearch.tsx` (Run demo; paste 1 to 8 listings with optional lease,
    enabled only when the server is in live mode). Footer: "Not financial or legal advice".
  - "Scored" shows "not scored yet" until the Ranker exists (next step). "Check before signing" also holds finished
    candidates with missing rent or area, unverified fields, or no lease draft (terms unknown).
  - Dev: `npm run dev` (API on :3000 via `--port 3000`, web on :5173). `npm run screenshots` (needs `npm run dev`
    running; Edge via playwright-core) writes `design/screenshots/*.png`. `.claude/launch.json` starts the dev servers.
  - Previous notes:
  - DONE, tested (`tests/server.test.ts`, 4 tests pass): `src/application/research/wire.ts` (whitelisted DTOs, no
    contexts or prompts), `src/application/research/research-session.ts` (one runtime per research, wire tap,
    metrics from events, secrets scrubbed), `src/adapters/server/research-routes.ts`: `POST /api/research`
    (`{source: "demo"}` = 8 fixture listings + 3 leases; `{mode: "live", source: "pasted", listings: [{text, lease?}]}`),
    `GET /api/research/:id/events` (SSE, id = seq, Last-Event-ID resume, ends after `research.done`),
    `GET /api/research/:id`, `GET /api/config`. Cost guard: 1 to 8 listings (domain), max 1 active live research
    (429), live only when SUITESPOT_MODE=live (403 otherwise). Demo pacing `DEMO_PACE` (about 5 s per run).
  - Installed pinned dev deps: `lucide-react@1.72.0`, `playwright-core@1.65.0` (use installed Edge, channel "msedge").
  - Web, partly written: `web/src/index.css` (DESIGN.md tokens, gradient, busy ring with reduced motion),
    `web/src/types.ts`, `web/src/research-state.ts` (reducer from wire events, groups, lease note), `web/src/ui.tsx`
    (SourceLabel, Sourced, Pill, AgentChip, CountCircle). `web/src/App.tsx` is still the old placeholder.
  - TODO next: `App.tsx` shell (sidebar: New research, Live research, Reports, History, Assumptions; header with
    breadcrumb, Demo data pill, agent stack + "N busy, peak M" from `state.busy/peak`, black "New research");
    tabs Cards / Table / Timeline; section cards per `groupOf` with count circles (Rejected open, with reason,
    source, cancelled agent chips and "stopped N loops in X ms" from `rejections` + `loops[].cancelledAt`);
    Timeline (lanes per loop grouped by agent, tool dots, red cancel marker, rejection line, now line, peak pill);
    New research screen (Run demo + paste 1 to 8 texts, live only when `/api/config` says so); footer
    "Not financial or legal advice"; then a Playwright script for screenshots (Table and Timeline, mid-run and end).
  - Open UI decision: no Ranker yet, so the "Scored" group has no score; show "not scored yet".
- Step 2.3 (Finance analyst + Lease reader in parallel) built on 26 Nov 2026, 85 tests pass, typecheck clean.
  Committed and pushed after Aleksa's OK.
  - Fixtures: `fixtures/requirements/demo.json` (fixed demo questionnaire: cafe, 50-90 m2, budget 1,500 EUR, revenue
    9,000 EUR, 36 months; gross margin left out on purpose), `fixtures/leases/lease-demo-01|04|07.txt` (SYNTHETIC:
    clean / soft flags / hard flag), scripted answers `fixtures/mock-answers/lease-reader.json`.
  - Domain: `quoted-extraction.ts` (shared quote rules for listings and leases; `buildListing` now uses it),
    `lease.ts` (`LEASE_FIELDS`, `buildLease`, `evaluateLease`: code decides hard flags `locked_in_without_exit`,
    `unlimited_rent_increase` and soft concerns), `lease-terms.ts` (calculator inputs from listing + lease + profile),
    `number-check.ts` (`unsourcedNumbers`: an explanation may only contain numbers the code gave the agent).
  - Application: `agents/finance-analyst.ts` (tool `calculate` runs the domain calculator; term-level calculations
    wait for the Lease reader through shared state; budget hard flag decided by code; explanation with an unsourced
    number is sent back once), `agents/lease-reader.ts`, `agents/quoted-schema.ts` (shared schema builder). Runtime
    has a loop tracker (loop status from events); `candidate.rejected` carries `cancelledLoops`; new event
    `loop.cancelled` (where the loop was cut). Other new events: `lease.read`, `lease.extraction_rejected`,
    `lease.failed`, `finance.explained`, `finance.explanation_rejected`, `finance.failed`.
  - `src/adapters/inference/live-runner.ts`: Mozaik runner with `disable_parallel_tool_use` for Anthropic.
  - `npm run demo:evaluate` (mock, demo-01/04/07) and `npm run demo:evaluate -- --live` (haiku-4-5, demo-07).
  - Mock run: demo-07's Finance loop is cut mid tool call (while waiting for the lease) at 124 ms; demo-01 and
    demo-04 finish; 9 loops, peak 6 in parallel, 1 rejection, 1 cancelled loop, 3 soft flags.
  - **First live problem (fixed):** the Lease reader computed the deposit ("jedna mesečna zakupnina" -> 1050) and on
    retry stitched two sentences into one quote; the whole lease failed, so no hard flag. Fixes (Aleksa's decision):
    - Partial acceptance on the last attempt (Scout and Lease reader): verified fields stay, a failing field becomes
      MissingData marked `unverified` (+ a soft "check before signing" concern for leases, `Listing.unverified` and
      `candidate.found.unverified` for listings). Only invalid JSON or a provider error goes to the failed queue.
    - Amounts as months of rent: the model answers `{monthsOfRent: N, quote}` (digit or Serbian word in the quote);
      code computes the amount from the sourced rent (`amountFromRentMultiple`, source calc with both quotes).
    - A quote may have up to 3 parts joined with " ... "; code checks every part against the text.
    - Finance: when the lease is not verified (or has no verified term), term-level figures say "lease not verified:
      term from the questionnaire", carry profile sources only, and get a check-before-signing note.
  - **Learned limit:** quotes as JSON arrays in every field made the API reject the schema ("The compiled grammar is
    too large", 400, no cost). Quotes are one string again; parts are split by code. schema-rules test checks it.
  - **Live check after the fixes (claude-haiku-4-5, demo-07, 3 runs):** hard flag raised 3/3, Finance cut 3/3 (ran
    7.4 s, 4.5 s and 5.5 s before the cut; twice mid tool call, once before its next tool call), 0 rejected
    extractions, deposit reported as 1 month of rent each time; about $0.013 per run ($0.040 for 3 runs, plus 3
    failed schema runs at $0).
  - Known limit: when the flag lands during a model call, that call finishes and is paid for (Mozaik cannot abort an
    in-flight inference); its answer is replaced.
  - Known limit: the quote part separator " ... " breaks when the listing or lease text itself contains "..." (or
    the ellipsis character): a real quote with "..." is split into parts at that point. Each part must still appear
    in the text, so nothing unverified gets in, but a valid quote may be rejected (the field then becomes
    unverified MissingData).
- Step 2.2 (Scout) done on 26 Nov 2026, 65 tests pass (`npm test`), typecheck clean. Committed and pushed.
  - `fixtures/listings/demo-01..08.txt`: 8 SYNTHETIC raw-text listings for Novi Sad, different styles, each starting
    with "SYNTHETIC DEMO DATA", no contacts. demo-02 = hard flag (3,200 EUR rent), demo-04 = soft flag (private vs
    shared parking), demo-03 = no area, demo-08 = no rent ("Cena na upit"). What each is for: `fixtures/listings/README.md`.
  - `fixtures/mock-answers/scout.json`: the scripted structured answers the MockRunner replays in demo mode.
  - Domain: `listing-text.ts` (`createListingBatch` enforces 1 to 8 listings and removes phones and emails with
    `redactContacts` before anything is stored; only counts are kept), `listing-extraction.ts` (`Listing` with
    `Field<T> = Sourced<T> | MissingData`, `buildListing` checks every value: quote required, quote must appear in the
    text, a number must appear in its own quote; all problems in one DomainError), `missing.ts` (MissingData moved here
    from lease-cost). `SourceRef` has an optional `quote`; a listing source is a text id (`pasted-<n>`, `demo-<id>`,
    quote required) or a URL. `Listing` changed shape (no `url`, `description`, `updatedAt`; `ref` + `text` instead).
  - Application: `src/application/agents/scout.ts`. `submitListings(rt, inputs, producerId)` is the single entry for
    demo fixtures and pasted texts: state stores cleaned texts, then the domain event `listings.submitted`. The Scout
    wakes on it and starts one loop per listing in parallel with `structuredOutput` (`LISTING_EXTRACTION_SCHEMA`), no
    tools. On each loop's `model.answer` plain code runs `buildListing`; a valid listing becomes a Candidate and
    `candidate.found` is published at once. A rejected extraction is sent back once as feedback
    (`listing.extraction_rejected`), a second failure goes to `state.failedListings` (`listing.extraction_failed`).
  - Adapters: `src/adapters/fixtures/demo-listings.ts` (loads fixtures), `src/adapters/inference/scripts/scout-script.ts`
    (demo script, optional per-listing latency).
  - Tests: `tests/listing.test.ts` (contact removal, batch size, quotes, number formats, value without source,
    all scripted answers pass), `tests/scout.test.ts` (8 loops in parallel and candidates published in finishing
    order, MissingData for the listing without area, contacts never reach state, model or bus, retry with feedback,
    failed queue does not affect other listings).
  - New domain events: `listings.submitted`, `listing.extraction_rejected`, `listing.extraction_failed`.
  - Known limits: agents' names in pasted text are not detected by code (the Scout schema has no field for them and
    the instruction forbids them, but the cleaned text can still contain a name; stated in README "Known
    limitations"). The Scout wakes on `listings.submitted` (plan section 7 updated): extraction does not need the
    requirements, so it runs in parallel with the Interviewer.
  - **Live check with claude-haiku-4-5 (26 Nov, `npm run demo:scout -- --live`, demo-01 + demo-03):** both listings
    extracted correctly on the first attempt, in parallel, 9.2 s total, 5,696 input + 538 output tokens (about
    $0.008 at $1/$5 per MTok). Values are copied as written in the text ("novi sad", "grbavici"), which is fine: the
    quote is the source and display formatting is a UI concern.
  - **Structured output rules (Anthropic docs, read 26 Nov):** no `oneOf`, `not`, numeric or string length limits,
    `minItems` only 0 or 1, `additionalProperties: false` on every object, `anyOf` not next to `type`, at most 16
    union-typed parameters (anyOf or type arrays) and 24 optional parameters per request; and from our own 400:
    no `enum` next to a type array. The first Scout schema broke two rules (enum + type array, and 26 union
    parameters). Fixed: each field is `anyOf [{found: true, value, quote}, {found: false}]` (11 unions, 0 optional).
    `src/application/agents/schema-rules.ts` checks every exported agent schema in `tests/schema-rules.test.ts`
    (new agents are picked up automatically).
  - A provider error ("Inference failed: ...") now fails the listing at once with "Provider error: <reason>" instead
    of a retry with misleading "not valid JSON" feedback.
  - `npm run demo:scout` (mock, 8 listings) and `npm run demo:scout -- --live [--ids demo-01,demo-03]` print the event
    timeline, the fields with source quotes and run metrics computed from events.
- Step 1 (skeleton) done: one root `package.json`, `@mozaik-ai/core` pinned to 6.0.0, Fastify server
  (`src/adapters/server/`, `/api/health`, serves `web/dist` in production), Vite + React + Tailwind 4 web app in `web/`,
  Vitest. Mode is `SUITESPOT_MODE` (default `demo`; `live` also needs `ANTHROPIC_API_KEY`).
- Commands (PowerShell): `npm install`, `npm run dev` (server :3000 + web :5173), `npm test`, `npm run build`, `npm start`.

- Step 2 (resilience) done: `MockRunner` (keyless, scripted, latency), `ResilientRunner` (retry with backoff, no retry on
  4xx except 408/409/429, then answers "Inference failed: ..." and emits `agent.halted`), `Semaphore` (max parallel
  model calls, records peak), `safeHandler` (guards specification and processor), `installProcessGuards`,
  `createAppRuntime` + `startLoop` (one fresh context per loop, maps contexts and loopIds to agent and candidate),
  `createRecorder` observer. Test `tests/resilience.test.ts` proves one broken agent and one throwing observer do not
  stop the others, and that 3 loops of 200 ms finish together.

- Step 3 (domain) done in `src/domain/` (no I/O, no Mozaik): `Money` (cents), `AreaM2`, `SourceRef`/`Sourced<T>`
  (+ `validateSource`, `calc`), `BusinessProfile`, `Requirement`, `Finding` (no source -> `DomainError`),
  `Candidate` (status machine, idempotent `reject`, `AbortSignal` fired on rejection), lease cost calculator
  (monthly, initial, total over term with indexation, exit after 12 months, cost share, break-even, payback, fair price
  with interquartile range and min 3 comparables), hard-flag rules. `SuiteSpotState` holds candidates and findings and
  validates every write. 36 domain tests + 2 layering tests.

- Step 4 (cancellation spike) WORKS on 6.0.0. `src/application/cancellation/candidate-cancellation.ts`:
  `CandidateCancellation` (InterceptionHandler per loop) rewrites the next step of a rejected candidate's loop into a
  final `model_message` "stopped: ..." (no extra model call, no idle); `cancellableTool` settles a running tool at once
  with "Aborted mid-call" and aborts its I/O through an AbortSignal; `rejectCandidate` is the single entry point (state
  rule + `candidate.rejected` event). The agent that raised the flag is never stopped by it.
  `tests/cancellation.test.ts` (run with `SPIKE_REPORT=1` to print the timeline): 8 loops in parallel, c1 rejected at
  ~85 ms; Lease (mid 2 s tool call) stopped at ~86 ms with no second model call; Location (between steps) stopped at
  ~117 ms after 1 of 5 lookups; Premises (mid inference) answer replaced at ~303 ms; c2 untouched.

- Step 5 (real Anthropic check, `npm run check:anthropic`, about $0.035 total) done on 26 Nov 2026:
  - `claude-haiku-4-5` answers for our key (resolves to `claude-haiku-4-5-20251001`). Models API says:
    `server_tools.web_search` yes, `structured_outputs` yes, `effort` no, adaptive thinking no.
  - Web search `web_search_20250305` WORKS (10 results for "poslovni prostor izdavanje Novi Sad": nekretnine.rs,
    halooglasi.com). `user_location` with country `RS` is REJECTED with a 400 ("Country code RS is not supported"):
    put the city in the query instead.
  - Web fetch `web_fetch_20250910` (sent with beta header `web-fetch-2025-09-10`) WORKS on haiku-4-5.

- Listing fetch test on SINGLE listing pages (`npm run check:listings -- <urls>`, 26 Nov 2026, about $0.12 total):
  | Site | Anthropic web_fetch | Plain HTTP GET (Node fetch) | Notes |
  |---|---|---|---|
  | halooglasi.com | 0/3 (`url_not_accessible`) | 0/3 (403) | robots.txt DISALLOWS ClaudeBot and anthropic-ai; Content-Signal ai-train=no, no ai-input. Do not use, do not work around it. |
  | nekretnine.rs | not testable | not testable | 403 for every automated client (index pages too), so no listing URLs could be collected. |
  | 4zida.rs | 2/2 page read, but price/area only in the title (body rendered by JS) | 2/2 PASS | No AI rule in robots.txt. Best data via plain GET. |
  | oglasi.rs | 1/2 PASS | 1/2 PASS | The other listing genuinely has no price on the page (stays null). No AI rule in robots.txt. |
  | svenekretnine.com | 1/1 PASS | 1/1 PASS | Aggregator. No AI rule in robots.txt. |
- Gross margin is optional: without it `breakEvenRevenue` and `paybackMonths` return `MissingData` ("missing data"),
  never a number. 47 tests pass.
- CLAUDE.md now has the exact Mozaik event names, the "only the first tool call runs" rule and how to design tools
  for it.

## Next step
- Aleksa: plan step 2 (see the shift handover at the top). Design direction chosen: see DESIGN.md (Era and Spade
  concepts are superseded).
- **Aleksa, before building the Scout (rules also in CLAUDE.md, "Listing sources"):**
  1. Read the terms of use of 4zida.rs, oglasi.rs and svenekretnine.com. If a site forbids automated reading, drop
     it. Write the result here (site, terms URL, date, verdict).
  2. Plain HTTP reads use an honest `User-Agent: SuiteSpot/0.1 (hackathon)` with the repo URL, never a browser or
     search engine identity; at most one request per 2 seconds per site; respect robots.txt; skip blocked pages.
     `scripts/check-listing-fetch.ts` now sends the honest User-Agent (not re-run yet). An honest UA may be blocked
     more often than the earlier browser UA; re-run the test before relying on the old numbers.
  3. `web_search` always with `allowed_domains` = the approved sites.
  - Then: plain HTTP GET first, Anthropic web_fetch only as fallback; check the page is the listing we asked for.

## Open problems
- Web search returns INDEX pages; the Scout needs a second hop (index page -> listing URLs -> each listing).
- Terms of use of 4zida.rs / oglasi.rs / svenekretnine.com read on 26 Nov (table at the top). 4zida.rs forbids
  automated use by the letter of its terms; the other two are unclear. Option D chosen: no automated reading of
  listing sites unless a site gives written permission.
- Fetch was tested from a home connection. Railway runs on datacenter IPs and may be blocked more often; test live
  mode from the deployed service.
- A model call already in flight cannot be aborted (InferenceRunner has no signal); we pay for it and replace its
  answer. At most one call per stopped loop.
- Mozaik sends no `disable_parallel_tool_use`; add the custom AnthropicMessages mapper in live mode (see CLAUDE.md).

## Decisions log
- 2026-11-26: Design direction chosen: see DESIGN.md (Era and Spade concepts are superseded). Aleksa picked the style
  and layout of a soft project-management UI from reference shots (style only: no name, logo or people photos).
  Hanken Grotesk (OFL 1.1), purple #6A3FD3 as brand, ink #0B0B0F, pink-to-lilac gradient; red only for hard flags,
  amber only for soft flags, dashed grey only for estimates. Contrast checked to WCAG AA. `design/concepts/` is kept.
- 2026-11-26: listing sources = option D with one change (Aleksa, after reading the terms of use, table at the top).
  - Mode A takes 1 to 8 listings at once. The user pastes the TEXT of each listing they are considering; each one
    becomes a candidate. So real data also has volume: candidates are evaluated in parallel, a hard flag cancels a
    candidate mid-run, the Ranker compares them. One listing is just the special case.
  - The user pastes text, not a link. Our server never opens pages of listing sites.
  - Demo mode (what the judges run) uses synthetic listings in the same shape as pasted ones, labelled "Demo data".
  - Live mode B (search) is off. It is enabled only for a site that gives us written permission, and only for that site.
    Aleksa emails 4zida.rs, oglasi.rs and svenekretnine.com asking for permission for a non-commercial hackathon demo.
  - A recorded real run never enters the public repo with listing text or photos: only links and extracted facts, or
    it is replaced by synthetic data.
  - Why: 4zida.rs forbids automated use by the letter of its terms; the other two are unclear and restrict copying.
    Option B (search snippets only) would break our "never the snippet" rule. Respecting the terms is also a point for
    the README.
- 2026-11-26: mockup review (Aleksa). The Finance analyst is an AI agent that calls the lease cost calculator as a tool;
  only code computes numbers. The checking agent is called Auditor, never Verifier. Photo analysis is out of scope. The
  concept mockups in `design/concepts/` still show "Finance: plain code", "Verifier" and "photos + text"; they are not
  updated, because they will be replaced by the new design.
- 2026-11-26: Uizze is no longer used. Design is done by Aleksa and Claude in Aleksa's sessions; DESIGN.md is the
  single source of truth for the look.
- 2026-11-26: halooglasi.com is out: its robots.txt blocks Anthropic crawlers and does not allow AI input. We respect
  that instead of imitating a browser. nekretnine.rs is out for now (blocks all automated access).
- 2026-11-26: gross margin stays optional; missing margin = "missing data" for break-even and payback.
- 2026-11-26: added source kind `assumption` (values from config/weights.json, labelled "SuiteSpot assumptions") and an
  optional `grossMarginRate` in the profile (needed for break-even and payback; asked in the questionnaire). The
  deposit is excluded from total cost over the term (refundable); fit-out is written off straight line over the term.
- 2026-11-26: one root package.json (server + web), Vitest for tests. Push after every step, only when `npm test` passes.
- 2026-11-26: Mozaik 6.0.0 facts read from the bundle: interception runs before EVERY step (also `message_received`
  and `model_message`); `ModelContext` is mutated in place, so every loop needs its own context (never share
  `agent.getMemory().getContext()` across parallel loops); loop events are `message_received.started/completed`
  (not `context_update.*`); only the first function call of an inference is executed; `runLoop` returns void and
  the loopId only appears in event payloads.
- 2026-11-26: listings come from live web search, no listing database (option 2). Feasibility checked on a real
  Novi Sad listing (plan section 12a). Always read the listing page, not the search snippet.
- 2026-11-26: project SuiteSpot chosen; live web search via Anthropic `web_search` inside our own function tool;
  OpenStreetMap for area data; Supabase for history; Railway for deploy; Stripe and Solana not used.

## Session log
- 2026-11-26 18:40 (Aleksa): partial acceptance, months of rent, quote parts, "lease not verified"; live demo-07 3/3 cut. 85 tests pass. Not committed.
- 2026-11-26 18:00 (Aleksa): step 2.3 Finance analyst + Lease reader built, 79 tests pass, mock demo OK; live run
  on demo-07 found the partial-extraction problem. Not committed.
- 2026-11-26 17:00 (Aleksa): Scout schema fixed against Anthropic's structured output rules, schema rule test,
  provider-error handling, demo script; live haiku-4-5 run on demo-01 and demo-03 passed. 71 tests pass. Pushed.
- 2026-11-26 16:30 (Aleksa): DESIGN.md edits committed and pushed (dbf8818). Step 2.2 Scout built with 8 synthetic
  listings and keyless tests (65 pass). Committed and pushed after Aleksa's OK. Next: step 2.3 (Finance analyst
  and Lease reader).
- 2026-11-26 15:40 (Aleksa): DESIGN.md written; design direction chosen. App code not changed. Not committed.
- 2026-11-26 15:20 (Aleksa): option D chosen (mode A = 1 to 8 pasted listings); plan sections 2, 4.1, 4.4 updated;
  permission email drafted. Not committed.
- 2026-11-26 15:00 (Aleksa): read terms of use and robots.txt of the three listing sites; options A-D written,
  decision pending. Not committed.
- 2026-11-26 15:05 (Andrej): two design concepts (Era, Spade) in design/concepts; shift handover to Aleksa.
- 2026-11-26 14:35 (Andrej): added listing source rules (terms of use, honest UA, rate limit, allowed_domains). Next: design.
- 2026-11-26 14:25 (Andrej): listing fetch test, CLAUDE.md Mozaik notes, optional gross margin; pushed. Stopping here.
- 2026-11-26 14:05 (Andrej): step 5 Anthropic web search + fetch check done and pushed. Steps 1-5 of plan step 1 complete.
- 2026-11-26 13:55 (Andrej): step 4 cancellation spike done and pushed.
- 2026-11-26 13:50 (Andrej): step 3 domain model done and pushed.
- 2026-11-26 13:45 (Andrej): step 2 resilience done and pushed.
- 2026-11-26 13:40 (Andrej): step 1 skeleton done and pushed.
- 2026-11-26 13:00 (Andrej): planning done, files committed.
