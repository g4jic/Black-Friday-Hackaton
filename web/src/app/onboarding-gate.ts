/**
 * Where the app sends a signed-in user before showing a page: plain functions with no browser access, so the rules
 * are tested in Node (tests/onboarding.test.ts). App.tsx applies them.
 */

const HOME = "/"
const ROLE_VALUES = ["owner", "seeker", "both"] as const
export type AccountRole = (typeof ROLE_VALUES)[number]

/**
 * The onboarding answers from Supabase user_metadata (role, onboarded_at). Anything missing or unknown counts as not
 * given, so an account without a role (made before the onboarding, or between the role backfill and a deploy) goes
 * to the role choice instead of breaking.
 */
export function onboardingFromMetadata(meta: Record<string, unknown> | null | undefined): { role: AccountRole | null; onboardedAt: string | null } {
  const role = ROLE_VALUES.includes(meta?.role as AccountRole) ? (meta!.role as AccountRole) : null
  const onboardedAt = typeof meta?.onboarded_at === "string" && meta.onboarded_at ? meta.onboarded_at : null
  return { role, onboardedAt }
}
const ONBOARDING = "/onboarding"

/** Where to go after signing in (and after the onboarding): the page the user wanted (a path inside the app), else Home. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !["/login", "/signup", ONBOARDING].some((p) => next.startsWith(p)) ? next : HOME
}

/**
 * Step 3.5 of the gate (after sign in and the welcome): an account that has not finished the onboarding goes to
 * /onboarding, which remembers the page it wanted; a finished account on /onboarding goes on to that page, so a
 * returning user never sees the onboarding again. The one exception is a form step (?step=seeker or ?step=owner):
 * a finished account opens it to add the other role ("Also find a space" in the avatar menu). null: stay.
 */
export function onboardingRedirect(input: {
  onboardedAt: string | null
  onOnboarding: boolean
  step: string | null
  here: string
  next: string | null
}): string | null {
  if (!input.onboardedAt) return input.onOnboarding ? null : `${ONBOARDING}?next=${encodeURIComponent(input.here)}`
  return input.onOnboarding && !isFormStep(input.step) ? safeNext(input.next) : null
}

export type OnboardingStep = "role" | "seeker" | "owner"
export const isFormStep = (step: string | null): step is "seeker" | "owner" => step === "seeker" || step === "owner"

/** The /onboarding address of a step; next (the page to go on to) and add (adding a role later) are kept. */
export function onboardingPath(step: OnboardingStep, { next, add }: { next: string | null; add?: boolean }): string {
  const query = new URLSearchParams()
  if (step !== "role") query.set("step", step)
  if (add) query.set("add", "1")
  if (next) query.set("next", next)
  const q = query.toString()
  return q ? `${ONBOARDING}?${q}` : ONBOARDING
}
