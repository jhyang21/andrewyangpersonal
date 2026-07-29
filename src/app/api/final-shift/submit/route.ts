import { editsLocked, identify, json, unauthorized } from "@/lib/final-shift/api";
import { COPY } from "@/lib/final-shift/copy";
import {
  ensureSubmission,
  getPrivateNote,
  markSubmitted,
  patchDraft,
} from "@/lib/final-shift/repository";
import { createSignedUrl } from "@/lib/final-shift/storage";
import type { PrivateNote, Submission } from "@/lib/final-shift/types";
import { findMissing, parseDraftPatch } from "@/lib/final-shift/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clock out.
 *
 * The request carries the guest's final answers as well as the intent to submit. That looks like
 * duplication of the autosave, and it is deliberate: the last debounced PATCH may still be in
 * flight when the guest taps the button, and validating against a row that is one keystroke stale
 * would reject a complete RSVP. Sending the values with the submit removes the race entirely rather
 * than papering over it with a delay.
 *
 * Idempotent throughout. `markSubmitted` keeps the original `submitted_at`, so a returning guest
 * saving an edit runs this same path and their place on the wall does not move.
 */
export async function POST(request: Request): Promise<Response> {
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
  const current = await ensureSubmission(identified.guest.id);
  const stored =
    Object.keys(patch).length > 0
      ? await patchDraft(identified.guest.id, patch)
      : current;

  /*
   * The real validation. Every rule here is also enforced in the UI, and that is not redundancy —
   * the UI rules exist to be kind, and these exist because the UI is a thing the caller controls.
   *
   * The list is returned whole rather than one field at a time so the client can drop the guest on
   * the stage that needs them, once.
   */
  const missing = findMissing({
    attending: stored.attending,
    availableDates: stored.availableDates,
    caption: stored.caption,
    hasPhoto: Boolean(stored.photo),
  });

  if (missing.length > 0) {
    return json({ ok: false, code: "incomplete", missing }, { status: 422 });
  }

  const [submitted, note] = await Promise.all([
    markSubmitted(identified.guest.id),
    getPrivateNote(identified.guest.id),
  ]);

  const photoUrl = submitted.photo ? await createSignedUrl(submitted.photo.path) : null;
  const submission: Submission = {
    ...submitted,
    photo: submitted.photo && photoUrl ? { ...submitted.photo, url: photoUrl } : null,
  };

  // A guest Andrew hasn't written to yet gets the name-aware default rather than an empty panel.
  // The flag lets the UI keep the "Private note" framing honest without exposing which is which.
  const privateNote: PrivateNote = note?.trim()
    ? { text: note.trim(), isFallback: false }
    : { text: COPY.note.fallback(identified.guest.firstName), isFallback: true };

  return json({ ok: true, submission, note: privateNote });
}
