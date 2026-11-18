/**
 * Search results carry full catalog records (about 7 KB each, 10 a search).
 * The session keeps each record once, in `session.products`, so the stored
 * history keeps only the IDs. `hydrateMessages` puts the records back before
 * the chat uses the history again.
 */
import type { CatalogProduct } from "@/pica/lib/types";

const SEARCH_PART = "tool-search_catalog";

type Part = { type?: unknown; state?: unknown; output?: unknown };
type Message = { parts?: unknown };

/** A stored search result: no records, only their IDs, in order. */
interface StoredSearchOutput {
  products: CatalogProduct[];
  productIds?: string[];
  [key: string]: unknown;
}

function searchOutput(part: unknown): StoredSearchOutput | null {
  const { type, state, output } = (part ?? {}) as Part;
  if (type !== SEARCH_PART || state !== "output-available") return null;
  if (typeof output !== "object" || output === null) return null;
  const products = (output as { products?: unknown }).products;
  return Array.isArray(products) ? (output as StoredSearchOutput) : null;
}

/** Map each message's parts. Returns the input when no part changed. */
function mapParts(messages: unknown[], change: (part: unknown) => unknown): unknown[] {
  let changedAny = false;
  const next = messages.map((message) => {
    const parts = (message as Message | null)?.parts;
    if (!Array.isArray(parts)) return message;
    let changed = false;
    const nextParts = parts.map((part) => {
      const out = change(part);
      if (out !== part) changed = true;
      return out;
    });
    if (!changed) return message;
    changedAny = true;
    return { ...(message as object), parts: nextParts };
  });
  return changedAny ? next : messages;
}

/** Every full record held in search results, in order. */
export function searchProducts(messages: unknown[]): CatalogProduct[] {
  const out: CatalogProduct[] = [];
  for (const message of messages) {
    const parts = (message as Message | null)?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const output = searchOutput(part);
      if (!output) continue;
      for (const product of output.products) {
        if (typeof (product as { id?: unknown } | null)?.id === "string") out.push(product);
      }
    }
  }
  return out;
}

/** Drop full records from search results, keeping their IDs. */
export function compactMessages(messages: unknown[]): unknown[] {
  return mapParts(messages, (part) => {
    const output = searchOutput(part);
    if (!output || output.products.length === 0) return part;
    const productIds = output.products
      .map((product) => (product as { id?: unknown } | null)?.id)
      .filter((id): id is string => typeof id === "string");
    return { ...(part as object), output: { ...output, products: [], productIds } };
  });
}

/**
 * Put the records back from the session's products. An ID with no record is
 * skipped, so the result never holds a broken product.
 */
export function hydrateMessages(messages: unknown[], products: Record<string, CatalogProduct>): unknown[] {
  return mapParts(messages, (part) => {
    const output = searchOutput(part);
    if (!output || !Array.isArray(output.productIds)) return part;
    const { productIds, ...rest } = output;
    const records = productIds.map((id) => products[id]).filter((product): product is CatalogProduct => Boolean(product));
    return { ...(part as object), output: { ...rest, products: records } };
  });
}

/** Serialized history above this many bytes gets its oldest turns dropped. The server caps it at 2 MB. */
export const SEND_BYTES = 1_500_000;

function byteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

/**
 * The history to send with a request: the newest turns, at most `max`
 * messages and about `maxBytes` once serialized. Cuts only before a buyer
 * message, so a reply never loses the question it answers. The stored
 * history keeps every turn.
 */
export function recentTurns<T extends { role: string }>(messages: T[], max: number, maxBytes = SEND_BYTES): T[] {
  // Bytes from each message to the end, counted once. Two bytes per message for "[", "]" and commas.
  const tail: number[] = new Array(messages.length + 1).fill(0);
  for (let i = messages.length - 1; i >= 0; i--) tail[i] = tail[i + 1] + byteSize(messages[i]) + 1;
  const fits = (i: number) => messages.length - i <= max && tail[i] + 1 <= maxBytes;
  if (fits(0)) return messages;

  let lastUser = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user") continue;
    lastUser = i;
    if (fits(i)) return messages.slice(i);
  }
  // Even the newest turn is over: send it alone and let the server say so.
  if (lastUser >= 0) return messages.slice(lastUser);
  return messages.slice(Math.max(0, messages.length - max));
}
