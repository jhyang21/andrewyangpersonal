import { requireEnv } from "@/lib/final-shift/env";

/*
 * ★ VENDOR SEAM — Supabase Storage over its REST API.
 *
 * Six calls, all fetch. `@supabase/supabase-js` would be a dependency and a client-initialisation
 * dance to wrap the same six URLs, and this repo's standing rule is no runtime dependency that a
 * few lines can replace.
 *
 * Importing env.ts is what makes this module refuse to load in a browser — SUPABASE_SERVICE_ROLE_KEY
 * bypasses every row-level policy in the project, and the one thing that must never happen to this
 * feature is that key reaching a bundle.
 */

export const BUCKET = "final-shift-photos";

/** Matches the bucket's own file_size_limit, so the two can't drift apart silently. */
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const PHOTO_MIME = "image/jpeg";

/** 15 minutes. Long enough to load a wall on bad LTE, short enough that a leaked URL rots fast. */
export const SIGNED_URL_TTL_SECONDS = 900;

function base(): string {
  return requireEnv("SUPABASE_URL").replace(/\/+$/, "");
}

function headers(): Record<string, string> {
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export class StorageError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "StorageError";
    this.status = status;
  }
}

async function call(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${base()}/storage/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  return response;
}

/**
 * Builds the object path for a guest's photo. Server-side, always.
 *
 * The client never proposes a path. If it did, the signed upload URL would be scoped to whatever it
 * asked for, and one guest could get a token for another guest's directory. The guest id is a UUID
 * rather than the employee number so the number never appears even inside a URL.
 *
 * The random suffix means a retake writes a new object instead of overwriting one — no CDN or
 * browser cache serving the previous photo — and the caller deletes the old path after committing.
 */
export function buildPhotoPath(guestId: string): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `photos/${guestId}/${random}.jpg`;
}

export type SignedUpload = { path: string; signedUrl: string; token: string };

/**
 * Mints a one-object upload URL so the browser can PUT straight to storage.
 *
 * Bytes never pass through a Next route handler, which matters for three reasons: Vercel caps a
 * serverless request body at 4.5 MB and answers an overflow with an opaque 413; proxying doubles
 * the bytes over the wire on the slowest step of the whole flow; and it bills function duration for
 * the length of a phone's uplink. The trust boundary survives because the server picks the path,
 * the token is scoped to that single path, and the bucket enforces size and MIME independently.
 */
export async function createSignedUploadUrl(path: string): Promise<SignedUpload> {
  const response = await call(`object/upload/sign/${BUCKET}/${path}`, { method: "POST" });
  if (!response.ok) {
    throw new StorageError(response.status, `Could not sign an upload for ${path}.`);
  }

  const body = (await response.json()) as { url?: string; token?: string };
  if (!body.token) throw new StorageError(500, "Upload sign response had no token.");

  return {
    path,
    signedUrl: `${base()}/storage/v1/object/upload/sign/${BUCKET}/${path}?token=${body.token}`,
    token: body.token,
  };
}

/** Short-lived read URLs, one round trip for the whole wall. */
export async function createSignedUrls(
  paths: string[],
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;

  const response = await call(`object/sign/${BUCKET}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn, paths }),
  });
  if (!response.ok) {
    throw new StorageError(response.status, "Could not sign photo URLs.");
  }

  const rows = (await response.json()) as {
    path?: string | null;
    signedURL?: string | null;
    error?: string | null;
  }[];

  for (const row of rows) {
    // A row with an error is a path that no longer exists in the bucket. Skip it — one missing
    // photo must not take the whole wall down.
    if (row.path && row.signedURL) {
      result.set(row.path, `${base()}/storage/v1${row.signedURL}`);
    }
  }
  return result;
}

export async function createSignedUrl(
  path: string,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const signed = await createSignedUrls([path], expiresIn);
  return signed.get(path) ?? null;
}

export type ObjectFacts = { bytes: number; mimeType: string | null };

/**
 * Confirms the object is really there, and really what it claims.
 *
 * The commit route calls this before writing the path to the database. Without it, a client could
 * commit a path it never uploaded to and the wall would render a broken image forever; the bucket's
 * own MIME and size limits are the second, independent check.
 */
export async function headObject(path: string): Promise<ObjectFacts | null> {
  const response = await call(`object/authenticated/${BUCKET}/${path}`, { method: "HEAD" });
  if (!response.ok) return null;

  const length = response.headers.get("content-length");
  return {
    bytes: length ? Number.parseInt(length, 10) : 0,
    mimeType: response.headers.get("content-type"),
  };
}

/** Best effort. A failed delete leaves an orphan, which is untidy; a thrown one loses the RSVP. */
export async function deleteObject(path: string): Promise<void> {
  try {
    await call(`object/${BUCKET}/${path}`, { method: "DELETE" });
  } catch {
    // Nothing the guest can do about it, and nothing worth failing their submission over.
  }
}
