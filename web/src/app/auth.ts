import type { SupabaseClient } from "@supabase/supabase-js"
import { useSyncExternalStore } from "react"
import { setAuthHeaders } from "../listings/listings-api"

/**
 * Landlord accounts. A tenant never needs one (Guest). When the server has Supabase configured, a landlord signs
 * up or logs in with email and password (Supabase Auth); every listing request then carries the access token.
 * Without Supabase the server has no accounts: everyone who publishes is the Local demo landlord.
 */
export type Landlord = { readonly id: string; readonly email: string; readonly displayName: string }
export type AuthState = { readonly status: "loading" | "ready"; readonly enabled: boolean; readonly landlord: Landlord | null }

let state: AuthState = { status: "loading", enabled: false, landlord: null }
let client: SupabaseClient | null = null
let token: string | null = null
const listeners = new Set<() => void>()

function set(next: Partial<AuthState>): void {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

setAuthHeaders((): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}))

type SessionLike = { access_token: string; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null

function applySession(session: SessionLike): void {
  token = session?.access_token ?? null
  const user = session?.user
  const name = typeof user?.user_metadata?.display_name === "string" ? (user.user_metadata.display_name as string).trim() : ""
  set({ status: "ready", landlord: user ? { id: user.id, email: user.email ?? "", displayName: name || user.email || "Landlord" } : null })
}

async function init(): Promise<void> {
  try {
    const config = (await (await fetch("/api/auth-config")).json()) as { enabled: boolean; url?: string; anonKey?: string }
    if (!config.enabled || !config.url || !config.anonKey) return set({ status: "ready", enabled: false })
    const { createClient } = await import("@supabase/supabase-js")
    client = createClient(config.url, config.anonKey)
    set({ enabled: true })
    client.auth.onAuthStateChange((_event, session) => applySession(session))
    applySession((await client.auth.getSession()).data.session)
  } catch {
    set({ status: "ready", enabled: false })
  }
}
void init()

function requireClient(): SupabaseClient {
  if (!client) throw new Error("Accounts are not available on this server.")
  return client
}

export async function signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await requireClient().auth.signUp({ email, password, options: { data: { display_name: displayName.trim() } } })
  if (error) throw new Error(error.message)
  return { needsConfirmation: !data.session }
}

export async function logIn(email: string, password: string): Promise<void> {
  const { error } = await requireClient().auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function logOut(): Promise<void> {
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
