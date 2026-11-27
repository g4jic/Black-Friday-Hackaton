/**
 * Where the app sends a signed-in user before showing a page: plain functions with no browser access, so the rules
 * are tested in Node (tests/onboarding.test.ts). App.tsx applies them.
 */

const HOME = "/"
const ONBOARDING = "/onboarding"

/** Where to go after signing in (and after the onboarding): the page the user wanted (a path inside the app), else Home. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !["/login", "/signup", ONBOARDING].some((p) => next.startsWith(p)) ? next : HOME
}

/**
 * Step 3.5 of the gate (after sign in and the welcome): an account that has not finished the onboarding goes to
 * /onboarding, which remembers the page it wanted; a finished account on /onboarding goes on to that page, so a
 * returning user never sees the onboarding again. null: stay.
 */
export function onboardingRedirect(input: { onboardedAt: string | null; onOnboarding: boolean; here: string; next: string | null }): string | null {
  if (!input.onboardedAt) return input.onOnboarding ? null : `${ONBOARDING}?next=${encodeURIComponent(input.here)}`
  return input.onOnboarding ? safeNext(input.next) : null
}
