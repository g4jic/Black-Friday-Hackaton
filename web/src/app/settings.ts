import { useSyncExternalStore } from "react"
import { currentUser } from "./identity"
import { BUSINESS_TYPE_LABELS, CURRENCIES, DEFAULT_SETTINGS, MUST_HAVES, type Settings } from "./profile-types"

/**
 * The business profile, kept in this browser (localStorage). It prefills the questionnaire for live runs. Every
 * storage call is guarded: private windows and blocked storage fall back to the defaults.
 */
export * from "./profile-types"

const positiveOrNull = (value: unknown, allowZero = false): number | null =>
  typeof value === "number" && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0) ? value : null

/** One profile per account: two accounts in the same browser never see each other's questionnaire. */
const storageKey = () => `suitespot.settings.v1:${currentUser().id}`
const listeners = new Set<() => void>()
let cachedSettings: { key: string; settings: Settings } | null = null

function readSettings(key: string): Settings {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      businessType: parsed.businessType && parsed.businessType in BUSINESS_TYPE_LABELS ? parsed.businessType : DEFAULT_SETTINGS.businessType,
      city: typeof parsed.city === "string" ? parsed.city : DEFAULT_SETTINGS.city,
      monthlyBudget: positiveOrNull(parsed.monthlyBudget),
      currency: parsed.currency && CURRENCIES.includes(parsed.currency) ? parsed.currency : DEFAULT_SETTINGS.currency,
      expectedMonthlyRevenue: positiveOrNull(parsed.expectedMonthlyRevenue, true),
      areaMinM2: positiveOrNull(parsed.areaMinM2),
      areaMaxM2: positiveOrNull(parsed.areaMaxM2),
      leaseMonths: positiveOrNull(parsed.leaseMonths),
      grossMarginPercent: positiveOrNull(parsed.grossMarginPercent),
      districts: typeof parsed.districts === "string" ? parsed.districts : "",
      mustHaves: Array.isArray(parsed.mustHaves) ? MUST_HAVES.filter((m) => parsed.mustHaves!.includes(m)) : [],
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function loadSettings(): Settings {
  const key = storageKey()
  if (cachedSettings?.key !== key) cachedSettings = { key, settings: readSettings(key) }
  return cachedSettings.settings
}

/** Returns false when the browser refused to store them (they still apply until the tab is closed). */
export function saveSettings(next: Settings): boolean {
  const key = storageKey()
  cachedSettings = { key, settings: next }
  listeners.forEach((listener) => listener())
  try {
    window.localStorage.setItem(key, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function useSettings(): Settings {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, loadSettings)
}
