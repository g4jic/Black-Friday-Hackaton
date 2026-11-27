import { useState } from "react"
import { currentAccount, logIn } from "../app/auth"
import { checkProfileFields, EXAMPLE_PROFILE } from "../app/business-profile"
import { historyStore } from "../app/history-store"
import { startResearch } from "../app/research-store"
import { loadSettings, saveSettings } from "../app/settings"
import { DEV_ACCOUNTS, DEV_PASSWORD, type DevAccountKey } from "./dev-accounts"

/**
 * LOCAL DEVELOPMENT ONLY: "Dev: sign in as owner / seeker / both" on the sign in screen, a shortcut for testing with
 * the demo accounts from scripts/seed-dev-accounts.ts. AuthScreen loads this file only behind import.meta.env.DEV
 * (and only with local accounts), so the production build contains neither the buttons nor the password.
 * The browser half of the demo data is filled here on first sign in: the business profile (seeker, both) and two
 * research runs replayed from the recorded scenarios (free, no model call), which land in History.
 */
export default function DevSignIn() {
  const [busy, setBusy] = useState<DevAccountKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const signIn = async (key: DevAccountKey) => {
    setBusy(key)
    setError(null)
    try {
      await logIn(DEV_ACCOUNTS[key].email, DEV_PASSWORD)
      if (key !== "owner") fillSeekerBrowserData()
    } catch {
      setError("No demo account yet. Run: npx tsx scripts/seed-dev-accounts.ts")
      setBusy(null)
    }
  }

  return (
    <div className="mt-6 rounded-[18px] border border-dashed border-lilac-600 bg-lilac-100/70 px-4 py-3">
      <p className="text-xs font-semibold text-ink">Dev: sign in as (local demo accounts, synthetic data)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(DEV_ACCOUNTS) as DevAccountKey[]).map((key) => (
          <button
            key={key}
            type="button"
            disabled={busy !== null}
            onClick={() => void signIn(key)}
            className="h-8 rounded-full bg-white px-3 text-xs font-semibold text-ink hover:bg-white/70 disabled:opacity-50"
          >
            {busy === key ? "Signing in..." : key}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-hard">{error}</p>}
    </div>
  )
}

/** The business profile and two recorded runs in History, once per browser and account. */
function fillSeekerBrowserData(): void {
  if (loadSettings().monthlyBudget === null) {
    const checked = checkProfileFields(EXAMPLE_PROFILE, { requireAll: true })
    if ("profile" in checked) saveSettings({ ...checked.profile, currency: "EUR" })
  }
  const account = currentAccount()
  if (account && historyStore.list(account.id).length === 0) {
    for (const scenario of ["cafe-novi-sad", "office-beograd"]) void startResearch({ source: "demo", scenario }).catch(() => undefined)
  }
}
