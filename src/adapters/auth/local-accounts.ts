import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { FastifyInstance, FastifyRequest } from "fastify"
import type { ListingActor } from "../../application/listings/listing-store.js"
import { bearerToken } from "./supabase-auth.js"

/**
 * Local accounts, for a server without Supabase (for example a judge running the README on a laptop): sign up and
 * sign in work the same way, but the accounts live in a local JSON file on this machine only (data/ is git-ignored)
 * and the UI says so. Passwords are stored as scrypt hashes with a salt, session tokens as SHA-256 hashes; nothing
 * leaves the machine. Not meant for production: the hosted app uses Supabase Auth.
 */
export const LOCAL_ACCOUNTS_FILE = "data/local-accounts.json"
export const MIN_PASSWORD_LENGTH = 8

/**
 * What the user chose in the onboarding: list a space, find a space, or both. It only shapes the UI (the same field
 * lives in Supabase user_metadata, which the user can edit), so nothing about money or security reads it.
 */
export type AccountRole = "owner" | "seeker" | "both"
export const ACCOUNT_ROLES: readonly AccountRole[] = ["owner", "seeker", "both"]

/** The part of an account the browser sees. role and onboardedAt are null until the onboarding sets them. */
export type PublicAccount = { id: string; email: string; displayName: string; role: AccountRole | null; onboardedAt: string | null }

type StoredAccount = { id: string; email: string; displayName: string; salt: string; hash: string; createdAt: string; role?: AccountRole; onboardedAt?: string }
type StoredFile = { accounts: StoredAccount[]; sessions: { tokenHash: string; accountId: string; createdAt: string }[] }

export class LocalAccountError extends Error {
  constructor(
    readonly status: 400 | 401 | 409,
    message: string,
  ) {
    super(message)
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")
const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 32).toString("hex")
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class LocalAccounts {
  private data: StoredFile = { accounts: [], sessions: [] }

  /** file: null keeps the accounts in memory only (tests). */
  constructor(private readonly file: string | null = LOCAL_ACCOUNTS_FILE) {
    if (file && existsSync(file)) {
      try {
        this.data = JSON.parse(readFileSync(file, "utf8")) as StoredFile
      } catch {
        this.data = { accounts: [], sessions: [] } // a broken file is ignored, never a crash
      }
    }
  }

  private save(): void {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 1))
    renameSync(tmp, this.file)
  }

  private session(account: StoredAccount): { token: string; actor: ListingActor } {
    const token = randomBytes(32).toString("hex")
    this.data.sessions.push({ tokenHash: sha256(token), accountId: account.id, createdAt: new Date().toISOString() })
    this.save()
    return { token, actor: this.actorOf(account) }
  }

  private actorOf(account: StoredAccount): ListingActor {
    return { id: account.id, displayName: account.displayName, kind: "local" }
  }

  signUp(input: { email?: unknown; password?: unknown; displayName?: unknown }): { token: string; actor: ListingActor; email: string } {
    const email = String(input.email ?? "").trim().toLowerCase()
    const password = String(input.password ?? "")
    const displayName = String(input.displayName ?? "").trim()
    if (!EMAIL.test(email)) throw new LocalAccountError(400, "Enter a valid email address.")
    if (password.length < MIN_PASSWORD_LENGTH) throw new LocalAccountError(400, `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (!displayName) throw new LocalAccountError(400, "Enter your name or company.")
    if (this.data.accounts.some((a) => a.email === email)) throw new LocalAccountError(409, "An account with this email already exists on this machine. Sign in instead.")
    const salt = randomBytes(16).toString("hex")
    const account: StoredAccount = { id: `local-${randomUUID()}`, email, displayName, salt, hash: hashPassword(password, salt), createdAt: new Date().toISOString() }
    this.data.accounts.push(account)
    return { ...this.session(account), email }
  }

  signIn(input: { email?: unknown; password?: unknown }): { token: string; actor: ListingActor; email: string } {
    const email = String(input.email ?? "").trim().toLowerCase()
    const account = this.data.accounts.find((a) => a.email === email)
    const given = Buffer.from(hashPassword(String(input.password ?? ""), account?.salt ?? "no-account"), "hex")
    if (!account || !timingSafeEqual(given, Buffer.from(account.hash, "hex"))) throw new LocalAccountError(401, "Wrong email or password.")
    return { ...this.session(account), email }
  }

  signOut(token: string | null): void {
    if (!token) return
    const tokenHash = sha256(token)
    this.data.sessions = this.data.sessions.filter((s) => s.tokenHash !== tokenHash)
    this.save()
  }

  private accountOf(token: string | null): StoredAccount | undefined {
    if (!token) return undefined
    const tokenHash = sha256(token)
    const session = this.data.sessions.find((s) => s.tokenHash === tokenHash)
    return session ? this.data.accounts.find((a) => a.id === session.accountId) : undefined
  }

  /** The account behind a session token, or null. */
  resolve(token: string | null): (ListingActor & { email: string }) | null {
    const account = this.accountOf(token)
    return account ? { ...this.actorOf(account), email: account.email } : null
  }

  /** What the browser may see of the account behind a token (never the password hash), or null. */
  publicAccount(token: string | null): PublicAccount | null {
    const account = this.accountOf(token)
    return account ? toPublic(account) : null
  }

  /**
   * The onboarding answers: the role (owner, seeker or both) and, once the user saves or skips the last step,
   * onboarded: true. Setting onboarded twice keeps the first time (idempotent). onboarded: false is refused: a
   * finished onboarding is not undone, the role can still change.
   */
  updateProfile(token: string | null, input: { role?: unknown; onboarded?: unknown }): PublicAccount {
    const account = this.accountOf(token)
    if (!account) throw new LocalAccountError(401, "Sign in first.")
    if (input.role !== undefined) {
      if (!ACCOUNT_ROLES.includes(input.role as AccountRole)) throw new LocalAccountError(400, `The role must be one of: ${ACCOUNT_ROLES.join(", ")}.`)
      account.role = input.role as AccountRole
    }
    if (input.onboarded !== undefined) {
      if (input.onboarded !== true) throw new LocalAccountError(400, "onboarded can only be set to true.")
      account.onboardedAt ??= new Date().toISOString()
    }
    this.save()
    return toPublic(account)
  }

  actorResolver(): (req: FastifyRequest) => Promise<ListingActor | null> {
    return async (req) => {
      const found = this.resolve(bearerToken(req))
      return found ? { id: found.id, displayName: found.displayName, kind: found.kind } : null
    }
  }
}

function toPublic(account: StoredAccount): PublicAccount {
  return { id: account.id, email: account.email, displayName: account.displayName, role: account.role ?? null, onboardedAt: account.onboardedAt ?? null }
}

/** POST /api/local-auth/sign-up, /sign-in, /sign-out, /profile and GET /api/local-auth/me (only when Supabase is off). */
export function registerLocalAuthRoutes(app: FastifyInstance, accounts: LocalAccounts): void {
  const reply = (r: { token: string; actor: ListingActor; email: string }) => ({ token: r.token, account: accounts.publicAccount(r.token)! })
  const handle = (fn: (body: Record<string, unknown>) => ReturnType<typeof reply>) => async (req: FastifyRequest, res: import("fastify").FastifyReply) => {
    try {
      return fn((req.body ?? {}) as Record<string, unknown>)
    } catch (error) {
      if (error instanceof LocalAccountError) return res.code(error.status).send({ error: error.message })
      throw error
    }
  }
  app.post("/api/local-auth/sign-up", handle((body) => reply(accounts.signUp(body))))
  app.post("/api/local-auth/sign-in", handle((body) => reply(accounts.signIn(body))))
  app.post("/api/local-auth/sign-out", async (req) => {
    accounts.signOut(bearerToken(req))
    return { ok: true }
  })
  app.get("/api/local-auth/me", async (req, res) => {
    const account = accounts.publicAccount(bearerToken(req))
    if (!account) return res.code(401).send({ error: "Not signed in" })
    return { account }
  })
  app.post("/api/local-auth/profile", async (req, res) => {
    try {
      return { account: accounts.updateProfile(bearerToken(req), (req.body ?? {}) as Record<string, unknown>) }
    } catch (error) {
      if (error instanceof LocalAccountError) return res.code(error.status).send({ error: error.message })
      throw error
    }
  })
}
