# PROGRESS - SuiteSpot

Read this at the start of every session. Update it before every push. Newest entries at the top.
No long dashes in this file; use a plain hyphen.

## 27 Nov 2026, morning (Aleksa + Claude): README, auditor ids, rank by verdict, re-recorded demos
- **README written** (scored): pitch, hero, keyless quick start, live and Supabase, concurrency table + Mermaid +
  recorded metrics, care with financial data, P4 table, real/recorded/scripted, limits, troubleshooting, credits.
  Placeholders left: demo video link, live deployment link, Mozaik Cloud screenshot
  (`design/screenshots/mozaik-cloud.png`) and its link. Fresh-clone test (no .env): npm install, npm run dev, Find
  spaces, all 3 scenarios work the first time; npm ci also works.
- **Auditor fix** (`src/domain/report.ts`): digits inside the EXACT id of a known candidate (any letter case,
  "Listing-ns020") are not read as numbers; every other number is checked as before (tests in `report.test.ts`).
  Before the fix the recorded cafe report lost 5 of 11 sentences, all three recommendations included.
- **Rank by verdict first** (`src/domain/ranking.ts`): Good, then Check before signing, then Not recommended; inside
  a verdict the low end of the score. The web list follows the rank from the Ranker (it used to re-sort by score), so
  the best option never has a weaker verdict than another candidate. Assumptions screen and README updated.
- **Re-recorded the 3 demo scenarios** (needed: the rank facts changed the Report writer requests): cafe 23, office
  27, shop 21 model calls; every report passes the audit on the first draft with 0 removed (the test now requires it).
- **The UI shows candidate names, not ids**, in the Report tab and the Timeline (`withCandidateNames` in
  `web/src/candidate-label.ts`); the report and the audit keep the real ids. Hard flag labels in the Timeline stack
  in rows. Source hovers still show the listing id as the source reference.
- **Mozaik Cloud paired** on the machine of Aleksa (project "default"); every agent loop is its own Cloud session (42
  for the 3 recordings). Supabase checked with the real keys: listings from the database, contacts refused to anon; a
  temporary account signed up, saved a space, saw it in My spaces, signed out and in, and was deleted with its row
  (the view counter of listing-ns032 went up by our visits).
- Tests: 24 files, 178 tests pass; typecheck clean.

## HANDOFF (27 Nov 2026, after midnight, Andrej's second night shift): READ THIS FIRST
Whoever continues starts a new session without this context. Read this section, then CLAUDE.md. The sections below
(P4 table, the earlier 27 Nov handoff, the 26 Nov handoff) are still true unless this one says otherwise.

### Deadline
- Submissions close **Friday 27 Nov 2026 at midnight CET** (end of Friday). No demo slot: the jury sees only the
  public repo, the README and our video link. Feature freeze Fri 18:00.

### Done in this shift (one commit each, all pushed to main)
1. **Browser check of every page and flow** (d4474d6): assumptions, history, listings, show contact, Find spaces with
   the real model, results list, report tab, candidate page, history entry, My spaces for a guest, sign in with
   redirect, Save, My spaces list, My listings, sign out: 16 of 16 pass (temporary account created and deleted with
   its saved rows). Fixed: a first visit had an empty questionnaire so Search refused to start (now prefilled from the
   demo example); missing favicon (inline SVG).
2. **P4, ten real-model evaluations** (697b940): table and fixes in "P4 quality check" below. Two wrong verdicts fixed
   in code with tests: lease terms only from the listing form give at most medium confidence; a space outside the
   required area range is never Good. The Report writer gets the code verdict and never calls a single candidate
   "ranked". Rerun any time: `npx tsx scripts/eval-scenarios.ts` (server running with a key).
3. **Outside listing, pasted listing text** (c813aec): optional "Listing text" on Evaluate an outside listing. The
   Scout reads it in its own loop (parallel with Lease reader and Finance analyst); `compareTypedWithText`
   (`src/domain/listing-compare.ts`) compares rent, monthly costs, deposit, area and city; each difference is a point
   to check before signing with both sources (typed field + quote) and lowers the checks part of the score. Verified
   live (typed 950 EUR / 58 m2, text 1,100 EUR / 52 m2: two points to check).
4. **P5, recorded runs** (849e856, 8f3dbb1, 90c806e): `RecordingRunner` / `ReplayRunner`
   (`src/adapters/inference/recording-runner.ts`), `npm run record:demo`, three scenarios with locked questionnaires
   (`fixtures/requirements/demo.json`, `office-beograd.json`, `shop-novi-sad.json`), recorded with claude-haiku-4-5
   into `fixtures/recordings/*.json` (22, 27, 25 model calls, about $0.30 in total). Without a key, Find spaces offers
   the three scenarios and every result screen says "Recorded run". `tests/recorded-demo.test.ts` replays all three
   to an audited report. Re-record after changing an agent instruction or message format (a request that is not in
   the recording becomes a provider failure, never an invented answer; the test catches it).

### Exact state
- Tests: 25 files, 170 tests pass. `npm run typecheck` clean (server and web). No new dependencies.
- Keyless: Find spaces = recorded scenarios (label "Recorded run"); "Evaluate for my business" on a demo listing still
  uses scripted answers (label "Scripted demo answers, no AI model"); Evaluate an outside listing needs a key.
- With a key: everything runs live (about $0.05 to $0.10 per run).
- Supabase unchanged since the last handoff (migrations applied, RLS checks pass, only advisor warning: leaked
  password protection off).

### For Aleksa, in this order
1. **Railway deploy**: one service, `npm run build` then `npm start`. Variables: `ANTHROPIC_API_KEY`,
   `SUITESPOT_ACCESS_CODE` (so a public URL cannot spend our key), `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`. In Supabase (Authentication, URL configuration) set Site URL and redirect URL to the
   Railway address. Decide whether the public URL runs with the key (needs the access code) or keyless (recorded).
2. **README** (scored): pitch, hero image, keyless quick start (`npm install`, `npm run dev`, Find spaces, pick a
   scenario), how the agents run concurrently (mechanism table + Mermaid + Mozaik Cloud screenshot), the P4 table as
   evidence, what is real / recorded / scripted, synthetic data, not financial advice, limits, credits.
3. **Short video** (2-3 min) and its link in the README.
4. **Fresh-clone test**: clone into a new folder, follow the README word for word, it must work the first time.
5. Only then, if time is left: offers and inquiries between users; lease records and the rent schedule; test rent
   payment through Stripe test mode (not Solana); the optional "Listing check" before publishing.

### Known limits (say them in the README)
- The score does not weigh rent against expected revenue (occupancy cost); the report states that share as a fact.
- `RequireLandlord` and `auth.landlord` keep old names in code (UI texts are neutral).
- The old `source: "pasted"` server path (1 to 8 pasted listings) still exists but the UI no longer uses it.

## EARLIER HANDOFF (27 Nov 2026, early morning): partly SUPERSEDED by the one above (P4, P5 and the pasted text are now done)
Whoever continues starts a new session without this context. Read this section, then CLAUDE.md. The handoff from
26 Nov late night (right below) is still true for Supabase, the decisions and the deadline, except where this one
says otherwise.

### Deadline
- Submissions close **Friday 27 Nov 2026, 00:00 CET**. No demo slot: the jury sees only the public repo, the README
  and our video link. Feature freeze Fri 18:00; after that only README, video, screenshots and the fresh-clone test.

### What changed tonight (P1 to P4 of the night prompt; one commit each)
- **P1, everything works** (13f5187): `SUITESPOT_MODE` is REMOVED. The server runs live whenever
  `ANTHROPIC_API_KEY` is set, otherwise keyless with scripted answers (labelled). A down API gives one human message
  (`web/src/app/api-fetch.ts`), never "Failed to fetch". "Find spaces" searches all 100 listings; no "8 candidates"
  or "no API key" chips.
- **P2, navigation** (86d63e7): menu Home, Find spaces, Evaluate an outside listing, Listings, History, Assumptions
  (active state by `?mode=`); avatar menu My spaces, My listings, List a space, Settings, Sign in / Sign up /
  Sign out. Reports page and route removed (the report stays a results tab). SVG logo (`web/src/app/Logo.tsx`), Home
  titled "Find your SuiteSpot".
- **P3, accounts** (53dae06): one kind of account (everyone can search and list; "landlord" only means the party in
  a lease). Save button on a listing page; **My spaces** shows saved listings + an empty "Spaces I rent" with a CTA;
  **My listings** shows a view count per listing + empty "Offers" and "Rented out" sections with a CTA. Pages that
  need an account ask a guest to sign in (`RequireLandlord`, name kept for now). New migration
  `20261127010000_saved_listings_and_views.sql` (APPLIED): `saved_listings` (each user sees and changes only their
  own rows) and `listing_views` (only the server counts, through `record_listing_view`, service role only; the owner
  reads their own counts). Checked with `supabase/checks/rls-checks-saved-views.sql` (all passed); the security
  advisor still shows only "Leaked password protection disabled".
- **P3, Evaluate an outside listing** (96512bc): the evaluate tab asks for the SAME required fields as the listing
  form (shared `ListingTermsFields`), plus optional lease draft and link. The server builds the candidate through
  `SpaceListing.create` (`outsideCandidate` in `research-routes.ts`); missing fields give a 400 with every problem
  listed on the page; nothing is stored. Needs a key (without one the page shows the no-key notice). Verified live:
  a good cafe lease in Novi Sad scored 96/100, every number sourced to a form field or a lease quote.
- **P4, partly** (c6413f8): an unverified lease clause now reads "SuiteSpot could not confirm what the lease says
  about <clause in words>: <plain reason>" instead of the internal field name and raw checker text.

### NOT done tonight (exact state, for Aleksa)
1. **Outside listing, optional pasted listing text:** not built. The plan was: the Scout reads the pasted text and
   code compares its extracted fields with the typed ones, flagging every mismatch with both sources. The old
   `source: "pasted"` server path still exists (unused by the UI). Build it only if time allows; otherwise leave it
   out of the README.
2. **P4, 10 varied evaluations** (good ones, bad leases, wrong permitted use, missing data, both cities) with fixes
   to instructions or rules where a score or verdict is wrong: NOT run. Do it with a key before recording (about
   $0.10 each). Write the results here.
3. **P5, recorded runs:** NOT started. 3 demo scenarios with a locked profile (cafe Novi Sad, office Beograd, shop
   Novi Sad), `RecordingRunner` / `ReplayRunner`, `npm run record:demo`, "Recorded run" label. Until then the keyless
   demo stays "Scripted demo answers, no AI model" (honest, already labelled).
4. Small: the "Your business" card stretches to the full height of the evaluate form (cosmetic). `RequireLandlord`
   and `auth.landlord` keep their old names in code (UI texts are already neutral).

### For Aleksa (not tonight, in this order)
1. Railway deploy: one service, `npm run build` then `npm start`. Variables: `ANTHROPIC_API_KEY`,
   `SUITESPOT_ACCESS_CODE` (so a public URL cannot spend our key), `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`. In Supabase (Authentication, URL configuration) set Site URL and redirect URL to the
   Railway address.
2. README (scored), short video (2-3 min), fresh-clone test (clone, follow the README word for word, works first try).
3. Items 1 to 3 of "NOT done" above, if time allows (P4 before P5).
4. Later features, only if everything above is done: offers and inquiries between users; lease records and the rent
   schedule; test rent payment through Stripe test mode (not Solana); the optional "Listing check" before publishing.

### How to run locally (PowerShell)
```powershell
npm install
Copy-Item .env.example .env   # fill in what you have; never commit .env
npm test                      # 162 tests
npm run typecheck
npm run dev                   # API on 3000, web on 5173 (5174 if 5173 is taken)
```
- No keys: keyless demo (scripted answers, fixed demo profile), local listing store, no accounts.
- `ANTHROPIC_API_KEY` set: live runs with claude-haiku-4-5 (about $0.10 per full run), your own questionnaire,
  "Evaluate an outside listing" enabled. There is no mode variable any more.
- The three `SUPABASE_*` values: accounts, listings, saved spaces and view counts from the database.

## P4 quality check: 10 outside listings with the real model (27 Nov 2026, Andrej + Claude)
Script: `scripts/eval-scenarios.ts` (server running with ANTHROPIC_API_KEY; one live run at a time; about $0.05 to
$0.10 per scenario). Profiles: cafe Novi Sad (demo questionnaire), design office Beograd, food shop Novi Sad,
furniture workshop Beograd.

**First pass** (before the fixes). Columns: score (confidence), hard flags, concerns, first report sentence. The
verdict was not on the event yet; by the rules, #5 and #9 would have been "Good":
| Scenario | Expected | Score (confidence) | Hard flags | Concerns | First report sentence |
|---|---|---|---|---|---|
| 1 cafe NS, good lease | good, top score | 96 (high) | - | - | Lokal 58 m2 Liman 2 scores 96 out of 100 with monthly cost of 1,010 EUR, which is 67% of the 1,500 EUR budget and 11.2% of expected monthly revenue. |
| 2 cafe NS, over budget | budget hard flag | REJECTED | monthly_cost_over_budget | - |  |
| 3 cafe NS, office use only | permitted use hard flag | REJECTED | permitted_use_excludes_business | - |  |
| 4 cafe NS, locked in + landlord raises rent | hard flags: no exit, unlimited increase | REJECTED | locked_in_without_exit,  | - |  |
| 5 cafe NS, no lease draft | lower confidence, questions to ask | 92 (high) | - | - | Lokal 70 m2 Grbavica scores 92 out of 100 and fits your budget at 1,160 EUR monthly, which is 77% of your 1,500 EUR limit. |
| 6 office BG, good | good | 85 (high) | - | - | Kancelarija 48 m2 Vracar ranks #1 with a score of 85 out of 100 and monthly cost of 980 EUR is 82% of the 1,200 EUR budget. |
| 7 office BG, harsh lease | concerns: guarantee, penalty, structural, 8% a year | 66 (high) | - | , , , ,  | Kancelarija 55 m2 Novi Beograd is the only candidate with a space of 55 m² that fits the required 35-70 m² range at a monthly cost of 1,050 EUR. |
| 8 shop NS, good | good | 84 (high) | - | - | Lokal 65 m2 Centar ranks highest with a score of 84 out of 100, offering 65 m² within your required 40-90 m² range at 1,170 EUR monthly. |
| 9 shop NS, too big | area outside the range, lower score | 73 (high) | - | - | Lokal 140 m2 Novo naselje ranks highest at 73 out of 100 with monthly cost of 1,060 EUR, which is 76% of your 1,400 EUR budget. |
| 10 workshop BG, vague lease | missing data, low confidence | 64-84 (medium) | - | - | Radionica 110 m2 Zemun is the only identified space and meets your size requirement at 110 m² within your 60-150 m² range. |

**What was wrong and what changed (all in code, with tests):**
1. **#5, no lease draft, 92 with high confidence, verdict Good.** Lease terms that only the listing form states
   were scored as if read from a lease. The documented rule already said "medium when verified lease terms are
   missing". Now terms only from the form still score but give at most medium confidence ("lease terms come from
   the listing form, not from a lease draft"), so the verdict is Check before signing (`src/domain/ranking.ts`).
2. **#9, 140 m2 when the business needs 40 to 90 m2, verdict Good.** The area scores 0 but the rest kept the score
   at 73. Now a space outside the required area range is never Good: "Ranked, but the area is outside your
   required range" (`src/domain/verdict.ts`).
3. **Report wording with one candidate.** The Report writer said "ranks highest" for the only candidate. The rank
   fact now says "is the only candidate evaluated" and carries the code verdict; the instruction forbids "ranked,
   first, highest" with one candidate and says to use the verdict as stated.
4. The verdict is now published on `candidate.scored` (and passes to the browser), so observers and this script
   read it instead of guessing.

**Second pass** (after the fixes):
| Scenario | Expected | Score (confidence), verdict | Hard flags | Concerns | First report sentence |
|---|---|---|---|---|---|
| 1 cafe NS, good lease | good, top score | 96 (high), good | - | - | Lokal 58 m2 Liman 2 scores 96 out of 100 with a verdict of Good, with monthly cost of 1,010 EUR being 67% of the 1,500 EUR budget. |
| 2 cafe NS, over budget | budget hard flag | rejected, not_recommended | monthly_cost_over_budget | - |  |
| 3 cafe NS, office use only | permitted use hard flag | rejected, not_recommended | permitted_use_excludes_business | - |  |
| 4 cafe NS, locked in + landlord raises rent | hard flags: no exit, unlimited increase | rejected, not_recommended | locked_in_without_exit, unlimited_rent_increase | - |  |
| 5 cafe NS, no lease draft | lower confidence, questions to ask | 92 (medium), check_before_signing | - | - | Lokal 70 m2 Grbavica scores 92 out of 100 with monthly cost of 1,160 EUR at 77% of budget and 70 m² within the required 50-90 m² range. |
| 6 office BG, good | good | 85 (high), good | - | - | Kancelarija 48 m2 Vracar scores 85 out of 100 with high confidence and a verdict of Good, with monthly cost of 980 EUR at 82% of the 1,200 EUR budget. |
| 7 office BG, harsh lease | concerns: guarantee, penalty, structural, 8% a year | 66 (high), check_before_signing | - | personal_guarantee, tenant_pays_structural_repairs, long_notice, high_indexation, early_exit_penalty | Kancelarija 55 m2 Novi Beograd scores 66 out of 100 with high confidence and meets the size requirement of 55 m² within the 35-70 m² range. |
| 8 shop NS, good | good | 84 (high), good | - | - | Lokal 65 m2 Centar is evaluated as Good with a score of 84 out of 100, meeting the size requirement of 65 m² within the 40-90 m² range. |
| 9 shop NS, too big | area outside the range, lower score | 73 (high), check_before_signing | - | - | Lokal 140 m2 Novo naselje scores 73 out of 100 with high confidence and has a monthly cost of 1,060 EUR that is 76% of the 1,400 EUR budget. |
| 10 workshop BG, vague lease | missing data, low confidence | 64-84 (medium), check_before_signing | - | - | Radionica 110 m2 Zemun meets the size requirement at 110 m² within the 60-150 m² range. |

**Judgement.** All ten verdicts are right. Scores: #1 at 96 is a deliberately good case (verified lease, 67% of the
budget, rent 11% of expected revenue, early exit with 3 months notice, CPI indexation, landlord pays structure); a
high score is correct there and the verdict comes from code. The harsh office lease (#7) keeps 66 but is Check
before signing with five concerns. Known limit: the score does not weigh rent against expected revenue (occupancy
cost); the report states that share as a fact. Possible later rule, not done.

## PREVIOUS HANDOFF (26 Nov 2026, late night, Andrej): partly SUPERSEDED by the one above (SUITESPOT_MODE is gone; steps 7 to 9 were replaced by the night prompt)
Whoever continues (Aleksa or Andrej) starts a new session without this context. Read this section, then CLAUDE.md,
then the step entries right below. Older sections further down are history; anything marked SUPERSEDED is no longer
true.

### Deadline and how we are judged
- Submissions close **Friday 27 Nov 2026, 00:00 CET** (midnight Fri to Sat). Last submission counts.
- **We have no demo slot.** The jury only sees the public repo and the README, so the README, a working quick start
  and a short video carry the whole entry.

### State in one paragraph
SuiteSpot is a two-sided listing platform for commercial spaces. Landlords (Supabase Auth account) publish structured
listings; tenants stay Guest and ask "Is this lease a good financial decision for my business?". Mozaik agents
(Lease reader, Finance analyst, Report writer, plus code participants: listing form check, Ranker, Auditor) evaluate
every candidate in parallel; every number carries a source; hard flags are decided by code and cut running loops at
their breakpoint. Steps 0 to 6 of the plan are done. Listings live in Supabase (project SuiteSpot) with RLS checked;
100 synthetic demo listings are seeded. Keyless runs use scripted demo answers (labelled as such on every result
screen) until recorded runs exist (step 8).

### Done (one commit each, all pushed)
- Step 0 clean start (old fixtures and listing-fetch scripts removed). Step 1 `SpaceListing` entity and `ListingStore`
  port. Step 2 frozen seed (100 listings, 100 demo landlords, fingerprint pinned in `tests/seed.test.ts`). Step 3
  listing pages (browse, public listing, form, my listings). Step 4 "Find spaces" from the catalogue and "Evaluate for
  my business" on one listing. Step 5 landlord accounts (Supabase Auth: log in, sign up, log out).
- Fixes before step 6: permitted use is a hard flag in code on every evaluation (rule
  `permitted_use_excludes_business`); honest answer label ("Scripted demo answers, no AI model", later "Recorded
  run"); results polish (grouped, collapsed, plain-language sources; one money format "2,500 EUR"; main reason = best
  plus and worst minus; "Can't judge: rent not stated"; "area unknown"); `.gitattributes` (LF everywhere).
- Step 6 Supabase: migrations in `supabase/migrations/` (applied), checks in `supabase/checks/rls-checks.sql`,
  `SupabaseListingStore`, `npm run seed:supabase`. Details in "Supabase" below.

### Exact state
- Tests: 22 files, 158 tests pass (`npm test`). Typecheck clean (`npm run typecheck`, server and web).
- Last commit: see `git log -1` (this handoff is in it). Branch `main`, pushed to origin.
- The keyless demo works: "Find spaces" gives 8 candidates from the seed, 2 rejected by the listing form check, peak
  11 loops in parallel, the audit passes.

### Next, in this order
1. **Step 7, mode A ("Evaluate an outside listing"):** the user types the same REQUIRED fields as the landlord form
   (rent, monthly costs, area, city, district, term, early exit, indexation, permitted uses, structural repairs) plus
   optional pasted text and an optional lease draft. One listing per evaluation. Code compares the typed form with the
   lease draft (Lease reader) and flags every mismatch with both sources. Never read any outside site.
2. **Step 8, recorded scenarios:** `RecordingRunner` and `ReplayRunner`, `npm run record:demo` (records real model
   answers once, with ANTHROPIC_API_KEY), the "Recorded run" label, and removal of `SUITESPOT_MODE` (live = a key
   exists; `SUITESPOT_ACCESS_CODE` required on the hosted version; recorded scenarios need neither). **Record the
   scenarios right after step 8 is done** (tell Andrej first; it costs a few cents per run).
3. **Step 9, navigation and texts** (labels, empty states, every screen readable by a first-time visitor).
4. **Railway deploy:** one service, `npm run build` then `npm start`. Set `SUITESPOT_ACCESS_CODE` (so a public URL
   cannot spend our key), the three SUPABASE_* values and ANTHROPIC_API_KEY as Railway variables. In Supabase
   (Authentication, URL configuration) set the Site URL and redirect URL to the Railway address.
5. **README** (scored): one-line pitch, hero image, quick start that works keyless, how the agents run concurrently
   (table + Mermaid + Mozaik Cloud screenshot), real vs scripted vs recorded, data is synthetic, not financial advice,
   limits, credits.
6. **Short demo video** (2-3 min) and the link in the README.
7. **Fresh-clone test:** clone into a new folder, follow the README word for word, it must work the first time.
- Optional step 10 (listing check) only if time is left.

### How to run locally (PowerShell)
```powershell
npm install
Copy-Item .env.example .env   # then fill in what you have (see below); never commit .env
npm test
npm run dev
```
- `npm run dev` starts the API on port 3000 and the web app on 5173 (http://localhost:5173). **Stop other local
  projects that use 3000 or 5173 first** (Rook did); otherwise Vite moves to 5174 and the API fails to start.
- **Without any keys** (empty .env): everything runs. Listings come from the local store (the 100 seeded demo
  listings plus `data/local-listings.json`, ignored by git); no accounts, publishing is done as the "Local demo
  landlord"; research runs use scripted demo answers with the fixed demo profile.
- **With `ANTHROPIC_API_KEY` and `SUITESPOT_MODE=live`:** real model runs (claude-haiku-4-5), your own questionnaire,
  "Find spaces" over the whole catalogue. Costs money (about $0.10 for a full run). `SUITESPOT_MODE` disappears in
  step 8 (then a key alone means live).
- **With `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`:** landlord accounts (sign up, log in) and
  listings from the Supabase database instead of the local store. All three must be set for the database; URL + anon
  key alone only turn on accounts.
- Production: `npm run build` then `npm start` (one process serves the web app and the API on PORT).

### Supabase
- Project **SuiteSpot**, organisation **mRtw**, ref **oetcunfrpnjtmcqbdrbn** (region eu-west-1). The Supabase MCP
  in Claude must be connected to an account that is a member of mRtw (it failed once on another account).
- Migrations (applied through the MCP, keep the files in sync with the database):
  `20261126220000_listings_and_contacts.sql` (tables `listings` and `listing_contacts`, domain rules as check
  constraints, RLS on both) and `20261126230000_revoke_rls_auto_enable.sql` (the project's own
  `rls_auto_enable()` is no longer callable by clients; its event trigger still works).
- RLS rules, all verified on 26 Nov with `supabase/checks/rls-checks.sql` (runs in a transaction that is rolled
  back), a negative control and a REST check with the anon key: anon and signed-in users read published listings; the
  owner also reads their own unpublished ones; anon gets "permission denied" on `listing_contacts`; nobody changes,
  deletes or creates demo listings or switches `is_demo` off. Security advisor after the revoke: one warning left,
  "Leaked password protection disabled" (an Auth dashboard setting; decide whether to turn it on).
- `npm run seed:supabase` is idempotent (accounts found by email and reused, rows upserted by id). In the database:
  100 demo accounts (`@example.com`, confirmed, random password nobody knows, `app_metadata.is_demo`), 100 demo
  listings (50 Novi Sad, 50 Beograd, all published), 100 contacts.
- Demo listings are FROZEN: the generator `src/adapters/seed/generate-listings.ts` must not change (its fingerprint
  test fails if it does); scripted answers and tests depend on it.
- **Keys are NOT in the repo.** `.env` is ignored by git. Aleksa gets the Supabase keys privately from Andrej. The
  service role key is server and seed script only: never in the frontend, never in git, never printed.

### Decisions from tonight, with the reason
1. **Two-sided platform, no outside listings.** Reason: the terms of use of 4zida.rs (section 12.2 forbids automated
   use of its system), oglasi.rs (written permission required for copying) and svenekretnine.com (unauthorised
   downloading of listings forbidden) do not allow us to read their listings, neither by fetch nor by web search. So
   listings are published on SuiteSpot itself, and "Find spaces" searches only our own database.
2. **Tenants stay Guest.** Their questionnaire, searches and results live in sessionStorage and disappear when the tab
   closes; they never reach Supabase. Only landlords need an account (they publish and must be accountable).
3. **Contacts in a separate table (`listing_contacts`).** A public read of listings can never leak a phone or an
   email; anon has no access at all; the server reveals a contact only on an explicit "Show contact". On demo listings
   the phone is partly masked ("+381 64 *** ** 37"), labelled "Demo contact", with no tel: or mailto: links, because
   a generated number could belong to a real person.
4. **Launch story.** Before launch the founders agree the first listings with landlords so the platform is not empty.
   In this version all 100 listings and landlords are SYNTHETIC (`is_demo`, labelled "Demo listing"). Never claim they
   are real partners.
5. **Keyless honesty.** Without a key the agents replay scripted demo answers, and every result screen says
   "Scripted demo answers, no AI model". After step 8 the keyless demo replays recorded real runs and says "Recorded
   run". Code still checks every value against its source in both cases.
6. **Rules in code.** Permitted use, budget, locked-in lease and unlimited rent increase are hard flags decided by
   code (with a source), on every evaluation, also for form terms without a lease draft.
7. **Prices are a synthetic assumption** roughly aligned with public 2025-2026 ranges (Kurir Biznis, Biznis.rs):
   medians Novi Sad 10, Beograd 16.2 EUR/m2. Label them that way in the README.

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
- Fixes before step 6 DONE: (1) permitted use is a hard flag in code on every catalogue evaluation
  (`permittedUseExcludes`, rule `permitted_use_excludes_business`, form source; ns049 for a cafe is rejected, tested).
  (2) Every run starts with `research.started {mode, answers}`; result screens show "Scripted demo answers, no AI
  model" (later "Recorded run"). (3) Results: sources collapsed and grouped (listing form, lease draft, questionnaire,
  calculation) with plain field names; amounts in whole units ("2,500 EUR"); lease clauses in plain words, also for
  form terms without a draft; main reason = strongest plus and biggest minus; no rent gives "Can't judge: rent not
  stated" (never the best option); no area gives "· area unknown". (4) Evaluate tab text updated. (5) .gitattributes
  LF in its own commit.
- Step 6 DONE: Supabase project SuiteSpot (ref oetcunfrpnjtmcqbdrbn, org mRtw). Migration
  `supabase/migrations/20261126220000_listings_and_contacts.sql` applied through the Supabase MCP (tables `listings`
  and `listing_contacts`, domain rules as check constraints, RLS on both). Checks (`supabase/checks/rls-checks.sql`,
  rolled back, plus a negative control and a REST check with the anon key): anon and authenticated read published
  listings, the owner also reads own unpublished ones, anon gets "permission denied" on `listing_contacts`, nobody
  changes, deletes or creates demo listings or switches `is_demo` off. Advisors: only `public.rls_auto_enable()`
  (security definer, existed before our migration, not ours; execute revoked from clients afterwards) and two expected
  performance notes. `SupabaseListingStore` (`src/adapters/storage/`): public reads with the anon key, landlord
  reads and writes with the landlord's token (RLS checks ownership a second time), only "Show contact" uses the
  service role key. Used when all three SUPABASE_* values are set. `npm run seed:supabase` (idempotent): 100 demo
  accounts (example.com, confirmed, random unknown password, app_metadata.is_demo) and 100 demo listings (50 Novi
  Sad, 50 Beograd) with 100 contacts.
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

## SUPERSEDED HANDOFF: Aleksa -> Andrej (26 Nov 2026, evening)
SUPERSEDED by the HANDOFF at the top. Kept as history: demo-01..08 fixtures, `npm run demo:*`, `check:listings`, pasting 1 to 8 listings and option D below no longer exist.

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
HISTORY: the conclusion is now final, we read no outside listing site at all (see the HANDOFF at the top).
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

## SUPERSEDED shift handover: Andrej -> Aleksa (26 Nov 2026, 15:05)
SUPERSEDED by the HANDOFF at the top. History only.
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

## SUPERSEDED: state before the two-sided platform (history)
SUPERSEDED by the HANDOFF at the top. Mentions of demo-01..08, pasted listings and SUITESPOT_MODE describe the old version.
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
- See "Next, in this order" in the HANDOFF section at the top.

## Open problems
- Old list in the SUPERSEDED HANDOFF further up (some items no longer apply). Resolved since: the terms of use are read (option D),
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
