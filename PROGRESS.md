# PROGRESS - SuiteSpot

Read this at the start of every session. Update it before every push. Newest entries at the top.
No long dashes in this file; use a plain hyphen.

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

**Not decided yet**
- The design direction is NOT chosen (Era or Spade). `DESIGN.md` does not exist. Do not create it and do not style the
  app for either direction until the team picks one.

**Aleksa's next step: plan step 2 (thin slice in demo mode)**
1. Before the Scout: read the terms of use of 4zida.rs, oglasi.rs and svenekretnine.com (see "Next step" below) and
   write the verdict here.
2. Scout: in demo mode it reads synthetic fixtures shaped like listings from the approved sites (plan section 11 says
   "Scout (fixtures)"). The live search tool follows CLAUDE.md "Listing sources": `allowed_domains` = approved sites
   only, honest User-Agent, at most 1 request per 2 s per site, respect robots.txt, skip blocked pages. It publishes
   `candidate.found` one by one, so evaluation starts while the search continues.
3. Finance analyst and Lease reader on 3 candidates, in parallel, in demo mode (MockRunner scripts). Finance calls the
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
- Era or Spade (team decision). Then DESIGN.md and the design pass (Aleksa and Claude).
- Terms of use of the three listing sites are not read yet.
- The honest User-Agent may be blocked more often than in the earlier test; re-run `npm run check:listings`.
- Railway datacenter IPs may be blocked by listing sites; test live mode from the deployed service.

## Current state
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
- Aleksa: plan step 2 (see the shift handover at the top). Design direction still open (Era or Spade).
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
- Terms of use of 4zida.rs / oglasi.rs / svenekretnine.com not read yet (robots.txt only). Read them before live use.
- Fetch was tested from a home connection. Railway runs on datacenter IPs and may be blocked more often; test live
  mode from the deployed service.
- A model call already in flight cannot be aborted (InferenceRunner has no signal); we pay for it and replace its
  answer. At most one call per stopped loop.
- Mozaik sends no `disable_parallel_tool_use`; add the custom AnthropicMessages mapper in live mode (see CLAUDE.md).

## Decisions log
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
- 2026-11-26 15:05 (Andrej): two design concepts (Era, Spade) in design/concepts; shift handover to Aleksa.
- 2026-11-26 14:35 (Andrej): added listing source rules (terms of use, honest UA, rate limit, allowed_domains). Next: design.
- 2026-11-26 14:25 (Andrej): listing fetch test, CLAUDE.md Mozaik notes, optional gross margin; pushed. Stopping here.
- 2026-11-26 14:05 (Andrej): step 5 Anthropic web search + fetch check done and pushed. Steps 1-5 of plan step 1 complete.
- 2026-11-26 13:55 (Andrej): step 4 cancellation spike done and pushed.
- 2026-11-26 13:50 (Andrej): step 3 domain model done and pushed.
- 2026-11-26 13:45 (Andrej): step 2 resilience done and pushed.
- 2026-11-26 13:40 (Andrej): step 1 skeleton done and pushed.
- 2026-11-26 13:00 (Andrej): planning done, files committed.
