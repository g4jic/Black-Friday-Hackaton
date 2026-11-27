import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Profile photos. The browser shrinks the photo to a small square first; the server checks it again (type, size and
 * the file's own magic bytes, so a renamed file is refused) before it stores it. Two adapters behind one port:
 * Supabase Storage (a public "avatars" bucket, one object per account, written only by the server with the service
 * role key) and a local folder for a server without Supabase.
 */
export type AvatarImage = { readonly bytes: Buffer; readonly contentType: "image/jpeg" | "image/png" | "image/webp" }

export class AvatarError extends Error {
  constructor(message: string) {
    super(message)
  }
}

/** A photo is at most 512 KB after the browser shrank it (a 256 px square is about 20 KB). */
export const MAX_AVATAR_BYTES = 512 * 1024

const MAGIC: Record<AvatarImage["contentType"], (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
}

/** Parses "data:image/...;base64,..." into a checked image, or throws AvatarError with a message for the user. */
export function parseAvatarDataUrl(value: unknown): AvatarImage {
  if (typeof value !== "string") throw new AvatarError("Choose a photo first.")
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value)
  if (!match) throw new AvatarError("The photo must be a JPEG, PNG or WebP image.")
  const contentType = match[1] as AvatarImage["contentType"]
  const bytes = Buffer.from(match[2]!, "base64")
  if (bytes.length === 0) throw new AvatarError("The photo is empty.")
  if (bytes.length > MAX_AVATAR_BYTES) throw new AvatarError("The photo is too large (at most 512 KB).")
  if (!MAGIC[contentType](bytes)) throw new AvatarError("The file is not the image type it claims to be.")
  return { bytes, contentType }
}

export interface AvatarStore {
  /** Stores the photo of this account (replacing any earlier one) and returns the address to show it from. */
  save(accountId: string, image: AvatarImage): Promise<string>
}

const SAFE_ID = /^[A-Za-z0-9-]+$/
const checkId = (accountId: string) => {
  if (!SAFE_ID.test(accountId)) throw new AvatarError("Unknown account.")
}

/** Local folder (data/avatars, git-ignored), served by GET /api/avatars/:id. */
export class LocalAvatarStore implements AvatarStore {
  constructor(private readonly dir = "data/avatars") {}

  async save(accountId: string, image: AvatarImage): Promise<string> {
    checkId(accountId)
    mkdirSync(this.dir, { recursive: true })
    const tmp = join(this.dir, `${accountId}.tmp`)
    writeFileSync(tmp, image.bytes)
    renameSync(tmp, join(this.dir, accountId))
    writeFileSync(join(this.dir, `${accountId}.type`), image.contentType)
    return `/api/avatars/${accountId}?v=${Date.now()}`
  }

  read(accountId: string): AvatarImage | null {
    if (!SAFE_ID.test(accountId)) return null
    const file = join(this.dir, accountId)
    const typeFile = join(this.dir, `${accountId}.type`)
    if (!existsSync(file) || !existsSync(typeFile)) return null
    const contentType = readFileSync(typeFile, "utf8").trim() as AvatarImage["contentType"]
    if (!(contentType in MAGIC)) return null
    return { bytes: readFileSync(file), contentType }
  }
}

export const AVATAR_BUCKET = "avatars"

/** Supabase Storage: a public bucket "avatars" (made on first use), one object per account id. */
export class SupabaseAvatarStore implements AvatarStore {
  private readonly client: SupabaseClient
  private bucketReady: Promise<void> | null = null

  constructor(config: { url: string; serviceRoleKey: string }) {
    this.client = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  }

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= (async () => {
      const { data } = await this.client.storage.getBucket(AVATAR_BUCKET)
      if (data) return
      const { error } = await this.client.storage.createBucket(AVATAR_BUCKET, { public: true, fileSizeLimit: MAX_AVATAR_BYTES, allowedMimeTypes: Object.keys(MAGIC) })
      if (error && !/already exists/i.test(error.message)) throw new Error(`Photo storage is not available: ${error.message}`)
    })().catch((error: unknown) => {
      this.bucketReady = null
      throw error
    })
    return this.bucketReady
  }

  async save(accountId: string, image: AvatarImage): Promise<string> {
    checkId(accountId)
    await this.ensureBucket()
    const { error } = await this.client.storage.from(AVATAR_BUCKET).upload(accountId, image.bytes, { contentType: image.contentType, upsert: true, cacheControl: "60" })
    if (error) throw new Error(`The photo could not be stored: ${error.message}`)
    const { data } = this.client.storage.from(AVATAR_BUCKET).getPublicUrl(accountId)
    return `${data.publicUrl}?v=${Date.now()}`
  }
}
