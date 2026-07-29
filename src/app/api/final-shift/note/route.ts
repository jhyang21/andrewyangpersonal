import { identify, json, unauthorized } from "@/lib/final-shift/api";
import { COPY } from "@/lib/final-shift/copy";
import { ensureSubmission, getPrivateNote } from "@/lib/final-shift/repository";
import type { PrivateNote } from "@/lib/final-shift/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The private note, for the MY NOTE control on a later visit.
 *
 * Gated on having clocked out. The note is the last beat of the ceremony and it is the one piece of
 * content written to a specific person; a guest who is still on stage three has not reached it yet,
 * and a route that handed it over anyway would make the whole sequencing a suggestion.
 */
export async function GET(): Promise<Response> {
  const identified = await identify();
  if (!identified) return unauthorized();

  const submission = await ensureSubmission(identified.guest.id);
  if (submission.status !== "submitted") {
    return json({ ok: false, code: "not_submitted" }, { status: 403 });
  }

  const note = await getPrivateNote(identified.guest.id);
  const privateNote: PrivateNote = note?.trim()
    ? { text: note.trim(), isFallback: false }
    : { text: COPY.note.fallback(identified.guest.firstName), isFallback: true };

  return json({ ok: true, note: privateNote });
}
