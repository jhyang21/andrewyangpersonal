import { editsLocked, identify, json, unauthorized } from "@/lib/final-shift/api";
import { patchDraft } from "@/lib/final-shift/repository";
import { parseDraftPatch } from "@/lib/final-shift/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Autosave.
 *
 * Called on a debounce as the guest types, so it is the one route in the feature that runs often.
 * It answers `{ ok: true }` and nothing else: returning the stored row would mean signing a photo
 * URL on every keystroke pause, and the client already holds the values it just sent.
 *
 * No rate limit here on purpose. It sits behind a session cookie, the debounce caps the real rate at
 * roughly one write per second per guest, and a limit that could fire mid-sentence would turn a
 * background save into a visible failure for the one person it was meant to protect.
 */
export async function PATCH(request: Request): Promise<Response> {
  const identified = await identify();
  if (!identified) return unauthorized();
  if (identified.event.editsLocked) return editsLocked();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const patch = parseDraftPatch(body, identified.event);
  if (Object.keys(patch).length === 0) return json({ ok: true });

  await patchDraft(identified.guest.id, patch);
  return json({ ok: true });
}
