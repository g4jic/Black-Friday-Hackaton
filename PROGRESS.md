# PROGRESS - SuiteSpot

Read this at the start of every session. Update it before every push. Newest entries at the top.
No long dashes in this file; use a plain hyphen.

## 26 Nov 2026, night (Andrej): DECISION - two-sided platform, no outside listings at all
- Terms of use checked: 4zida.rs forbids automated use of its system (section 12.2), oglasi.rs requires written
  permission for copying, svenekretnine.com forbids unauthorised downloading of listings. Decision: SuiteSpot never
  reads other sites' listings, neither by fetch nor by web search. Listings are posted directly on SuiteSpot.
- Landlords need an account (Supabase Auth, email + password, email confirmation off). Tenants can stay Guest
  (searches in sessionStorage). The 8 demo-01..08 fixtures are replaced by 100 seeded SYNTHETIC listings with 100
  demo landlord accounts. Plan approved (steps 0 to 10, one commit each). Answers: contacts in a separate table
  `listing_contacts` (no anon SELECT, revealed through our server, cascade delete), demo phones partly masked with
  "Demo contact" and no tel:/mailto:; mode A = one outside listing per evaluation; `SUITESPOT_MODE` is removed (live =
  a key exists, `SUITESPOT_ACCESS_CODE` required on the hosted version, recorded scenarios need neither); the Scout
  reads only pasted text in mode A, database listings go through code and the Lease reader compares the form with
  the lease draft; the migration is applied through the Supabase MCP after the SQL is approved.
- Step 0 DONE (clean start): removed `fixtures/listings`, `fixtures/leases`, `fixtures/mock-answers`, the
  `check:listings`, `demo:scout` and `demo:evaluate` scripts. Tests now use their own small synthetic set
  (`tests/fixtures/sample-listings.ts`, ids `listing-01..08`, one role each). Listing ids are now `pasted-<n>` or
  `listing-<id>` (`LISTING_ID_PREFIXES` in `src/domain/source.ts`). The server takes an injectable `DemoCatalogue`;
  none is built in, so **"Run demo" answers 503 until step 4** (seeded catalogue) and step 8 (recorded scenarios).
  `npm run screenshots` also waits for step 8. 122 tests pass, typecheck clean.
- Step 1 DONE: `SpaceListing` entity (`src/domain/space-listing.ts`, rules in code, typed errors listing every field
  problem), contacts kept apart, `ListingStore` port, `LocalListingStore` (seed + `data/local-listings.json`,
  ignored) and the "Local demo landlord".
- Step 2 DONE, seed APPROVED and FROZEN: `src/adapters/seed/generate-listings.ts` (fixed seed, fingerprint pinned in
  `tests/seed.test.ts`). Prices per m2 are a synthetic assumption, roughly aligned with public 2025-2026 ranges (Kurir
  Biznis, Biznis.rs): medians Novi Sad 10, Beograd 16.2 EUR/m2. "Missing data" = no lease draft, a draft missing
  clauses, or no description; required form fields are never empty. `npm run seed:report` prints a summary.
- Step 3 DONE: listing API (`src/adapters/server/listing-routes.ts`) and pages /listings, /listings/:id (Show contact,
  demo phone masked, no links), /listings/new, /listings/:id/edit, /my-listings.
- Step 4 DONE: SuiteSpot listings become candidates by code (`src/domain/catalogue-match.ts`): every value has a
  form source `{ kind: "listing", ref: "listing-ns014", field, form: true }`, no Scout. "Find spaces" =
  `matchListings` (city, area range, type of business, rent + costs within budget + 10% tolerance; max 8, closest
  to budget first). A listing with a lease draft goes to the Lease reader; one without a draft gets the same lease
  rules on its form terms ("Listing form check", plain code), which can reject it at once (any loop already started
  stops at its breakpoint, before inference). Keyless demo = Find spaces on the seed with the demo questionnaire;
  scripted Lease reader answers come from the seed's exact clause sentences (`seed-lease-answers.ts`), still checked
  by `buildLease`. "Evaluate for my business" (`/research/new?listing=<id>`): demo listings run without a key, any
  listing in live mode. Live `source: "search"` uses the user's questionnaire. Form vs draft comparison is step 7.
- Step 5 DONE: landlord accounts with Supabase Auth (`@supabase/supabase-js` 2.119.0, pinned; email + password).
  On when SUPABASE_URL and SUPABASE_ANON_KEY are set: the browser gets the public anon key from /api/auth-config,
  sends "Authorization: Bearer <token>", and the server resolves the landlord with auth.getUser
  (`src/adapters/auth/supabase-auth.ts`). /login, /signup, log out in the avatar menu; My listings and the listing
  form ask a guest to log in. Without Supabase: no accounts, the Local demo landlord. Listings are still in the local
  store until step 6 (Supabase store + migration). `.env.example` lists the three Supabase names (empty).
- Local ports: another local project may hold 3000 and 5173; stop it before `npm run dev`.

## 26 Nov 2026, late evening (Andrej): app flow, run orbit, results redesign
What changed (commits 1c11f9e to the last one of the day; 122 tests pass, typecheck clean, keyless demo unchanged):
- **App flow:** own router (no dependency): `/`, `/research/new`, `/research/:id/run`, `/research/:id`,
  `/research/:id/candidate/:candidateId`, `/history`, `/reports`, `/assumptions`, `/settings`, 404. Always "Guest"
  (`web/src/app/identity.ts`), no login. Settings in localStorage; guest history and results in sessionStorage (gone
  when the tab closes) behind the `HistoryStore` interface, so a Supabase store can be added later. On a phone the
  sidebar is a bottom bar.
- **Questionnaire:** Evaluate a space (mode A, 1 to 8 pasted listings, optional lease draft and optional Listing URL)
  and Find spaces (mode B, the synthetic demo). The demo profile is shown filled in and locked ("Demo profile"); mode A
  on a demo-only server is shown disabled with "Available in live mode".
- **Server:** `POST /api/research/:id/cancel` (run-level breakpoint, `src/application/cancellation/run-cancellation.ts`);
  live mode needs `X-Access-Code` when `SUITESPOT_ACCESS_CODE` is set (one name everywhere: code, `.env.example`,
  CLAUDE.md, here); live runs take the questionnaire profile; `GET /api/demo-questionnaire`.
- **Verdict by code:** `src/domain/verdict.ts` (Good at 70+ worst case with high confidence and nothing to check; Not
  recommended below 50, no rent or a hard flag; otherwise Check before signing). Rules on the Assumptions screen.
- **Run view:** orbit with fixed agent slots, candidates on an inner ring with short names ("Liman 2 · 72 m2"),
  hard flag = red pulse and the chip leaves the orbit into "Left the orbit", breathing centre, counters, Cancel.
  Everything from SSE events (`web/src/run/run-view-model.ts`). Reduced motion: a static list.
- **Results:** List / Report / Timeline ("Under the hood" metrics). One list by score with a one-sentence answer, a
  collapsed rejected block, and a candidate page (costs with plain-language sources, strengths and risks, lease terms
  or questions for the landlord, unknowns in points, all sources). Model: `web/src/results/results-model.ts`.
- **Fixes:** exit cost without a lease is "Needs lease terms" plus the known unrecovered fit-out (was a fake
  10,000 EUR total); the demo profile now has a gross margin (65 percent, the owner's estimate), so break-even and
  payback have numbers; the Auditor still checks every number (13 checked, 0 corrected).
- **Listing URL:** only a URL the user typed (http(s) only, validated in `src/domain/listing-text.ts`). Note: the Scout
  does NOT open listing pages today (no fetch or web_search exists; mode B live is off by the terms-of-use decision).
  When a site gives permission, the Scout must store the page it really opened in the same `url` field, and a
  recorded fixture must keep it.
- Screenshots: `npm run screenshots` writes `design/screenshots/run-mid.png`, `results-list.png`, `candidate.png`,
  `results-rejected-open.png`, `timeline.png`, `report.png`, `assumptions.png`, `new-research.png` (older
  `live-*.png` files are from the previous UI).
Steps done today, in order: (1) exit-cost fix and table bugs, (2) router, shell, Guest identity, Settings, history,
(3) cancel, access code, live profile, verdict by code, (4) questionnaire with both modes, (5) run orbit, (6) orbit
polish and two small bugs, (7) listing URL, demo gross margin, results list and candidate page, (8) screenshots and
this entry.

### Next: a two-sided platform (decided 26 Nov, evening)
- **What:** listings live on SuiteSpot itself. Landlords (or our seed script) publish commercial listings on
  SuiteSpot; tenants run the research over them. Supabase holds only landlord accounts (Supabase Auth) and the
  listings (table `listings`). Tenants can stay Guest; landlords must have an account to publish. A guest's searches
  and results stay in sessionStorage and are deleted when the tab is closed; they never go to Supabase. Seed data:
  100 SYNTHETIC listings, clearly
  labelled, in the same shape as a pasted listing (with optional lease drafts), so the demo and mode B run on a real
  catalogue instead of 8 fixtures.
- **Why:** the terms of use of 4zida.rs (automated use forbidden by the letter of its terms), oglasi.rs and
  svenekretnine.com (unclear, and both restrict copying) do not allow us to read their listings automatically, and no
  site has given written permission. Listings that are published on SuiteSpot are ours to read, so mode B ("find
  spaces") can work for real without scraping anyone.
- **Then:** README, deploy (Railway), Mozaik Cloud pairing, a fresh-clone test.

## HANDOFF: Aleksa -> Andrej (26 Nov 2026, evening)
Aleksa stops for today; Andrej continues with his own agent. Read this section first, then CLAUDE.md, then the plan.

### State in one paragraph
The full keyless pipeline works end to end in demo mode: 8 SYNTHETIC listings -> Scout (AI, 8 loops in parallel) ->
Finance analyst (AI + calculator tool) and Lease reader (AI) in parallel per candidate -> a hard flag in a lease cuts
the running Finance loop -> Ranker (code, worst-case score ranges) -> Report writer (AI) -> Auditor (code) -> web UI
(Live research: Table / Cards / Timeline, Reports, Assumptions, New research) over SSE. 102 tests pass (11 files),
typecheck clean. One live run of the whole demo with claude-haiku-4-5 passed (34.1 s, about $0.10, see below).

### What works
- Demo mode, keyless and deterministic: `npm run dev`, open http://localhost:5173, "Run demo" (about 7 s).
- Agents: Scout, Finance analyst, Lease reader, Report writer (AI); Ranker, Auditor, loop tracker, wire tap (code).
- Hard flags decided by code: budget (Finance tool), lease locked in without exit, unlimited rent increase. A hard
  flag rejects the candidate and stops other loops on it at their next breakpoint (interception) or mid tool call.
- Every number carries a source (listing quote, lease clause, calc, profile, assumption); values without a source are
  rejected by code. Missing data stays missing (never a guess).
- Live mode (key on the server only): pasted listings (1 to 8) and the demo; cost guard (max 8 listings, 1 live run at a
  time, live only with SUITESPOT_MODE=live).
- Live check, 26 Nov 2026 15:59 UTC, whole demo, claude-haiku-4-5: 34.1 s, 22 loops, peak 11 in parallel, 13
  calculator calls, 69,477 input + 6,918 output tokens, about $0.104; 2 rejected, 1 loop cancelled; audit: 12 claims
  checked, 1 corrected on the first draft, 0 removed; recommended demo-01, demo-06, demo-05. Files:
  `design/screenshots/report-live.md`, `live-run-report.png`, `live-run-table-end.png`, `live-run-timeline-end.png`.

### What does not work yet / not built
- Not built: Interviewer (a fixed questionnaire `fixtures/requirements/demo.json` is used, also for pasted listings),
  Location analyst (OSM), Premises inspector, History (screen is a placeholder; runs live in memory, last 20 only),
  Supabase, Railway deploy, README (only a short "Known limitations" stub).
- Live mode B (web search for listings) is off by decision (terms of use, option D); no site has given permission.
- Mozaik Cloud tracing is not paired on this machine ("no API key - telemetry disabled" in the logs).

### Known bugs and limits
- The quote part separator " ... " breaks when a listing or lease text itself contains "..." (a valid quote may then be
  rejected and the field becomes unverified MissingData).
- When a hard flag lands during a model call, that call finishes and is paid for; its answer is replaced ("stopped").
- Agents' names in pasted text are not removed by code (phones and emails are); the Scout never extracts names.
- Premises are not scored, so cheap listings without a lease (demo-06, demo-05) rank right behind demo-01.
- The Auditor is code only: it checks numbers, candidates and "never recommend a rejected one" exactly; it does not
  check wording (decision below). The report's 1 correction in the live run shows the loop working.
- Live runs vary: in the live run one extraction was sent back once (partial acceptance kept the verified fields).
- `scripts/check-listing-fetch.ts` (`npm run check:listings`) fetches listing pages: do NOT run it (decision D).
- Git prints "LF will be replaced by CRLF" warnings on Windows; harmless (quote checks ignore line endings).
- The scores in the Table are sorted by rank inside each section, so rank #1 can sit in "Scored" and #2 in "Check before
  signing".

### Decisions made today (details in the Decisions log below)
1. Listing sources: option D. No automated reading of listing sites; the user pastes 1 to 8 listing texts (mode A);
   demo mode uses synthetic listings of the same shape; live search only for a site that gives written permission.
2. Partial acceptance: the Scout and the Lease reader get one retry with the validator's feedback; on the last attempt
   verified fields are kept and a failing field becomes unverified MissingData ("check before signing"). Only invalid
   JSON or a provider error fails the whole item.
3. Amounts as months of rent ("jedna kirija"): the model answers `monthsOfRent`; code computes the amount from the
   sourced rent (source calc with both quotes). The model never computes.
4. Quotes may have up to 3 parts joined with " ... "; code checks every part verbatim (normalised spaces).
5. Anthropic structured output rules (from the docs + our own 400s), enforced by `tests/schema-rules.test.ts` on every
   agent schema: no enum next to a type array, max 16 union parameters and 24 optional per request, objects need
   additionalProperties false, no oneOf / length limits. Quote fields are strings, not arrays (arrays made "The
   compiled grammar is too large").
6. Ranker: unknown parts give a score RANGE (low end = unknown as 0, high end = unknown as full); the rank uses the low
   end (worst case); no rent = never first; confidence says what is missing and how many points it carries.
7. Report: the Report writer writes only from FACTS written by code from the state and cites them per sentence; the
   Auditor (code) checks every sentence; problems go back once; on the second draft failing sentences are removed and
   marked. No AI part in the Auditor (see `src/application/agents/auditor.ts` for the reasoning).
8. Look (DESIGN.md is the source of truth): coral #F25C54 brand with black text (white fails AA), lilac #C19BE9 with
   black text, hard flag dark red #9F1B12 always with the octagon icon and the words "Hard flag", glass cards, warm
   gradient, Hanken Grotesk (checked loaded), 200 ms transitions off under reduced motion.

### Next steps for Andrej (in priority order)
1. **README that works from zero** (it is scored). Quick start with `npm install` (not `npm ci`), Node 22+, keyless demo
   (`npm run dev`, "Run demo"), optional live mode with a key (.env + SUITESPOT_MODE=live), `npm test` (102 tests).
   Use the screenshots in `design/screenshots/`, the "How the agents run concurrently" table (Scout x8, Finance +
   Lease per candidate, interception, Ranker / Report writer / Auditor on events), Mermaid diagram, real-vs-mocked
   table, limitations, credits (Mozaik 6.0.0, Hanken Grotesk OFL 1.1, lucide ISC). Test it on a fresh clone.
2. **Deploy on Railway**: one service, `npm run build` then `npm start` (serves web/dist and the API on PORT), demo
   mode by default (no key on the public deploy, or keep SUITESPOT_MODE unset).
3. **Demo video script** (2-3 min): the problem; Run demo; Timeline showing Finance on demo-07 start, wait for the lease,
   get cut ("Hard flag: demo-07 rejected"); Table with ranks and score ranges (#1 demo-01 80, #2 demo-06 74-94); the
   Rejected row with the cancelled Finance loop; Reports with "Audited: N claims checked, M corrected" and source labels.
4. **Location analyst** only if time is left (OSM, Nominatim + Overpass, 1 request per second). Normalise the address
   before geocoding: listings give declined forms ("grbavici" -> "Grbavica", "na Detelinari" -> "Detelinara").
5. **Open questions**: fixed questionnaire instead of an Interviewer agent (keep or build?); the " ... " quote separator
   limit; a Premises inspector (would fix demo-06 / demo-05 ranking above better premises).

### How to run (PowerShell)
```powershell
npm install
npm test
npm run dev
```
- Open http://localhost:5173 and click "Run demo" (keyless). API on :3000, web on :5173.
- CLI demos: `npm run demo:scout`, `npm run demo:evaluate` (keyless); add `-- --live` to use the real model.
- Live mode in the browser (costs about $0.10 per full demo run): put `ANTHROPIC_API_KEY=...` in `.env`, then
  `$env:SUITESPOT_MODE = "live"; npm run dev`. Never commit `.env`.
- Production: `npm run build` then `npm start` (one process serves the web app and the API).
- Screenshots: with `npm run dev` running, `npm run screenshots` (uses the installed Edge, writes design/screenshots).

### How to verify
- `npm test`: 11 test files, 102 tests pass. `npm run typecheck`: no errors.
- In the browser after "Run demo" (about 7 s):
  - Timeline: Scout lanes for demo-01..08 start at 0 s; the Finance lane "demo-07 cut" turns red and ends with a red x
    near 4.3 s at the dashed line "Hard flag: demo-07 rejected"; "peak 11 loops in parallel".
  - Table at the end: Check before signing (5), Scored (1), Rejected (2). #1 demo-01 80 high, #2 demo-06 74-94 medium,
    #3 demo-05 68-88, #4 demo-04 60, #5 demo-03 60-100 low, #6 demo-08 32-97 low ("Cannot rank first"). Rejected rows:
    demo-02 (over budget, by Finance analyst) and demo-07 (locked in, by Lease reader, Finance cancelled mid tool call).
  - Metrics strip: done in about 6.5 s, 19+ loops, 2 rejected, 1 loop cancelled, keyless $0.
  - Reports: "Audited: 13 claims checked, 0 corrected", recommended 1. demo-01, 2. demo-06, 3. demo-05; every sentence
    has source labels; "Not financial or legal advice" at the top and the bottom.
  - Assumptions: weights 45 / 20 / 20 / 15 and "Unknown parts count as worst case for ranking."


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
- **Report writer + Auditor + Reports screen (26 Nov), committed and pushed.** 102 tests pass. See the HANDOFF section.
  - Domain `src/domain/report.ts` (facts, `parseReportDraft`, `auditReport`), application `agents/report-writer.ts`
    (AI, `REPORT_SCHEMA`, `buildFacts`), `agents/auditor.ts` (code), events `report.drafted`, `audit.started`,
    `audit.done`, `report.audit_failed`, `report.ready`; `GET /api/research/:id/report`; `web/src/Reports.tsx`;
    the Timeline shows the Report writer loop and the Auditor's audits. Score column widened (range on one line).
- **Visual revision to match the reference (26 Nov), committed and pushed.** 98 tests pass at that point,
  typecheck clean. DESIGN.md sections 0-4, 6.5, 6.10, 8 and 10 rewritten.
  - Colours: brand coral `#F25C54` (black text on it: white fails AA at 3.26; white icons are fine), lilac `#C19BE9`
    with black text, hard flag dark red `#9F1B12`, always with the octagon icon and "Hard flag" text.
  - Glass: `.glass` (white 56%, blur 28 px + saturate 170%, light border, inner highlight) and `.glass-strong`, in
    `@layer components`. Warmer gradient with soft blobs (coral bottom left, peach top left, lilac top right, white
    haze in the middle). Larger radii, tighter heading tracking, 200 ms transitions (off with reduced motion).
  - Hanken Grotesk verified in the browser (`document.fonts.check` true). Side-by-side comparisons with the reference
    were rendered in the scratchpad only (the reference shows another product's name and people's photos).
- **Ranker done (26 Nov), 98 tests pass, typecheck clean, committed and pushed.**
  - Change after Aleksa's review: a re-weighted 100 for a candidate without area and lease was misleading. Now
    unknown parts give a score RANGE (low end = unknown as 0, high end = unknown as full; one number when nothing is
    unknown) and the rank uses the low end (worst case). Rent missing still means never first. Confidence reasons
    say what is missing and how many points it carries ("no lease draft: up to 20 points unknown"). Assumptions
    screen: "Unknown parts count as worst case for ranking."
  - Demo result now: #1 demo-01 (80, high), #2 demo-06 (74-94, medium), #3 demo-05 (68-88, medium), #4 demo-04
    (60, high), #5 demo-03 (60-100, low), #6 demo-08 (32-97, low, no rent). demo-02 and demo-07 rejected, not ranked.
  - Earlier notes (the first version re-weighted missing parts; replaced as above):
  - Domain `src/domain/ranking.ts`: `RANKING_ASSUMPTIONS` (weights cost 45, area 20, lease terms 20, points to check
    15; cost full at <= 70% of budget, 0 at 110%; area 0.7 to 1 inside the range, 0 outside; lease = average of the
    stated terms; each soft flag or unverified field -0.15, notice and indexation not counted twice),
    `scoreCandidate` (missing parts are left out and re-weighted, never 0; they lower the confidence: high, medium,
    low), `rankCandidates` (tier 1: rent known and confidence high or medium; tier 2: low confidence; tier 3: no rent,
    never first; then score, confidence, id: deterministic). 2 or 3 reasons, each with a validated source.
    `SourceRef.missing` = "the text does not state this field" (a source for missing data, no quote).
  - Application `src/application/agents/ranker.ts`: plain-code participant, wakes when every listing is read and no
    loop runs, ranks once, `candidate.markScored`, `state.recordRanking` (throws for a rejected candidate), events
    `candidate.scored` and `ranking.done`. The research session waits for `ranking.done` before `research.done`.
  - `GET /api/assumptions` serves the constants; `web/src/Assumptions.tsx` shows them. Table and Cards show rank,
    score, confidence and the reasons with source labels; rows sorted by rank within each section.
  - Demo result: #1 demo-06 (93, medium), #2 demo-05 (86, medium), #3 demo-01 (80, high), #4 demo-04 (60, high),
    #5 demo-03 (100, low: no area, no lease), #6 demo-08 (91, low: no rent). demo-02 and demo-07 are rejected, never
    ranked. Note: cheap demo-06 and demo-05 rank above demo-01 because premises (renovation, first floor, no shop
    window) are not scored yet: that needs the Premises inspector.
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
- See "Next steps for Andrej" in the HANDOFF section at the top.

## Open problems
- See "Known bugs and limits" in the HANDOFF section at the top. Resolved since: the terms of use are read (option D),
  live mode no longer fetches listing pages, and `src/adapters/inference/live-runner.ts` sends
  `disable_parallel_tool_use` for Anthropic models.

## Decisions log
- 2026-11-26: Report and Auditor. The Report writer (AI) writes only from facts written by code and cites them per
  sentence; the Auditor is plain code (numbers, candidate ids, rejected never recommended, top 3 only); one retry with
  feedback, then failing sentences are removed and marked. No AI Auditor: it would add cost and a new way to be
  wrong without catching more invented numbers; source labels next to every sentence let a reader check the wording.
- 2026-11-26: visual revision to match the reference: coral #F25C54 with black text, lilac #C19BE9 with black text, hard
  flag #9F1B12 always with icon and "Hard flag", glass cards, warmer gradient (DESIGN.md updated).
- 2026-11-26: Ranker uses worst-case score ranges (Aleksa's review: a re-weighted 100 was misleading).
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
- 2026-11-26 17:15 (Aleksa): Report writer + Auditor + Reports screen, live run of the whole demo ($0.104, 34.1 s),
  handoff to Andrej written. 102 tests pass. Committed and pushed.
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
