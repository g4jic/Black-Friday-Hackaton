import type { SupabaseClient } from "@supabase/supabase-js"
import { useSyncExternalStore } from "react"
import { setAuthHeaders } from "../listings/listings-api"
import { onboardingFromMetadata } from "./onboarding-gate"

/**
 * Accounts. Every user signs in (there is no guest mode). With Supabase on the server: email and password through
 * Supabase Auth, and every request carries its access token. Without Supabase (for example a fresh clone with no
 * keys): local accounts kept by this server in a file on this machine only (mode "local", labelled in the UI); the
 * session token is kept in this browser's localStorage.
 */
/** What the user chose in the onboarding (UI only: never decides money or access). null until chosen. */
export type Role = "owner" | "seeker" | "both"
export const ROLES: readonly Role[] = ["owner", "seeker", "both"]
export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role)

export type Landlord = {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: Role | null
  /** When the onboarding was finished (saved or skipped); null: show the onboarding. */
  readonly onboardedAt: string | null
  /** The profile photo (stored by our server), or null: the first letter of the name is shown. */
  readonly avatarUrl: string | null
  /** Supabase only: a new email that waits for the user to confirm it from the link in their inbox. */
  readonly pendingEmail: string | null
}
export type AuthMode = "supabase" | "local"
export type AuthState = { readonly status: "loading" | "ready"; readonly enabled: boolean; readonly mode: AuthMode; readonly landlord: Landlord | null }

let state: AuthState = { status: "loading", enabled: true, mode: "local", landlord: null }
let client: SupabaseClient | null = null
let token: string | null = null
const listeners = new Set<() => void>()
const LOCAL_TOKEN_KEY = "suitespot.localSession"

function set(next: Partial<AuthState>): void {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

/** The header for requests that need the signed-in user. */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

setAuthHeaders(authHeaders)

type SessionLike = { access_token: string; user: { id: string; email?: string; new_email?: string; user_metadata?: Record<string, unknown> } } | null

/** Only a photo address our own server handed out is shown (user_metadata is editable by its user). */
function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  if (value.startsWith("/api/avatars/")) return value
  return /^https:\/\/[^/]+\/storage\/v1\/object\/public\/avatars\//.test(value) ? value : null
}

function applySession(session: SessionLike): void {
  token = session?.access_token ?? null
  const user = session?.user
  const meta = user?.user_metadata ?? {}
  const name = typeof meta.display_name === "string" ? meta.display_name.trim() : ""
  // Option B of the onboarding plan: role and onboarded_at live in Supabase user_metadata, next to display_name.
  const { role, onboardedAt } = onboardingFromMetadata(meta)
  set({
    status: "ready",
    landlord: user
      ? { id: user.id, email: user.email ?? "", displayName: name || user.email || "Account", role, onboardedAt, avatarUrl: safeAvatarUrl(meta.avatar_url), pendingEmail: user.new_email || null }
      : null,
  })
}

const readLocalToken = (): string | null => {
  try {
    return window.localStorage.getItem(LOCAL_TOKEN_KEY)
  } catch {
    return null
  }
}
const writeLocalToken = (value: string | null): void => {
  try {
    if (value) window.localStorage.setItem(LOCAL_TOKEN_KEY, value)
    else window.localStorage.removeItem(LOCAL_TOKEN_KEY)
  } catch {
    // storage blocked: the session lasts until the page is closed
  }
}

type LocalAccount = { id: string; email: string; displayName: string; role?: unknown; onboardedAt?: unknown; avatarUrl?: unknown }

function applyLocal(newToken: string | null, account: LocalAccount | null): void {
  token = newToken
  writeLocalToken(newToken)
  set({
    status: "ready",
    landlord: account
      ? {
          id: account.id,
          email: account.email,
          displayName: account.displayName,
          role: isRole(account.role) ? account.role : null,
          onboardedAt: typeof account.onboardedAt === "string" ? account.onboardedAt : null,
          avatarUrl: safeAvatarUrl(account.avatarUrl),
          pendingEmail: null,
        }
      : null,
  })
}

async function localRequest(path: string, body?: unknown): Promise<{ token: string; account: LocalAccount }> {
  const response = await fetch(`/api/local-auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body ?? {}) })
  const data = (await response.json().catch(() => ({}))) as { token?: string; account?: LocalAccount; error?: string }
  if (!response.ok || !data.token || !data.account) throw new Error(data.error ?? "The account could not be reached. Try again.")
  return { token: data.token, account: data.account }
}

async function init(): Promise<void> {
  try {
    const config = (await (await fetch("/api/auth-config")).json()) as { enabled: boolean; local?: boolean; url?: string; anonKey?: string }
    if (config.local || !config.url || !config.anonKey) {
      set({ enabled: true, mode: "local" })
      const saved = readLocalToken()
      if (!saved) return applyLocal(null, null)
      const me = await fetch("/api/local-auth/me", { headers: { Authorization: `Bearer ${saved}` } })
      const body = (await me.json().catch(() => ({}))) as { account?: LocalAccount }
      return me.ok && body.account ? applyLocal(saved, body.account) : applyLocal(null, null)
    }
    const { createClient } = await import("@supabase/supabase-js")
    client = createClient(config.url, config.anonKey)
    set({ enabled: true, mode: "supabase" })
    client.auth.onAuthStateChange((_event, session) => applySession(session))
    applySession((await client.auth.getSession()).data.session)
  } catch {
    set({ status: "ready", enabled: true, mode: "local", landlord: null })
  }
}
void init()

export async function signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }> {
  if (state.mode === "local") {
    const r = await localRequest("sign-up", { email, password, displayName })
    applyLocal(r.token, r.account)
    return { needsConfirmation: false }
  }
  const { data, error } = await client!.auth.signUp({ email, password, options: { data: { display_name: displayName.trim() } } })
  if (error) throw new Error(error.message)
  return { needsConfirmation: !data.session }
}

export async function logIn(email: string, password: string): Promise<void> {
  if (state.mode === "local") {
    const r = await localRequest("sign-in", { email, password })
    return applyLocal(r.token, r.account)
  }
  const { error } = await client!.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function logOut(): Promise<void> {
  if (state.mode === "local") {
    await fetch("/api/local-auth/sign-out", { method: "POST", headers: authHeaders() }).catch(() => undefined)
    return applyLocal(null, null)
  }
  if (client) await client.auth.signOut()
  applySession(null)
}

/**
 * Saves the onboarding answers on the account: the role and, when the last step is saved or skipped, that the
 * onboarding is done (kept the first time). Supabase: user_metadata (role, onboarded_at); local accounts: the
 * server's account file. Both are UI preferences the user may edit, never a basis for billing or access.
 */
export async function updateOnboarding(change: { role?: Role; onboarded?: true }): Promise<void> {
  const current = state.landlord
  if (!current) throw new Error("Sign in first.")
  if (state.mode === "local") {
    const response = await fetch("/api/local-auth/profile", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(change) })
    const data = (await response.json().catch(() => ({}))) as { account?: LocalAccount; error?: string }
    if (!response.ok || !data.account) throw new Error(data.error ?? "Your choice could not be saved. Try again.")
    return applyLocal(token, data.account)
  }
  const data: Record<string, string> = {}
  if (change.role) data.role = change.role
  if (change.onboarded && !current.onboardedAt) data.onboarded_at = new Date().toISOString()
  if (Object.keys(data).length === 0) return
  const { data: updated, error } = await client!.auth.updateUser({ data })
  if (error) throw new Error(error.message)
  // onAuthStateChange also fires (USER_UPDATED); apply at once so the next screen sees the new answers.
  if (updated.user) applySession({ access_token: token ?? "", user: updated.user })
}

async function saveLocalProfile(change: Record<string, unknown>, failure: string): Promise<void> {
  const response = await fetch("/api/local-auth/profile", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(change) })
  const data = (await response.json().catch(() => ({}))) as { account?: LocalAccount; error?: string }
  if (!response.ok || !data.account) throw new Error(data.error ?? failure)
  applyLocal(token, data.account)
}

async function saveSupabaseUser(change: { data?: Record<string, unknown>; email?: string }): Promise<void> {
  const { data: updated, error } = await client!.auth.updateUser(change)
  if (error) throw new Error(error.message)
  if (updated.user) applySession({ access_token: token ?? "", user: updated.user })
}

export const MAX_NAME_LENGTH = 80
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Changes the name and/or the email. Local accounts: saved at once. Supabase: the name at once; a new email only
 * after the user confirms it from the link Supabase sends (until then the old email signs in): emailPending says so.
 */
export async function updateIdentity(change: { displayName?: string; email?: string }): Promise<{ emailPending: boolean }> {
  const current = state.landlord
  if (!current) throw new Error("Sign in first.")
  const displayName = change.displayName?.trim()
  const email = change.email?.trim().toLowerCase()
  if (displayName !== undefined && !displayName) throw new Error("Enter your name or company.")
  if (displayName && displayName.length > MAX_NAME_LENGTH) throw new Error(`The name can have at most ${MAX_NAME_LENGTH} characters.`)
  if (email !== undefined && !EMAIL.test(email)) throw new Error("Enter a valid email address.")
  const nameChanged = displayName !== undefined && displayName !== current.displayName
  const emailChanged = email !== undefined && email !== current.email.toLowerCase()
  if (!nameChanged && !emailChanged) return { emailPending: false }
  if (state.mode === "local") {
    await saveLocalProfile({ ...(nameChanged ? { displayName } : {}), ...(emailChanged ? { email } : {}) }, "Your details could not be saved. Try again.")
    return { emailPending: false }
  }
  if (nameChanged) await saveSupabaseUser({ data: { display_name: displayName } })
  if (emailChanged) {
    await saveSupabaseUser({ email })
    return { emailPending: (state.landlord?.email ?? "").toLowerCase() !== email }
  }
  return { emailPending: false }
}

/** Stores the cropped photo (a small JPEG data URL from the photo dialog) on our server and saves its address on the account. */
export async function uploadAvatarImage(image: string): Promise<void> {
  if (!state.landlord) throw new Error("Sign in first.")
  const response = await fetch("/api/me/avatar", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ image }) })
  const data = (await response.json().catch(() => ({}))) as { avatarUrl?: string; account?: LocalAccount; error?: string }
  if (!response.ok || !data.avatarUrl) throw new Error(data.error ?? "The photo could not be saved. Try again.")
  if (state.mode === "local") return data.account ? applyLocal(token, data.account) : undefined
  await saveSupabaseUser({ data: { avatar_url: data.avatarUrl } })
}

/** Removes the photo from the account (the first letter of the name is shown again). */
export async function removeAvatar(): Promise<void> {
  if (!state.landlord) throw new Error("Sign in first.")
  if (state.mode === "local") return saveLocalProfile({ avatarUrl: null }, "The photo could not be removed. Try again.")
  await saveSupabaseUser({ data: { avatar_url: null } })
}

/** The signed-in account right now (outside React). */
export function currentAccount(): Landlord | null {
  return state.landlord
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}
