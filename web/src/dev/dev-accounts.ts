/**
 * LOCAL DEVELOPMENT ONLY. The three demo accounts that `npx tsx scripts/seed-dev-accounts.ts` writes into the local
 * stores (data/, git-ignored) and that the "Dev: sign in as" buttons on the sign in screen use. They exist only on a
 * machine without Supabase; the production build has neither the buttons nor this file (it is only imported behind
 * `import.meta.env.DEV`). All data is synthetic. Remove before the walkthrough recording (see PROGRESS.md).
 */
export const DEV_PASSWORD = "dev-demo-pass-1"

export const DEV_ACCOUNTS = {
  owner: { email: "demo.owner@example.com", name: "Demo owner", role: "owner" },
  seeker: { email: "demo.seeker@example.com", name: "Demo seeker", role: "seeker" },
  both: { email: "demo.both@example.com", name: "Demo both", role: "both" },
} as const

export type DevAccountKey = keyof typeof DEV_ACCOUNTS
