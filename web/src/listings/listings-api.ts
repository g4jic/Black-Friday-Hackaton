// Listings as the server sends them (mirror of src/adapters/server/listing-routes.ts; the web app never imports
// server code). Contacts are never part of a listing: they come only from revealContact.
import { useEffect, useRef, useState } from "react"
import type { BusinessType } from "../app/settings"

export type Indexation = { kind: "none" } | { kind: "cpi" } | { kind: "fixed_rate"; ratePercent: number } | { kind: "landlord_unilateral" }
export type EarlyTermination = { allowed: true; noticeMonths: number } | { allowed: false }

export type ListingInput = {
  title: string
  city: string
  district: string
  street: string
  areaM2: number
  floor: number
  rentMonthly: number
  serviceChargeMonthly: number
  deposit: number
  minimumTermMonths: number
  earlyTermination: EarlyTermination
  indexation: Indexation
  permittedUses: BusinessType[]
  tenantPaysStructuralRepairs: boolean
  leaseDraft: string | null
  description: string | null
  imageUrl: string | null
}

/** leased: the space has a lease (only the flag, never the tenant; demo listings are never leased). */
export type PublicListing = ListingInput & { id: string; isDemo: boolean; createdAt: string; updatedAt: string; currency: "EUR"; leased?: boolean }
export type ContactInput = { phone: string | null; email: string | null; consentToPublish: boolean }
export type RevealedContact = { name: string; phone: string | null; email: string | null; isDemo: boolean; links: boolean }
export type ListingProblem = { field: string; message: string }
export type Session = { backend: "local" | "supabase"; landlord: { id: string; displayName: string; kind: "local" | "supabase" } | null }

export const CITIES = ["Novi Sad", "Beograd"] as const

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly problems: ListingProblem[] = [],
  ) {
    super(message)
  }
}

/** Extra headers for landlord calls (the Supabase access token, once accounts exist). */
let authHeaders: () => Record<string, string> = () => ({})
export function setAuthHeaders(provider: () => Record<string, string>): void {
  authHeaders = provider
}

export async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 204) return undefined as T
  const data = (await response.json().catch(() => ({}))) as { error?: string; problems?: ListingProblem[] }
  if (!response.ok) throw new ApiError(response.status, data.error ?? `Request failed (${response.status})`, data.problems ?? [])
  return data as T
}

export const listingsApi = {
  session: () => call<Session>("GET", "/api/session"),
  list: () => call<{ listings: PublicListing[] }>("GET", "/api/listings").then((r) => r.listings),
  get: (id: string) => call<PublicListing>("GET", `/api/listings/${encodeURIComponent(id)}`),
  revealContact: (id: string) => call<RevealedContact>("POST", `/api/listings/${encodeURIComponent(id)}/contact`),
  mine: () => call<{ listings: (PublicListing & { views: number })[] }>("GET", "/api/me/listings").then((r) => r.listings),
  mineOne: (id: string) => call<{ listing: PublicListing; contact: { phone: string | null; email: string | null } | null }>("GET", `/api/me/listings/${encodeURIComponent(id)}`),
  create: (listing: ListingInput, contact: ContactInput) => call<PublicListing>("POST", "/api/me/listings", { listing, contact }),
  update: (id: string, listing: ListingInput, contact: ContactInput) => call<PublicListing>("PUT", `/api/me/listings/${encodeURIComponent(id)}`, { listing, contact }),
  remove: (id: string) => call<void>("DELETE", `/api/me/listings/${encodeURIComponent(id)}`),
  saved: () => call<{ listings: PublicListing[] }>("GET", "/api/me/saved").then((r) => r.listings),
  save: (id: string) => call<void>("PUT", `/api/me/saved/${encodeURIComponent(id)}`),
  unsave: (id: string) => call<void>("DELETE", `/api/me/saved/${encodeURIComponent(id)}`),
  /** Counts one opening of a listing page; a failure is ignored (it never breaks the page). */
  recordView: (id: string) => call<void>("POST", `/api/listings/${encodeURIComponent(id)}/view`).catch(() => undefined),
}

/** Loads once per key; error is the message to show. */
export function useLoad<T>(key: string, load: () => Promise<T>): { data: T | null; error: string | null; reload: () => void } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null })
  const [version, setVersion] = useState(0)
  const loadedKey = useRef(key)
  useEffect(() => {
    let alive = true
    // A reload of the same data keeps showing the old data until the new arrives (no "Loading..." flash).
    if (loadedKey.current !== key) setState({ data: null, error: null })
    loadedKey.current = key
    load().then(
      (data) => alive && setState({ data, error: null }),
      (error: unknown) => alive && setState({ data: null, error: error instanceof Error ? error.message : "Could not load" }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])
  return { ...state, reload: () => setVersion((v) => v + 1) }
}

export const floorLabel = (floor: number) => (floor === 0 ? "Ground floor" : floor === -1 ? "Basement" : floor === -2 ? "Second basement" : `Floor ${floor}`)

export const indexationLabel = (ix: Indexation) =>
  ix.kind === "cpi" ? "Once a year with the consumer price index" : ix.kind === "fixed_rate" ? `Fixed ${ix.ratePercent}% a year` : ix.kind === "none" ? "No increase during the lease" : "The owner may change the rent at any time"

export const exitLabel = (e: EarlyTermination) => (e.allowed ? `${e.noticeMonths} month${e.noticeMonths === 1 ? "" : "s"} notice` : "The tenant cannot end the lease early")
