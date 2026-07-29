import { getWallCards } from "@/lib/final-shift/repository";
import { createSignedUrls } from "@/lib/final-shift/storage";
import type { EventConfig, WallCard } from "@/lib/final-shift/types";

export type WallPayload = { enabled: boolean; cards: WallCard[] };

/**
 * The wall, built once and used by both the page and the route.
 *
 * It lives here rather than in the route handler because two copies of this mapping is exactly one
 * copy too many: the page renders the wall server-side, the route serves it to a client refresh, and
 * the difference between them must never be *what gets included*. One function, one privacy contract.
 *
 * Three things about the output are load-bearing, and all three are absences.
 *
 * `guestId` never leaves this function. The query returns it only so a card can be marked as the
 * reader's own; it is a stable identifier for a real person and has no business in a payload every
 * guest receives, so it is resolved to a boolean here and dropped.
 *
 * There is no count, and no total of any kind. At fewer than ten guests a number is an inference:
 * seven cards in front of a crew that knows it is about ten says three people either declined the
 * wall or have not replied, which names the holdouts by elimination.
 *
 * Nothing marks a card as absent. A guest who declined produces no card, no gap, and no placeholder,
 * and the result is indistinguishable from one where they simply had not replied yet.
 */
export async function loadWall(
  guestId: string,
  event: EventConfig,
): Promise<WallPayload> {
  if (!event.wallEnabled) return { enabled: false, cards: [] };

  const rows = await getWallCards();

  // One round trip for every photo on the wall rather than one per card.
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
      isMe: row.guestId === guestId,
    };
  });

  return { enabled: true, cards };
}
