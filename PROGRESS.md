# PROGRESS - SuiteSpot

Read this at the start of every session. Update it before every push. Newest entries at the top.
No long dashes in this file; use a plain hyphen.

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
- Andrej: design pass (Uizze) next. Plan step 2 (thin slice in demo mode) is left for Aleksa.
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

## For Andrej (needs the Uizze MCP)
- None yet.

## Session log
- 2026-11-26 14:35 (Andrej): added listing source rules (terms of use, honest UA, rate limit, allowed_domains). Next: design.
- 2026-11-26 14:25 (Andrej): listing fetch test, CLAUDE.md Mozaik notes, optional gross margin; pushed. Stopping here.
- 2026-11-26 14:05 (Andrej): step 5 Anthropic web search + fetch check done and pushed. Steps 1-5 of plan step 1 complete.
- 2026-11-26 13:55 (Andrej): step 4 cancellation spike done and pushed.
- 2026-11-26 13:50 (Andrej): step 3 domain model done and pushed.
- 2026-11-26 13:45 (Andrej): step 2 resilience done and pushed.
- 2026-11-26 13:40 (Andrej): step 1 skeleton done and pushed.
- 2026-11-26 13:00 (Andrej): planning done, files committed.
