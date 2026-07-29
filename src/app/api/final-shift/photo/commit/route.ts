import { editsLocked, identify, json, unauthorized } from "@/lib/final-shift/api";
import { setPhoto } from "@/lib/final-shift/repository";
import {
  createSignedUrl,
  deleteObject,
  headObject,
  MAX_PHOTO_BYTES,
  PHOTO_MIME,
} from "@/lib/final-shift/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Records an uploaded photo against the guest, and clears up the one it replaced.
 *
 * Three checks stand between a request and a row change, and none of them is redundant:
 *
 *  1. The path must sit under this guest's own directory. Without it, a guest could commit a
 *     coworker's object path and put someone else's face on their own card.
 *  2. The object must actually exist, with the right type and size. The upload is a direct
 *     browser-to-bucket PUT that this server never sees, so "the client says it uploaded" is the
 *     only thing we would otherwise be trusting — and a path that was never written renders as a
 *     broken image on the wall forever.
 *  3. Both dimensions must be real positive integers. They go straight into the img width and height
 *     that stop the wall reflowing as photos land.
 */
export async function POST(request: Request): Promise<Response> {
  const identified = await identify();
  if (!identified) return unauthorized();
  if (identified.event.editsLocked) return editsLocked();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const path = typeof input.path === "string" ? input.path : "";
  const width = positiveInt(input.width);
  const height = positiveInt(input.height);

  if (!width || !height) {
    return json({ ok: false, code: "bad_request" }, { status: 400 });
  }
  if (!path.startsWith(`photos/${identified.guest.id}/`)) {
    return json({ ok: false, code: "forbidden_path" }, { status: 403 });
  }

  const facts = await headObject(path);
  if (!facts) return json({ ok: false, code: "not_uploaded" }, { status: 409 });
  if (facts.bytes > MAX_PHOTO_BYTES) {
    await deleteObject(path);
    return json({ ok: false, code: "too_large" }, { status: 413 });
  }
  if (facts.mimeType && !facts.mimeType.startsWith(PHOTO_MIME)) {
    await deleteObject(path);
    return json({ ok: false, code: "bad_type" }, { status: 415 });
  }

  const { previousPath } = await setPhoto(identified.guest.id, {
    path,
    width,
    height,
    bytes: facts.bytes,
  });

  // After the row is written, never before. Deleting first would leave a guest with no photo at all
  // if the update then failed, which is worse than leaving one stray object in a bucket.
  if (previousPath && previousPath !== path) {
    await deleteObject(previousPath);
  }

  const url = await createSignedUrl(path);
  if (!url) return json({ ok: false, code: "sign_failed" }, { status: 502 });

  return json({ ok: true, photo: { path, width, height, url } });
}
