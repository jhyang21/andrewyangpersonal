import type { CatalogProduct, ChatSessionContext, DecisionSession } from "@/pica/lib/types";
import { checkoutTargetOf } from "./reducer";

/**
 * Products sent with each chat request, at most. The route takes 200, but
 * Pica's prompt shows only the newest 25, and each record is about 7 KB.
 * 60 covers the last six searches; the shortlist, the comparison and the
 * chosen product always go too, so Pica can still check their IDs.
 */
export const CHAT_PRODUCT_LIMIT = 60;

/** IDs Pica must be able to look up, whatever their age. */
function pinnedIds(session: DecisionSession): Set<string> {
  const ids = new Set<string>();
  for (const entry of session.shortlist?.entries ?? []) ids.add(entry.productId);
  for (const id of session.comparison?.productIds ?? []) ids.add(id);
  if (session.decision.productId) ids.add(session.decision.productId);
  const target = checkoutTargetOf(session).productId;
  if (target) ids.add(target);
  return ids;
}

/** What `/api/chat` needs beside the messages. The server keeps no state. */
export function buildChatContext(session: DecisionSession): ChatSessionContext {
  const pinned = pinnedIds(session);
  const all = Object.values(session.products).sort((a, b) => a.fetchedAt - b.fetchedAt);
  const kept = all.filter((product) => pinned.has(product.id));
  const room = Math.max(0, CHAT_PRODUCT_LIMIT - kept.length);
  const newest = room > 0 ? all.filter((product) => !pinned.has(product.id)).slice(-room) : [];
  // Oldest first, as before: the prompt takes the last ones.
  const products: CatalogProduct[] = [...kept, ...newest].sort((a, b) => a.fetchedAt - b.fetchedAt);
  return {
    sessionId: session.id,
    canvas: session.canvas,
    products,
    shortlistProductIds: session.shortlist?.entries.map((entry) => entry.productId) ?? [],
    // True when the canvas changed after the shortlist's request went out: by
    // the buyer, or by Pica in a later reply. Pica's change in the same reply as
    // the shortlist does not count. (Wider than the shared type's comment says.)
    canvasChangedSinceShortlist: session.shortlist?.stale ?? false,
  };
}

/** A plain user message in the AI SDK's UI message shape. */
export function userMessage(id: string, text: string) {
  return { id, role: "user" as const, parts: [{ type: "text" as const, text }] };
}
