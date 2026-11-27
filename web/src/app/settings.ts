import { useSyncExternalStore } from "react"

/**
 * The default business profile, kept in this browser (localStorage).
 * They prefill the questionnaire for live runs. Every storage call is guarded: private windows and blocked
 * storage fall back to the defaults.
 */
export type BusinessType = "cafe_food" | "retail" | "office_studio" | "workshop"
export type Currency = "EUR" | "RSD" | "USD"

export type Settings = {
  businessType: BusinessType
  city: string
  /** null: not set yet (the questionnaire asks for it) */
  monthlyBudget: number | null
  currency: Currency
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  cafe_food: "Cafe or food",
  retail: "Retail shop",
  office_studio: "Office or studio",
  workshop: "Small workshop",
}

export const CURRENCIES: Currency[] = ["EUR", "RSD", "USD"]

export const DEFAULT_SETTINGS: Settings = { businessType: "cafe_food", city: "Novi Sad", monthlyBudget: null, currency: "EUR" }

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
      monthlyBudget: typeof parsed.monthlyBudget === "number" && parsed.monthlyBudget > 0 ? parsed.monthlyBudget : null,
      currency: parsed.currency && CURRENCIES.includes(parsed.currency) ? parsed.currency : DEFAULT_SETTINGS.currency,
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
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    loadSettings,
  )
}
