import { useSyncExternalStore } from "react"
import { BUSINESS_TYPE_LABELS, CURRENCIES, DEFAULT_SETTINGS, MUST_HAVES, type Settings } from "./profile-types"

/**
 * The business profile, kept in this browser (localStorage). It prefills the questionnaire for live runs. Every
 * storage call is guarded: private windows and blocked storage fall back to the defaults.
 */
export * from "./profile-types"

const positiveOrNull = (value: unknown, allowZero = false): number | null =>
  typeof value === "number" && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0) ? value : null

const STORAGE_KEY = "suitespot.settings.v1"
const listeners = new Set<() => void>()
let cachedSettings: Settings | null = null

function readSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
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
  cachedSettings ??= readSettings()
  return cachedSettings
}

/** Returns false when the browser refused to store them (they still apply until the tab is closed). */
export function saveSettings(next: Settings): boolean {
  cachedSettings = next
  listeners.forEach((listener) => listener())
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
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
