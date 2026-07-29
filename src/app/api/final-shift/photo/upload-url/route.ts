import { editsLocked, identify, json, unauthorized } from "@/lib/final-shift/api";
import { hitRateLimit, RATE_LIMITS } from "@/lib/final-shift/ratelimit";
import {
  buildPhotoPath,
  createSignedUploadUrl,
  MAX_PHOTO_BYTES,
} from "@/lib/final-shift/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints a signed URL so the browser can PUT its photo straight into the bucket.
 *
 * The path is chosen here, never sent by the client. That single fact is what keeps the signed token
 * safe to hand out: it is scoped to one object under this guest's own directory, so possessing it
 * grants no access to anyone else's photo and no ability to write anywhere else in the bucket.
 */
export async function POST(request: Request): Promise<Response> {
  const identified = await identify();
  if (!identified) return unauthorized();
  if (identified.event.editsLocked) return editsLocked();

  // Per-guest rather than per-IP: the thing worth bounding is one session filling the bucket with
  // retakes, and a whole café on one WiFi network shares an address.
  const limit = await hitRateLimit(RATE_LIMITS.uploadPerGuest, identified.guest.id);
  if (limit.limited) {
    return json(
      { ok: false, code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  /*
   * An early size check, not the real one. The bucket enforces the same ceiling independently, which
   * is what actually holds — this number arrives from the client and a client can lie. Rejecting here
   * just saves a phone from spending its uplink on bytes that were always going to bounce.
   */
  const bytes = (body as { bytes?: unknown } | null)?.bytes;
  if (typeof bytes === "number" && bytes > MAX_PHOTO_BYTES) {
    return json({ ok: false, code: "too_large" }, { status: 413 });
  }

  const path = buildPhotoPath(identified.guest.id);
  const signed = await createSignedUploadUrl(path);

  return json({ ok: true, path: signed.path, signedUrl: signed.signedUrl });
}
