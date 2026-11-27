import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Uploaded images: profile photos and listing photos. The browser shrinks an image first; the server checks it again
 * (type, size and the file's own magic bytes, so a renamed file is refused) before it stores it. Two adapters behind
 * one port: Supabase Storage (a public bucket, made on first use, written only by the server with the service role
 * key) and a local folder for a server without Supabase.
 */
export type StoredImage = { readonly bytes: Buffer; readonly contentType: "image/jpeg" | "image/png" | "image/webp" }

export class ImageError extends Error {
  constructor(message: string) {
    super(message)
  }
}

/** A profile photo is at most 512 KB after the browser shrank it (a 256 px square is about 20 KB). */
export const MAX_AVATAR_BYTES = 512 * 1024
/** A listing photo is at most 1.5 MB after the browser shrank it (1600 px on the long side is about 300 KB). */
export const MAX_LISTING_PHOTO_BYTES = 1536 * 1024

const MAGIC: Record<StoredImage["contentType"], (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
}

/** Parses "data:image/...;base64,..." into a checked image, or throws ImageError with a message for the user. */
export function parseImageDataUrl(value: unknown, maxBytes = MAX_AVATAR_BYTES): StoredImage {
  if (typeof value !== "string") throw new ImageError("Choose a photo first.")
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value)
  if (!match) throw new ImageError("The photo must be a JPEG, PNG or WebP image.")
  const contentType = match[1] as StoredImage["contentType"]
  const bytes = Buffer.from(match[2]!, "base64")
  if (bytes.length === 0) throw new ImageError("The photo is empty.")
  if (bytes.length > maxBytes) throw new ImageError(`The photo is too large (at most ${Math.round(maxBytes / 1024)} KB).`)
  if (!MAGIC[contentType](bytes)) throw new ImageError("The file is not the image type it claims to be.")
  return { bytes, contentType }
}

export interface ImageStore {
  /** Stores the image under this key (replacing any earlier one) and returns the address to show it from. */
  save(key: string, image: StoredImage): Promise<string>
}

const SAFE_KEY = /^[A-Za-z0-9-]+$/
const checkKey = (key: string) => {
  if (!SAFE_KEY.test(key)) throw new ImageError("Unknown image.")
}

/** Local folder (git-ignored, default data/avatars), served by GET <urlPrefix>/:id. */
export class LocalImageStore implements ImageStore {
  constructor(
    private readonly dir = "data/avatars",
    private readonly urlPrefix = "/api/avatars",
  ) {}

  async save(key: string, image: StoredImage): Promise<string> {
    checkKey(key)
    mkdirSync(this.dir, { recursive: true })
    const tmp = join(this.dir, `${key}.tmp`)
    writeFileSync(tmp, image.bytes)
    renameSync(tmp, join(this.dir, key))
    writeFileSync(join(this.dir, `${key}.type`), image.contentType)
    return `${this.urlPrefix}/${key}?v=${Date.now()}`
  }

  read(key: string): StoredImage | null {
    if (!SAFE_KEY.test(key)) return null
    const file = join(this.dir, key)
    const typeFile = join(this.dir, `${key}.type`)
    if (!existsSync(file) || !existsSync(typeFile)) return null
    const contentType = readFileSync(typeFile, "utf8").trim() as StoredImage["contentType"]
    if (!(contentType in MAGIC)) return null
    return { bytes: readFileSync(file), contentType }
  }
}

export const AVATAR_BUCKET = "avatars"
export const LISTING_PHOTO_BUCKET = "listing-photos"

/** Supabase Storage: a public bucket (default "avatars", made on first use), one object per key. */
export class SupabaseImageStore implements ImageStore {
  private readonly client: SupabaseClient
  private bucketReady: Promise<void> | null = null

  constructor(
    config: { url: string; serviceRoleKey: string },
    private readonly bucket = AVATAR_BUCKET,
    private readonly maxBytes = MAX_AVATAR_BYTES,
  ) {
    this.client = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  }

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= (async () => {
      const { data } = await this.client.storage.getBucket(this.bucket)
      if (data) return
      const { error } = await this.client.storage.createBucket(this.bucket, { public: true, fileSizeLimit: this.maxBytes, allowedMimeTypes: Object.keys(MAGIC) })
      if (error && !/already exists/i.test(error.message)) throw new Error(`Photo storage is not available: ${error.message}`)
    })().catch((error: unknown) => {
      this.bucketReady = null
      throw error
    })
    return this.bucketReady
  }

  async save(key: string, image: StoredImage): Promise<string> {
    checkKey(key)
    await this.ensureBucket()
    const { error } = await this.client.storage.from(this.bucket).upload(key, image.bytes, { contentType: image.contentType, upsert: true, cacheControl: "3600" })
    if (error) throw new Error(`The photo could not be stored: ${error.message}`)
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(key)
    return `${data.publicUrl}?v=${Date.now()}`
  }
}
