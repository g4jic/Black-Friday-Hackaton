# Handoff for Aleksa: the onboarding flow

Written 27 Nov 2026, evening, by Andrej + Claude. Read `PROGRESS.md` (HANDOFF at the top) and `CLAUDE.md` first; this
file only covers what you need to build the onboarding flow. No long dashes anywhere; use a plain hyphen.

## 1. What you are building and who waits for you
- **Your task:** a new flow after sign up / sign in where the user answers a few questions, and the answers decide
  their experience in the app (for example: "I am looking for a space" vs "I have a space to rent", and the business
  profile that today lives under Settings).
- **Andrej continues with billing after you.** Billing depends on who the user is (tenant or landlord) and on the
  profile, so it waits for your flow. The plan is in `docs/billing-plan.md`; read section 4 there ("What billing
  needs from onboarding") so your data shape fits it.
- Work on a branch (`wip/onboarding`), merge into `main` only with typecheck and every test green, and push. Tell
  Andrej when it is merged.

## 2. State of the app today (deployed, all features open)
- Live: https://suitespot-production.up.railway.app (Railway project SuiteSpot, service suitespot; deployed from
  Andrej's folder with `npx @railway/cli up --ci`, not from GitHub, so a push does NOT redeploy).
- Since 27 Nov evening:
  - **No access code.** Live research with your own questionnaire is open to every signed-in user. The cost guard is the
    usage limit Andrej set in the Anthropic Console plus one live run at a time per server (a second gets 429).
  - **No "Demo" labels** in the UI. The README and the first card of How it works ("About the data") say that all
    listings, landlords and businesses are synthetic. Only the answer source pill ("Recorded run" / "Scripted demo
    answers") stays, because it says whether a model produced the answers.
  - **Default cursor** (the custom lens cursor is gone).
  - **Nav orange:** the active sidebar item uses `brand-soft` (`#f6857b`), a lighter coral that matches the other
    oranges.
- Every page needs a signed-in user (no guest mode). Accounts: Supabase Auth when the `SUPABASE_*` variables are set,
  otherwise local accounts in `data/local-accounts.json` (fresh clone, keyless).

## 3. Where the onboarding plugs in (exact files)
### 3.1 The gate in `web/src/App.tsx`
The order today:
1. `/login` and `/signup` render `AuthRoute` on their own.
2. While auth is loading: an empty page.
3. Not signed in, or the welcome animation still playing (`useWelcomeHold()` from `web/src/app/welcome.ts`): the
   `AuthScreen` with `next` = the page the user wanted.
4. Otherwise: `Shell` + `Page`.

Add the onboarding as step 3.5: signed in, welcome done, onboarding not finished, so render the onboarding (full screen
like the AuthScreen, or inside the Shell; your design call). When it is finished, go on to `next`.

### 3.2 The welcome animation hands over to you
`web/src/pages/AuthScreen.tsx`:
- `finish()` plays: the map widens, the lens zooms into a space, and a veil (`.auth-veil`, colour `#fbf1f8`) fades in.
- `enterApp()` releases the hold (`holdWelcome(false)`) and calls `navigate(next)`.
- Timings are in `WELCOME`; the CSS is in `web/src/index.css` under `.auth-shell`, `.is-welcome`, `.is-zoom` and
  `.auth-veil`.

If the onboarding should start out of the zoom (a nice transition), make the veil fade into the onboarding instead of
the app. With `prefers-reduced-motion` or a hidden map, `finish()` skips the animation; keep that path working.

### 3.3 Routes in `web/src/app/router.tsx`
A route needs four edits:
1. Add `{ name: "onboarding" }` to the `Route` union.
2. Add `"/onboarding"` to `STATIC_ROUTES`.
3. Add `onboarding: () => "/onboarding"` to `paths`.
4. Add a title in `TITLES` in `App.tsx`. TypeScript fails until all four are done.

### 3.4 What the answers can drive (already built, reuse it)
| Answer | Where it goes today | File |
|---|---|---|
| Business type, city, monthly budget, currency | Settings, kept in localStorage `suitespot.settings.v1`; prefills the questionnaire | `web/src/app/settings.ts`, `web/src/pages/SettingsPage.tsx` |
| The full questionnaire (revenue, area, lease length, margin, fit-out...) | New research form; validated by the domain (`src/domain/profile.ts`) on the server | `web/src/pages/NewResearchPage.tsx` |
| Tenant: find or evaluate | `paths.findSpaces()` / `paths.evaluateSpace()` | `web/src/app/router.tsx` |
| Landlord: publish a space | `paths.newListing()`, `paths.myListings()` | `web/src/listings/` |
| Deals (offers, lease, rent) | `paths.mySpaces()` | `web/src/pages/MySpacesPage.tsx`, `web/src/deals/` |
| Display name | Supabase `user_metadata.display_name` (local accounts: `displayName`) | `web/src/app/auth.ts` |

The sidebar items are in `NAV_ITEMS` in `web/src/app/Shell.tsx`. If the role changes the menu, filter that list
there; do not fork the Shell.

### 3.5 Where to store "onboarding done" and the answers (pick one, write the choice in PROGRESS.md)
| Option | Pros | Cons |
|---|---|---|
| A. localStorage, like `settings.ts` | No server change, works keyless, 30 minutes | Per browser: a new device or a cleared browser asks again |
| B. Supabase `user_metadata` (`client.auth.updateUser({ data: { role, onboardedAt } })`) | Per account, no migration, display_name already lives there | Local accounts need the same field in `src/adapters/auth/local-accounts.ts` and a small `/api/local-auth/profile` route; the user can edit their own metadata, so never use it for anything billing or security decides |
| C. A new `profiles` table (migration in `supabase/migrations/`, RLS, a check in `supabase/checks/rls-checks.sql`) | Clean, server-owned, billing can read it | Most work; Andrej must apply the migration in Supabase; local store needs a twin |

Recommendation: **B for the role and the "done" flag, and keep the business profile in `settings.ts`** (it is only
a prefill). If billing later needs a server-trusted plan, Andrej adds it in his own table (see the billing plan), so
you do not have to build C now.

## 4. Rules you must not break
- **Recorded demo runs.** The keyless jury demo replays recorded model answers matched by an exact hash of the model
  input (`src/adapters/inference/recording-runner.ts`). Do NOT change: domain reason texts, tool outputs, agent
  instructions, the seed (`src/adapters/seed/generate-listings.ts` is FROZEN) or the demo profiles in
  `fixtures/`. If you must, run `npm run record:demo` with a key (about $0.30) and check that
  `tests/recorded-demo.test.ts` passes. UI-only changes are always safe.
- No long dashes in UI, docs, comments or commits.
- Every number in the UI shows its source; "Not financial or legal advice" stays where a user could read advice.
- Never claim the synthetic landlords are real partners.
- `DESIGN.md` is the source of truth for the look; tokens are in the `@theme` block of `web/src/index.css`.
  Unlayered CSS in `index.css` beats Tailwind utilities, so check there when a class "does nothing".
- Keys never in the repo; `.env` is ignored. Do not commit `.claude/launch.json`.

## 5. How to run it
PowerShell, in the repo folder:
```powershell
npm install
```
```powershell
npm run dev
```
Server on http://localhost:3000, web on http://localhost:5173. Without `.env` it is keyless: local accounts, the
recorded demo runs, simulated payments. Andrej sends you the Supabase and Anthropic keys privately if you want
the real accounts or live runs.

Before every push:
```powershell
npm run typecheck
```
```powershell
npm test
```
(227 tests in 31 files on 27 Nov evening.)

## 6. Done means
- A new user signs up, sees the welcome, answers the onboarding, and lands in an app shaped by the answers.
- A returning user who already onboarded goes straight in; a user can change the answers later (Settings).
- Keyless fresh clone still works, every test green, the README "Quick start" still true (add one line about
  onboarding there), PROGRESS.md HANDOFF updated, pushed to `main`.
