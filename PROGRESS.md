# PROGRESS - SuiteSpot

Read this at the start of every session. Update it before every push. Newest entries at the top.
No long dashes in this file; use a plain hyphen.

## Update (27 Nov 2026, night, Aleksa + Claude): dropdowns, collapsible cards, sticky contact, Settings (e96923e, deployed)
- `web/src/Select.tsx` replaces every native select: glass panel portalled to the body (never clipped by a card,
  opens upwards without room below), brand-soft hover, check on the chosen option, "Choose" placeholder, arrows,
  Home/End, Enter/Space, Escape, Tab, first letter, outside click.
- `Card` (Shell.tsx) takes `collapsible`, `id`, `count`: chevron left of the title pill, smooth open and close, state
  per card in sessionStorage, inert when closed. Used on New listing (The space, Money and lease terms, Optional; not
  Contact), Settings, owner Home, Offers and My spaces. The Rejected group in results was already collapsible.
- New listing and the onboarding's List my space: the Contact column with Publish is sticky on wide screens (the page
  scrolls, no inner scroll bar); the onboarding form became two columns on wide screens.
- Settings: Account (avatar, name, email, Sign out), How you use SuiteSpot (three pill switch, black when chosen, one
  sentence on the role), Business profile (seeker, both), Your spaces (owner, both: count and My listings).
- Avatar menu item is "Settings"; cursors drawn at 24 px (arrow about 20 px), hot spot 3 3. A screenshot cannot show
  the system cursor, so its size on screen at 100% and 150% was not checked visually.

## Update (27 Nov 2026, night, Aleksa + Claude): sidebar motion, avatar menu, cursors, local demo accounts
- **UI:** sidebar items lift 2 px on hover or focus (spring back, none with reduced motion); only the avatar under the
  rail (no name); the avatar menu unfolds from the avatar (the avatar travels to the top of the panel), closes on the
  avatar, a click outside or Escape (focus back on the avatar), arrow keys move between items; custom cursors
  (`web/public/cursor.svg`, `web/public/pointer.svg` on everything clickable, hot spot 4 4, text cursor in fields).
- **Local demo accounts (LOCAL DEVELOPMENT ONLY, never production, never Supabase):** `npx tsx scripts/seed-dev-accounts.ts`
  writes Demo owner, Demo seeker and Demo both (synthetic data, password in `web/src/dev/dev-accounts.ts`) into data/
  through the real domain rules; running it again replaces only those three. On the sign in screen, only in `npm run dev`
  with local accounts, "Dev: sign in as owner / seeker / both" (`web/src/dev/DevSignIn.tsx`, loaded lazily behind
  `import.meta.env.DEV`); the first sign in of seeker and both fills the browser half (business profile, two recorded
  runs in History). Checked: the production build contains no "Dev: sign in", no demo password and no demo emails.
  The local listing store now also keeps views and saved spaces in its file (`tests/local-listing-store.test.ts`).
- **Pre walkthrough snimanja obrisati dev prečice i probne naloge.** Exactly how:
  1. Delete `web/src/dev/` (DevSignIn.tsx, dev-accounts.ts) and `scripts/seed-dev-accounts.ts`.
  2. In `web/src/pages/AuthScreen.tsx` remove the `DevSignIn` constant (the `import.meta.env.DEV ? lazy(...)` line and
     its comment), the `{DevSignIn && ...}` block under the form, and `lazy, Suspense` from the react import.
  3. Remove the demo accounts from your machine: stop the server, then delete `data/` (or only the three
     `demo.*@example.com` accounts and their listings and deals), then start again.
  4. `npm run typecheck`, `npm test`, `npm run build`, then check the build:
     `Select-String -Path web/dist/assets/*.js -Pattern "Dev: sign in","dev-demo-pass"` must find nothing.

## Update (27 Nov 2026, night, Aleksa + Claude): two-user deal check, Leased status, deployed (52d7c93)
- **Two real users, locally (keyless, local accounts, simulated payment):** owner publishes, seeker offers from
  Listings, owner accepts under Offers, seeker pays one month (simulated), owner sees it paid and leased. Negative
  checks over the API: answering or withdrawing someone else's offer 403, paying someone else's rent 403, an offer on
  a leased space 409, an offer on your own listing refused by the domain; a third user sees no one else's deals.
  Local note: `.env` has Stripe test keys, so a local run uses Stripe Checkout; blank STRIPE_* for the simulated one.
- **Fixes:** the offer-sent text points to Offers; Owner Home shows Leased for a space with a lease; the public
  listing API adds `leased: true/false` (only the flag, no tenant data; never on demo listings, whose deal loop stays
  open), so Listings and the listing page show a Leased pill and "This space is already leased." instead of the
  offer form. New port method `DealStore.leasedListingIds()` (local and Supabase; Supabase query checked against the
  real database). Test in `tests/deals-api.test.ts`; 263 tests pass.
- **Deployed 52d7c93** from a clean main (an earlier upload with the same code but uncommitted was replaced by this
  one); production: 100 listings carry the flag, none leased (the only tenancy is on demo listing-ns001).

## Update (27 Nov 2026, late evening, Aleksa + Claude): logo, lens buildings, Cloud screenshot, deployed (a9b357c)
- **Logo hover:** the mark is an inline SVG component (`web/src/Logo.tsx`, same drawing as the favicon file); on hover
  the handle and ring turn 12 degrees counter-clockwise around the ring centre (300 ms, soft spring back), the building
  stays still; none with reduced motion. Used in the sidebar, sign in and onboarding.
- **Sign in map:** seven buildings in `web/src/pages/auth-buildings.ts` (the logo's first); each lens stop shows the
  next. The welcome zoom and reduced motion keep the logo's building. All points stay within 112 of the lens centre
  (the ring starts at 144).
- **Mozaik Cloud screenshot** (`design/screenshots/mozaik-cloud.png`, account row cut off): the five AI agents with the
  sum of every live run and recording of 27 Nov. README also gives one live Cafe in Novi Sad run: 31 loops, peak 27,
  6 cut, $0.098 (Finance 8, Location 9, Premises 8, Lease 5, Report writer 1; no Scout in Find spaces).
- **Stripe on the deploy:** Pay rent opens a real Stripe Checkout in test mode (cs_test, "Sandbox"); no card entered;
  the test account and its offer and lease were deleted.
- **Deployed a9b357c** from a clean main and checked: logo hover, buildings changing, sign up to the role choice, a
  recorded scenario; the test account was deleted.

## HANDOFF (27 Nov 2026, evening, Aleksa + Claude): onboarding with roles MERGED and DEPLOYED
- **main = 941d17b** (merge of `origin/wip/stripe`, Andrej's Stripe sandbox key change, fast-forward, then
  `wip/onboarding`, no conflicts). On main: typecheck clean, 262 tests in 34 files pass, including the recorded demo.
- **Fresh clone (27 Nov, Node 24.15, npm 11.12, no .env, no keys in the environment):** `npm install` 16 s, no errors;
  `npm run dev` keyless (local accounts, 3 recorded scenarios); followed the README Quick start word for word: sign
  up, role choice, Find a space, Skip for now, Research, Office in Beograd, Search and evaluate: results with
  "Recorded run". The temporary clone was deleted.
- **Railway: DEPLOYED from Aleksa's folder** (the Railway login is the "Scope | Digital Studio" account; folder linked
  to project SuiteSpot, environment production, service suitespot; `npx @railway/cli up --ci`, "Deploy complete").
  Variables were not changed or read. Checked on https://suitespot-production.up.railway.app: `/api/config` answers
  (live mode, 3 recorded scenarios), Supabase accounts; a new test account signed up, went to the role choice, saved
  "seeker" and onboarded_at in Supabase user_metadata, skipped the profile and ran a recorded scenario (`?autorun=demo`,
  Cafe in Novi Sad, done in 12.6 s, "Recorded run", no model call); no console errors. The test account was deleted
  through the admin API.
- Railway warns that railway.json (Config as Code) works until 2026-12-01; after that its defaults still run npm run
  build and npm start (see the older HANDOFF).

Phases A, B and C below are the details of the onboarding work.

### Supabase role backfill (done 27 Nov, `scripts/backfill-roles.ts`)
Accounts made before the onboarding got a role in `user_metadata` so they skip the role choice: 102 accounts written,
owner 100 (the 100 synthetic demo landlords, each with a listing), both 2 (Aleksa's and Andrej's accounts, named with
`--both`), 0 failures; a second dry run shows 102 with a role. Accounts without a role still go to the role choice
(tested), so an account made between the backfill and the deploy works.

### Phase C (interface by role)
- `web/src/app/roles.ts` (pure, `tests/roles.test.ts`): `navKeysFor(role)` picks the sidebar items from `NAV_ITEMS`
  in `Shell.tsx` (one Shell). Owner: Home, My listings, Add a space, Offers. Seeker: Home, Research, Listings, My
  spaces, History. Both: Home plus the seeker items plus My listings and Offers (Add a space is the button on My
  listings, so the rail stays short). Listings stays with the seeker (browsing is where "Evaluate for my business"
  starts).
- `pageBlockedFor(role, route)`: a page of the other role (typed or old link) goes Home with a notice
  (`/?notice=seeker|owner`, "Open Settings" link, dismiss). Home, a listing page, How it works, Settings and payments
  are open to all.
- Owner Home (`web/src/pages/OwnerHome.tsx`, like OwnerHome.dc.html): "Your spaces", tiles Published spaces, Views
  (all time: SuiteSpot only counts total views, so not "this week"), Open offers (pending), and the My listings table
  (space, rent, views, Published). Both: the seeker Home and "Your spaces" under it.
- New route `/offers` (Offers received and Leased spaces, moved from My listings). Header button: New research for a
  seeker or both, Add a space for an owner. The avatar menu keeps "Also ...", How it works, Settings, Sign out.
- README Quick start has the onboarding step; the landlord side of the deal walkthrough now says Offers.

### Redeploying later
From any team folder on main (pulled): `npx @railway/cli up --ci` after `npx @railway/cli link` to SuiteSpot /
production / suitespot. This change needed no new Railway variables and no Supabase migration (the role lives in
user_metadata).

## Onboarding details (27 Nov 2026, Aleksa + Claude, branch wip/onboarding)
- **Phase A done (role choice):** after sign up, or a sign in while the onboarding is not finished, the welcome veil
  fades into `/onboarding` (no sidebar) instead of the app; the reduced-motion / narrow screen path goes there too.
  Two cards, "List my space" (owner) and "Find a space" (seeker), plus "I do both" (both). A returning user who
  finished it goes straight to the page they wanted. The avatar menu shows "Space owner", "Space seeker" or
  "Owner & seeker" under the email; Settings has "How you use SuiteSpot" to change the role.
- **Storage choice: option B** of the onboarding plan. Supabase: `user_metadata.role` (`owner | seeker | both`) and
  `user_metadata.onboarded_at` (ISO time, set once), next to `display_name`, through `auth.updateUser`. Local accounts:
  the same two fields on the account in `data/local-accounts.json`, saved by `POST /api/local-auth/profile`
  (`{ role?, onboarded?: true }`; unknown role 400, no session 401) and returned by sign in, sign up and `/me`.
  The user can edit their own metadata, so the role only shapes the UI; billing must keep anything that decides money
  in a server-owned table (billing plan section 4).
- Files: `web/src/pages/OnboardingPage.tsx`, `web/src/app/onboarding-gate.ts` (pure rules, tested),
  `web/src/app/roles.ts`, `web/src/app/auth.ts` (`updateOnboarding`), `src/adapters/auth/local-accounts.ts`,
  `tests/onboarding.test.ts`.
- **Phase A matched to Aleksa's mockup** (Main.dc.html, not in the repo): "How will you use SuiteSpot?", "Step 1 of
  2", cards with pills, "I do both. Set up both roles". **No sale anywhere:** SuiteSpot only rents out ("I rent out a
  commercial space"), there is no Offer field.
- **Phase B done (forms):** the card opens a form centred on the screen, no sidebar, "Skip for now" above the card on
  the right, "Fill with example" (synthetic values, with a note that they are an example) at the top right.
  - Find a space: business type, city, preferred districts, area from/to, max monthly cost, expected revenue, gross
    margin (optional), lease term, Must have chips. Same rules as the domain (`web/src/app/business-profile.ts`,
    `tests/business-profile.test.ts` checks each case against `BusinessProfile.create`). Saved in `settings.ts`
    (localStorage) and it prefills the questionnaire. **Decision (Aleksa):** Must have and Preferred districts go
    into the business description ("What your business does"), which the live agents read; Move-in date is left
    out (nothing uses it). The recorded demo is unchanged (it uses the fixed demo profiles; its tests pass).
  - List my space: `ListingTermsFields` (new `variant="plain"`, the same fields as List a space) plus lease draft and
    contact; it publishes a real listing. **Decision (Aleksa):** Storefront window and Parking become words in the
    listing description (`web/src/app/space-extras.ts`), which the Premises inspector reads.
  - "I do both": Find a space (step 2 of 3), then List my space (step 3 of 3). Skip moves to the next step; the last
    step saved or skipped finishes the onboarding. Save goes to Find spaces, Publish to My listings, Skip to the page
    the user wanted.
  - Avatar menu like OwnerHome.dc.html: avatar, name, email, role pill, "Also find a space (add Space seeker)" or
    "Also list a space (add Space owner)" (opens that form with `?add=1`), "Settings · role and profile". Settings
    shows the role and the same business profile fields (hidden for an owner only).
- Phase C: see the HANDOFF above.

## HANDOFF (27 Nov 2026, late evening, Andrej + Claude): READ THIS FIRST
Changes since the handoff below (commit 39f5f9c, deployed and checked on Railway):
- **Every feature is open: the access code is gone** (server, web, tests, scripts, `.env.example`; the Railway
  variable SUITESPOT_ACCESS_CODE is deleted). Cost guard: the usage limit in the Anthropic Console plus one live run
  at a time per server (429). On the deploy `/api/config` says `liveAvailable: true` and the questionnaire form is
  enabled. No paid run was made for the check.
- **No "Demo" labels in the UI** (Demo data, Demo listing, Demo contact pills removed). The README and the first card
  of How it works ("About the data") state that all data is synthetic. The answer source pill ("Recorded run" /
  "Scripted demo answers") stays. Deal texts say "simulated landlord".
- **Default cursor** again (the lens cursor CSS and `web/public/cursor-lens*.svg` are removed).
- **Nav orange:** active sidebar item (and the avatar while Settings is open) use the token `brand-soft` `#f6857b` (DESIGN.md 3.1).
- Where the handoff below still says "access code", "Demo listing" or "dot cursor", this entry wins.

## HANDOFF (27 Nov 2026, evening, Andrej + Claude)
Superseded by the entry above where they differ. Blocks A, B, C and D of the work order are done: merged, deployed, README and
submission text written (`SUBMISSION.md`). Submissions close at midnight CET. What is left is listed under "Left".

### Exact state
- **main** holds everything (merges e5a1a61 wip/agents, 97ddfb5 wip/ui, e742e02 wip/deals). Typecheck clean, 227
  tests in 31 files pass. The wip/* branches are merged and need no more work.
- **Block A (agents):** rent share of revenue rule, noise vs land use (OSM land use in `fixtures/osm/seed-areas.json`,
  56 of 59 addresses), bad year / good year, lease or buy (`src/domain/lease-or-buy.ts`). Demo runs re-recorded with
  the real model (`fixtures/recordings/*.json`). `npx tsx scripts/cut-report.ts` prints the hard flag cuts and the
  audit counts; "For the video" below has the table.
- **Block B (UI):** sign in required (local accounts in `data/local-accounts.json` when SUPABASE_* are empty, Supabase
  otherwise), How it works page (replaces Assumptions), one Research menu (Find spaces default tab, Evaluate a space),
  plain texts, "How your research ran" timeline, run animation, dropdowns. Since the evening: a welcome after sign in
  (the map widens over the window, zooms into a space, a veil fades into the app; the sign in screen is held while it
  plays, `web/src/app/welcome.ts`) and a minimal dot cursor (`web/public/cursor-lens*.svg`).
- **Block D (deals):** offer, accept or decline, lease with rent due dates on both sides, rent payment through one port
  (`src/application/payments/payment-gateway.ts`) with two adapters: Stripe Checkout in test mode when
  `STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_PUBLISHABLE_KEY=pk_test_...` are set (live keys refused), otherwise a
  simulated checkout labelled "Simulated payment, no real money" (reference `simulated:<uuid>`). On a demo listing the
  tenant answers the offer as the simulated demo landlord, so the jury can run the whole loop alone with no key.
  Domain in `src/domain/deal.ts`, service `src/application/deals/deal-service.ts`, routes
  `src/adapters/server/deal-routes.ts`, UI `web/src/deals/`.
- **Supabase:** migration `supabase/migrations/20261127150000_offers_tenancies_payments.sql` is APPLIED (Andrej, 27 Nov
  evening) and `supabase/checks/rls-checks.sql` passed ("all RLS checks passed"). Its `do $$ ... end $$;` blocks from
  line 93 were fixed (they had a single `$`).
- **Railway: DEPLOYED** at https://suitespot-production.up.railway.app (project SuiteSpot in the workspace
  "Scope | Digital Studio", service suitespot, deployed with `npx @railway/cli up` from this folder, not from GitHub:
  redeploy after a push with `npx @railway/cli up --ci`). Variables: ANTHROPIC_API_KEY, SUITESPOT_ACCESS_CODE (Andrej
  has the value, never in the repo), SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Health "live", demo
  Office in Beograd run checked on the deploy (10.1 s, 32 loops, peak 30). Railway says railway.json works until
  2026-12-01; after that its defaults still run npm run build and npm start.
  Supabase Auth is connected to the Railway address (Andrej). Tested on the deploy with Andrej's account: the three
  demo scenarios, results, report, timeline, a space page, How it works, Settings, History, Listings, My listings and
  the full deal loop (offer on listing-ns001, accept as demo landlord, December 2026 paid, simulated). No console errors.
  Fixed from that test: a visitor without the access code now gets the recorded demo scenarios (before, the jury saw a
  disabled live form), no "Loading..." flash on reload, demo offer text, "SuiteSpot" in reasons, unknown points match
  the score range.
- **Fresh clone (27 Nov evening, Node 26, npm 11.20, no .env):** npm install 21 s (npm 11 warns that install scripts
  were skipped; nothing breaks), 227/227 tests, typecheck, build, `npm start` keyless and a Shop in Novi Sad demo run
  with an audit of 0 removed. Ports 3000 and 5173 were taken by another project, so dev mode was not run from the clone.
  A run with a key from the clone was not made (it costs money); the deploy runs in live mode.
- **Mozaik Cloud screenshot:** `design/screenshots/mozaik-cloud.png` is the older one (before Location analyst and
  Premises inspector). A new one needs a sign in at app.jigjoy.ai; optional.

### Keyless run metrics (replayed 27 Nov evening, no key)
| Scenario | Duration | Agent loops | Peak in parallel | Rejected | Loops cut | Audit |
|---|---|---|---|---|---|---|
| Cafe in Novi Sad | 12.6 s | 31 | 27 | 2 | 6 | 11 checked, 0 corrected, 0 removed |
| Office in Beograd | 10.0 s | 32 | 30 | 2 | 5 | 10 checked, 0 corrected, 0 removed |
| Shop in Novi Sad | 7.3 s | 29 | 28 | 4 | 10 | 10 checked, 0 corrected, 0 removed |

### Left
- Optional: a new Mozaik Cloud screenshot (sign in at app.jigjoy.ai, run one live scenario, save it as
  `design/screenshots/mozaik-cloud.png`), the demo video link in the README, and submitting `SUBMISSION.md` in the form.
- Known wording left on purpose (changing it changes the recorded model input, so it needs `npm run record:demo`,
  about $0.30): "1 cafes, restaurants and bars" and "but location" in a reason, "1 industrial buildings", and "Exit
  after 12 months: Needs lease terms" when only the notice period is missing.
- The simulated checkout keeps open checkouts in memory: a redeploy while someone is on the payment page loses that
  checkout (press Pay rent again); paid months are stored.

### Done steps of block C (kept for the record)
1. **C2 README:** new features (sign in, How it works, rent share, noise and land use, bad year / good year, lease or
   buy, Location analyst and Premises inspector rows in the agent table, deals with payment), the metrics table above,
   the keyless jury walkthrough (offer, accept as demo landlord, lease, simulated payment, status on both sides), the
   sentence "Stripe test mode demonstrates the flow; Stripe does not support businesses registered in Serbia, so
   production would use a local payment processor", the deals migration in the Supabase steps, "Payments: not built"
   and the "Not built: OpenStreetMap, offers, payments" lines removed, npm 11 install scripts note in Troubleshooting.
2. **C1 Railway (Andrej does the manual parts):** set an Anthropic spending limit first; `npx @railway/cli login`;
   variables ANTHROPIC_API_KEY, SUITESPOT_ACCESS_CODE, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   (optional STRIPE_* test keys); Supabase Auth: Site URL and redirect URL = the Railway address, and turn off
   "Confirm email" (the default Supabase mail sender would block jury sign ups); then check the full deal loop on the
   deploy and put the link in the README.
3. Fresh clone test (no .env, then with a key), Mozaik Cloud screenshot if time allows.
4. **C3** submission text (name, repo, description, how the agents run concurrently). **C4** final handoff and push.

### Run without a key (PowerShell)
`$env:ANTHROPIC_API_KEY=' '; npm run dev` (with the key in `.env`, plain `npm run dev` runs LIVE and costs money).
Rook (another project) may hold ports 3000 and 5173; close it first.

## HANDOFF (27 Nov 2026, ~13:00, Aleksa -> Andrej): READ THIS FIRST
Supersedes the "main is untouched (2db1917)" line in the handoff below; the phase details below are still valid.

### Branches
- **main = 45d150f.** New logo in the sidebar and as the favicon, plus the sign in concept (docs only). Typecheck
  clean, 180 of 180 tests pass, keyless Office in Beograd run checked in the browser with no console errors.
- **wip/agents = this commit**, on top of the merge of main (1309c24). Phases 1 (Location analyst) and 2 (Premises
  inspector) done and wired. Typecheck clean; 197 of 200 tests pass; only `tests/recorded-demo.test.ts` (3 tests)
  fails until the demo runs are re-recorded (phase 4).
- **design/logo = 45d150f** (same as main): logo files in `design/brand/`, sign in concept in `design/login/`.

### Run without a key (PowerShell)
`.env` may hold ANTHROPIC_API_KEY, and then plain `npm run dev` runs LIVE (costs money). Keyless:
`$env:ANTHROPIC_API_KEY=' '; npm run dev` (a blank value counts as set, so dotenv does not load the key).

### Next steps, in order
1. **Phase 3 (about 45-60 min):** rent to revenue rule in the Ranker (code), the threshold as a labelled ASSUMPTION
   on the Assumptions screen, no revenue = MissingData. In the same phase reword the misleading Location text: "the
   address was not found in OpenStreetMap" (`web/src/results/CandidatePage.tsx` and `COMPONENT_MISSING` in
   `web/src/results/results-model.ts`) also shows when only the recording is missing.
2. **Phase 4:** `npm run record:demo` (about $0.30, needs ANTHROPIC_API_KEY in `.env`); the audit must have 0
   removed; check that Office in Beograd (Voždovac) and Shop in Novi Sad still cut Finance mid-run (more than 1 s);
   if the mid-run cut disappears, tell Aleksa before committing; new "For the video" table; Mozaik Cloud screenshot;
   README. Merge wip/agents into main only if EVERYTHING passes.
3. **Feature freeze 18:00.** If phases 3 and 4 are not done by about 17:00, main stays as it is and the time goes to
   the video, the README and a clean clone check.

### Decisions to explain to the jury
- `pointsToCheck` on `CandidateScore`: premises concerns are not scored twice (they are in `checks.notCountedTwice`),
  but they block a Good verdict (`src/domain/verdict.ts` needs `pointsToCheck === 0`).
- Weights: cost 35, area 15, lease 15, location 10, premises 10, checks 15 (sum 100, tested).

### Sign in page (optional, a new feature: only if there is time before 18:00)
Concept in `design/login/` and DESIGN.md 7.5.
- Left: white glass card, logo + "SuiteSpot" top left, "Welcome back", email, password, black "Sign in", "Continue as
  guest", "Don't have an account? Sign up", footer "© 2026 SuiteSpot · Not financial or legal advice". No "Remember
  me" and no "Forgot password" until we check that our Supabase sign in supports them.
- Right: animated map in the DESIGN.md colours that slides slowly; the magnifying glass from the logo stops over the
  coral dots (listings), the building from the logo pops up with a pill naming the listing; pills "Demo data" and
  "100 synthetic listings".
- Build suggestion: SVG + CSS/JS animation, `prefers-reduced-motion` = a static image. The existing auth routes and
  logic do not change.

### Video
`design/brand/suitespot-logo-reveal.mp4` is the intro (7 s, 1920x1080, no sound, as delivered by Aleksa). The best
scenario for a mid-run cut is still Office in Beograd (see "For the video" below).

## HANDOFF (27 Nov 2026, branch wip/agents, Aleksa -> Andrej): phase 1 and 2 details
Aleksa ran out of limit mid-phase. **main is untouched** (last good: 2db1917, all tests pass there, keyless demo works).
Everything below is on the branch `wip/agents`, committed even though tests do not all pass. Do not merge it into
main until the steps below are done. Feature freeze 18:00, submissions close at midnight.

### The plan (Aleksa's prompt, phase by phase; after each phase: tests + typecheck, commit and push to main if they
pass, with a PROGRESS entry; if a phase fails, revert it)
- **Phase 0 (done, no changes):** a table of all criteria (who checks them, whether they affect the score, or not
  built). It was shown in chat; the short version: built = budget, permitted use, locked in, unlimited increase (hard
  flags, code), area, lease terms, soft lease concerns, typed-vs-text mismatch, ranges/confidence/tier, verdict,
  sources, audit. Not built = rent share of revenue threshold (phase 3), location (phase 1), premises (phase 2),
  hard requirements, fair-price estimate, in-listing contradictions.
- **Phase 1, Location analyst:** CODE gets OpenStreetMap data (Nominatim for coordinates, Overpass counts within
  300 m): same business type (competition), public transport, schools/faculties, offices, parking. Follow the OSM
  usage policies (User-Agent, at most 1 request per second to Nominatim, cache). Normalise the address before
  geocoding ("grbavici" -> "Grbavica, Novi Sad"). For the 100 seed listings the data is fetched once and stored in
  fixtures (public OSM data, attribution "© OpenStreetMap contributors, ODbL"), so keyless and tests run without the
  network. Live lookups only for an outside listing. The AI agent (Location analyst) explains the numbers for the
  business from the questionnaire, source "osm"; it never estimates revenue or foot traffic. The Ranker gets a
  "location" part with a weight; missing data goes into the range like everything else.
- **Phase 2, Premises inspector:** an AI agent reads the listing and the lease draft and reports what suits the
  business: floor, storefront, parking, heating, ventilation/drain for a cafe or food, renovation needed,
  accessibility. Every claim with a quote (the same buildX principle). What is not stated is MissingData. Only soft
  flags and a "premises" part of the score; CODE decides what is a flag.
- **Phase 3, rent to revenue:** a rule in the Ranker (code): monthly cost as a share of expected revenue. The
  threshold is a clearly labelled ASSUMPTION on the Assumptions screen (for example above 15% gives a soft flag). No
  revenue given: MissingData.
- **For all phases:** on every candidate.found Finance, Lease, Location and Premises run in parallel; a hard flag
  still stops every loop of that candidate. New weights in RANKING_ASSUMPTIONS and on the Assumptions screen; rank by
  verdict, then by the low end, stays. Report writer and Auditor cover the new facts. The schema-rules test covers
  the new schemas. Tests without a key and without the network. UI: new Timeline lanes, new reasons and sources
  (osm) on the candidate page.
- **Phase 4:** re-record the 3 scenarios (npm run record:demo) and check the audit has 0 removed. Check that Office in
  Beograd (Voždovac) and Shop in Novi Sad still cut Finance MID-RUN (more than 1 s) and update the video section
  below with the new times; if the mid-run cut disappears, tell Aleksa before committing. One live run for a new
  Mozaik Cloud screenshot. Update the README (agent table, Mermaid, P4 note, limitations) and the screenshots.
  Commit and push.

### Where each phase stopped
**Phase 1: code done, data incomplete, NOT committed to main.**
- Done and tested (keyless, offline): `src/domain/location.ts` (AreaData with osm sources, LOCATION_ASSUMPTIONS per
  business type, scoreLocation, normalizeDistrict: "grbavici", "na Grbavici", "Limanu 2" -> known district);
  `src/adapters/osm/osm-client.ts` (Nominatim + Overpass, User-Agent, Nominatim 1.1 s gap, Overpass 2.5 s gap,
  45 s timeout, cache per address, falls back from overpass-api.de to maps.mail.ru, remembers the one that works);
  `src/adapters/osm/area-lookup.ts` (fixture for seed listings, live OSM only for other listings and only in live
  mode); `src/application/agents/location-analyst.ts` (one loop per candidate, tool area_data, explanation checked
  number by number, cancelled by hard flags like the others); Ranker weights now cost 40, area 15, lease 20,
  location 10, checks 15 (`src/domain/ranking.ts`); Report writer gets an OSM fact per ranked candidate; Assumptions
  screen shows the location rules and the ODbL attribution; Timeline and orbit have the Location analyst; candidate
  page has a Location card; `tests/location.test.ts` and `tests/fixtures/sample-areas.ts` (synthetic counts).
- **Not done: the fixture `fixtures/osm/seed-areas.json` does not exist yet.** `scripts/fetch-osm.ts` was stopped at
  44 of 59 distinct seed addresses (it writes the JSON only at the end). Its log is in
  `fixtures/osm/seed-areas.partial.txt` (counts per address, no coordinates). On 27 Nov overpass-api.de answered 502
  and overpass.kumi.systems / overpass.private.coffee timed out; only maps.mail.ru worked, at 15 to 90 s per address.
  Next step: run `npx tsx scripts/fetch-osm.ts` again (about 20 to 60 minutes; Nominatim is fast). Improvement worth
  doing first: make the script write the JSON after every address and skip addresses already in the file, so a
  stop loses nothing. Without the fixture every seed candidate has location "not checked" (range of 10 points,
  confidence medium), which also changes the verdicts in the demo.
- Tests on this branch: everything passes except `tests/recorded-demo.test.ts` (3 tests): the new agent makes model
  requests that are not in the recordings. Fix: after the fixture exists, `npm run record:demo` (about $0.30,
  needs ANTHROPIC_API_KEY), then run all tests. Typecheck is clean for phase 1 alone.

**Update (27 Nov): the OSM fixture `fixtures/osm/seed-areas.json` is now COMPLETE (59 of 59 seed addresses, all 100 listings; the resumable `scripts/fetch-osm.ts` reused the 44 logged counts and fetched the last 15), and `tests/location.test.ts` passes 10 of 10 including the fixture coverage test; the recorded-demo test still fails until `npm run record:demo` after phase 2.**

**Phase 2: DONE and wired (27 Nov, Aleksa + Claude).** Typecheck clean; 197 of 200 tests pass; only the 3 tests in
`tests/recorded-demo.test.ts` fail, on purpose, until the re-recording in phase 4.
- Wired: export from `src/domain/index.ts`; `SuiteSpotState.premises` + `recordPremises` (idempotent); agent in
  `research-session.ts`, its events in PASS_THROUGH; "premises" part in `scoreCandidate` with its own range
  (`ScoreComponent.valueHigh`); weights cost 35, area 15, lease 15, location 10, premises 10, checks 15 (sum 100,
  tested); Assumptions screen shows the weight and a "Premises rules" card.
- Rules (tested): the agent only reports facts with quotes; code checks every quote against the listing or lease text
  (`premises.extraction_rejected`, one retry, then unverified fields become missing data); code (`evaluatePremises`)
  decides the soft flags per business type; never a hard flag; an unmentioned check is MissingData and widens the
  range; premises not read at all lowers confidence like a missing location.
- Decision: premises concerns are in `checks.notCountedTwice` (not scored twice), but `CandidateScore.pointsToCheck`
  counts them, and a Good verdict needs `pointsToCheck === 0` (domain/verdict.ts). Old cases behave the same.
- Keyless scripted answers (`premisesDemoScript` in `demo-script.ts`): fixed phrases found in the text, copied as
  quotes, with negation ("Bez izloga" = no storefront).
- UI: `building-2` agent in AGENTS and ORBIT_AGENTS (Timeline lane comes from AGENTS), "The space" card on the
  candidate page (each check with its quote, what to check before signing, what is not stated), premises item in
  "What is unknown". The card with real data was checked by a unit test (`tests/results-model.test.ts`), not seen in
  the browser yet (recorded runs have no premises answers).
- Tests: `tests/premises-agent.test.ts` (4 loops in parallel per candidate, quotes in the text, concerns reach the
  report as "check" facts and pass the Auditor, invented quote rejected, a hard flag from the Lease reader cuts the
  Premises loop and its result never arrives), `tests/fixtures/sample-premises.ts`, updates in ranking, verdict,
  location, schema-rules, results-model.
- Browser check (keyless, all 3 Find spaces scenarios): no console errors, Premises lanes and "cut" marks on the
  Timeline. As expected the recorded run is incomplete: the report says "Provider error: this request is not in the
  recording", every candidate is Low confidence, the space card says "has not read this listing". Also (from phase 1)
  the Location card then says "address not found in OpenStreetMap" although the real cause is the missing recording;
  it goes away after re-recording, but the wording is misleading.
- Local run note: `.env` has ANTHROPIC_API_KEY, so plain `npm run dev` runs LIVE. For a keyless run in PowerShell:
  `$env:ANTHROPIC_API_KEY=' '; npm run dev` (a blank value is "set", so dotenv does not load the key; the server sees
  no key and runs the demo).

**Next, in this order:** Phase 3 (rent share of revenue rule in the Ranker, threshold as a labelled ASSUMPTION on the
Assumptions screen, no revenue = MissingData; about 45-60 min), then Phase 4 (`npm run record:demo`, about $0.30;
check audit 0 removed and the mid-run cuts for the video; README, screenshots; about 1.5 h). Then merge into main only
when all tests pass.

**Phase 3 and Phase 4: not started.**

### Recommendation if time is short
Main already works and is fully documented. If phases 1-2 cannot be finished, verified and re-recorded before 18:00,
leave main as it is and spend the time on the video and the Railway deploy. Never merge wip/agents with failing
recorded tests: the keyless demo would break for the jury.

## For the video (Andrej): which scenario shows a hard flag cutting a running agent
Re-checked on 27 Nov afternoon after re-recording all three scenarios (A1 to A4 changed the model input), by replaying
them at the app's own replay speed with no key: `npx tsx scripts/cut-report.ts`. Audit of every report: 0 corrected,
0 removed (cafe 11 claims checked, office 10, shop 10). "Form check" rejections happen in the first milliseconds (code
reads the listing form terms), so their Finance loop is cut before its first model call. The ones to show are the cuts
raised by the **Lease reader** while the Finance analyst is already working on the same candidate:

| Scenario | Candidate | Raised by, rule | Finance analyst ran before the cut | Where it stopped |
|---|---|---|---|---|
| Cafe in Novi Sad | Detelinara 69 m2 (listing-ns024), Adice 84 m2 (listing-ns040) | Listing form check, locked_in_without_exit | 7-9 ms | before inference |
| **Office in Beograd** | **Voždovac, Vojvode Stepe, 51 m2 (listing-bg004)** | **Lease reader, unlimited_rent_increase** | **about 4.6 s (1 tool call)** | **before its next tool call** |
| Office in Beograd | Banovo brdo 63 m2 (listing-bg011) | Listing form check, unlimited_rent_increase | 8 ms | before inference |
| Shop in Novi Sad | Liman 1, Fruškogorska, 83 m2 (listing-ns044) | Lease reader, locked_in_without_exit | about 3.7 s (1 tool call) | before its next tool call |
| Shop in Novi Sad | Centar, Laze Telečkog, 47 m2 (listing-ns002) | Lease reader, locked_in_without_exit | about 3.7 s (1 tool call) | before its next tool call |
| Shop in Novi Sad | Adice 84 m2 (listing-ns040), Telep 76 m2 (listing-ns014) | Listing form check, locked_in_without_exit | 4-6 ms | before inference |

**Best for the video: Office in Beograd, candidate "Voždovac · 51 m2".** Its Finance bar runs for about 4.6 seconds,
the Lease reader finds that the landlord may raise the rent without a limit, and the bar ends in the red X with
"stopped"; the dashed red line and "Deal breaker: Voždovac · 51 m2 ruled out" sit above it. In the run view it is
listed under "Ruled out" with the reason. Second choice: **Shop in Novi Sad**, where two candidates are cut by the
Lease reader at about the same moment (3.7 s), which shows two cuts in parallel. The cafe scenario has no mid-run cut
(both rejections come from the form check), so do not use it for this shot.
Suggested order: Research, Find spaces, pick Office in Beograd, Search and evaluate; film the run (agents on the path,
counter "agent tasks running now"); then Results, Timeline tab ("How your research ran"), point at the Voždovac lane;
then the Report tab ("Every number checked against its source"); end on the Mozaik Cloud screenshot in the README.

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
