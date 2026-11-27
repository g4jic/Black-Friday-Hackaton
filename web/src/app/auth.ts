import type { SupabaseClient } from "@supabase/supabase-js"
import { useSyncExternalStore } from "react"
import { setAuthHeaders } from "../listings/listings-api"

/**
 * Accounts. Every user signs in (there is no guest mode). With Supabase on the server: email and password through
 * Supabase Auth, and every request carries its access token. Without Supabase (for example a fresh clone with no
 * keys): local accounts kept by this server in a file on this machine only (mode "local", labelled in the UI); the
 * session token is kept in this browser's localStorage.
 */
export type Landlord = { readonly id: string; readonly email: string; readonly displayName: string }
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

type SessionLike = { access_token: string; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null

function applySession(session: SessionLike): void {
  token = session?.access_token ?? null
  const user = session?.user
  const name = typeof user?.user_metadata?.display_name === "string" ? (user.user_metadata.display_name as string).trim() : ""
  set({ status: "ready", landlord: user ? { id: user.id, email: user.email ?? "", displayName: name || user.email || "Account" } : null })
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

type LocalAccount = { id: string; email: string; displayName: string }

function applyLocal(newToken: string | null, account: LocalAccount | null): void {
  token = newToken
  writeLocalToken(newToken)
  set({ status: "ready", landlord: account ? { id: account.id, email: account.email, displayName: account.displayName } : null })
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

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}
