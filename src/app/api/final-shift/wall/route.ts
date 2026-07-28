import { identify, json, unauthorized } from "@/lib/final-shift/api";
import { getWallCards } from "@/lib/final-shift/repository";
import { createSignedUrls } from "@/lib/final-shift/storage";
import type { WallCard } from "@/lib/final-shift/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The farewell wall.
 *
 * Three things about this response are load-bearing, and all three are absences.
 *
 * `guestId` is dropped. It comes back from the query only so a card can be marked as the reader's
 * own, and it is a stable identifier for a real person that has no business in a payload every guest
 * receives. It is resolved to a boolean here and never serialised.
 *
 * There is no count, and no total of any kind. At fewer than ten guests a number is an inference:
 * seven cards in front of a crew that knows it is about ten says three people either declined the
 * wall or have not replied, which names the holdouts by elimination. The cards are the whole answer.
 *
 * Nothing marks a card as absent. A guest who declined the wall produces no card, no gap, and no
 * placeholder — the response is indistinguishable from one where they had not replied at all.
 */
export async function GET(): Promise<Response> {
  const identified = await identify();
  if (!identified) return unauthorized();

  if (!identified.event.wallEnabled) {
    return json({ ok: true, enabled: false, cards: [] });
  }

  const rows = await getWallCards();

  // One round trip for every photo on the wall, rather than one per card.
  const paths = rows
    .map((row) => row.photoPath)
    .filter((path): path is string => Boolean(path));
  const signed = await createSignedUrls(paths);

  const cards: WallCard[] = rows.map((row) => {
    const url = row.photoPath ? signed.get(row.photoPath) : undefined;
    return {
      id: row.id,
      firstName: row.firstName,
      caption: row.caption,
      memory: row.memory,
      photo:
        url && row.photoPath
          ? { url, width: row.photoWidth ?? 0, height: row.photoHeight ?? 0 }
          : null,
      isMe: row.guestId === identified.guest.id,
    };
  });

  return json({ ok: true, enabled: true, cards });
}
