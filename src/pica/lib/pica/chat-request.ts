/**
 * Reads and bounds the body of `POST /api/chat`. Server-only.
 *
 * Every string the session carries has a cap, so one request can't fill the
 * prompt or the server's memory. Product fields over a cap are cut, not
 * rejected: they come from the catalog, and the session keeps sending them,
 * so a reject would fail every later request.
 */
import { z } from "zod";
import { CATEGORIES, type Category, type ChatSessionContext } from "@/pica/lib/types";
import { CHAT_LIMITS as L, PICA_MESSAGES } from "./constants";
import { sentenceParts } from "./text-guard";

const source = z.enum(["stated", "inferred"]);
const id = z.string().max(L.idChars);

const canvasSchema = z.object({
  category: z.enum(CATEGORIES as [Category, ...Category[]]).nullable(),
  outcome: z.object({ text: z.string().max(L.canvasTextChars), source }).nullable(),
  budget: z
    .object({ minUsd: z.number().optional(), maxUsd: z.number().optional(), source })
    .nullable(),
  items: z
    .array(
      z.object({
        id,
        kind: z.enum(["must_have", "preference", "open_question"]),
        text: z.string().max(L.canvasTextChars),
        source,
      }),
    )
    .max(L.canvasItems),
});

/** A catalog string, cut to `max`. */
const cut = (max: number) => z.string().transform((text) => text.slice(0, max));

/**
 * Merchant prose cut to `max` at a sentence's end, so no half sentence or
 * half number ("1.2" of "1.25 kg") is left. With no sentence end, it is cut
 * at a word and the last part word dropped.
 */
export function cutProse(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const parts = sentenceParts(head);
  if (parts.length > 1) return parts.slice(0, -1).join("").trimEnd();
  const space = head.search(/\s\S*$/);
  return space > 0 ? head.slice(0, space).trimEnd() : "";
}
const cutText = (max: number) => z.string().transform((text) => cutProse(text, max));
/** A catalog list, cut to `max` items. */
const cutList = <T extends z.ZodType>(item: T, max: number) =>
  z.array(item).transform((items) => items.slice(0, max));

const money = z.object({ amount: z.number(), currency: z.string().max(8) });
const summaryList = cutList(cutText(L.summaryItemChars), L.summaryItems);

/** Deepest nesting kept in a product's other fields. */
const MAX_DEPTH = 12;

/** A copy of `value` with every string cut to `limit` and nesting past `MAX_DEPTH` dropped. */
function capStrings(value: unknown, limit: number, depth = 0): unknown {
  if (typeof value === "string") return value.slice(0, limit);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return null;
  if (Array.isArray(value)) return value.map((child) => capStrings(child, limit, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, capStrings(child, limit, depth + 1)]));
}

/**
 * The fields Pica reads from a product, cut to their caps. Other fields, such
 * as image and variant URLs, pass through with each string cut to the
 * catch-all cap.
 */
const productSchema = z
  .looseObject({
    id: z.string(),
    title: cut(L.nameChars),
    descriptionText: cutText(L.descriptionChars),
    seller: z.looseObject({ id: cut(L.idChars), name: cut(L.nameChars) }),
    priceRange: z.object({ min: money, max: money }),
    options: cutList(
      z.looseObject({
        name: cut(L.nameChars),
        values: cutList(z.looseObject({ label: cut(L.nameChars) }), L.optionValues),
      }),
      L.options,
    ),
    summarized: z.object({
      sellingPoints: summaryList,
      features: summaryList,
      specs: summaryList,
    }),
  })
  .transform((product) => capStrings(product, L.otherStringChars) as typeof product);

const sessionSchema = z.object({
  sessionId: id,
  canvas: canvasSchema,
  // A product whose ID passes the cap can't be named safely, so it is left
  // out. Past the product cap, the newest products stay.
  products: z
    .array(productSchema)
    .transform((products) => products.filter((product) => product.id.length <= L.idChars).slice(-L.products)),
  shortlistProductIds: z.array(id).max(L.shortlistIds),
  canvasChangedSinceShortlist: z.boolean(),
});

/**
 * Read the request body as text, stopping once it passes `maxBytes`. A
 * missing or false `content-length` can't make the server hold more.
 */
export async function readBodyText(
  request: Request,
  maxBytes: number = L.bodyBytes,
): Promise<{ ok: true; text: string } | { ok: false; tooLarge: boolean }> {
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, tooLarge: false };
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

function partsOf(message: unknown): unknown[] {
  const parts = (message as { parts?: unknown } | null)?.parts;
  return Array.isArray(parts) ? parts : [];
}

function partType(part: unknown): unknown {
  return (part as { type?: unknown } | null)?.type;
}

/** Characters of text in one message's text parts. */
function textLength(message: unknown): number {
  let length = 0;
  for (const part of partsOf(message)) {
    const text = (part as { text?: unknown } | null)?.text;
    if (partType(part) === "text" && typeof text === "string") length += text.length;
  }
  return length;
}

function roleOf(message: unknown): unknown {
  return (message as { role?: unknown } | null)?.role;
}

function isUserMessage(message: unknown): boolean {
  return roleOf(message) === "user";
}

export type ChatBodyResult =
  | { ok: true; messages: unknown[]; session: ChatSessionContext }
  | { ok: false; message: string };

const bad = (message: string = PICA_MESSAGES.badRequest): ChatBodyResult => ({ ok: false, message });

/**
 * Parse the raw body text. Too large or too long answers `tooLong`; anything
 * malformed answers `badRequest`. Both are buyer-facing.
 */
export function parseChatBody(text: string): ChatBodyResult {
  if (new TextEncoder().encode(text).length > L.bodyBytes) return bad(PICA_MESSAGES.tooLong);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return bad();
  }
  if (typeof raw !== "object" || raw === null) return bad();

  const { messages, session } = raw as { messages?: unknown; session?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) return bad();
  if (messages.length > L.messages) return bad(PICA_MESSAGES.tooLong);
  // The client sends only the buyer's and Pica's turns: no system text.
  if (messages.some((message) => roleOf(message) !== "user" && roleOf(message) !== "assistant")) return bad();
  // The buyer sends text only: no files, no tool results.
  const nonText = (message: unknown) => partsOf(message).some((part) => partType(part) !== "text");
  if (messages.some((message) => isUserMessage(message) && nonText(message))) return bad();
  const longMessage = messages.find((message) => textLength(message) > L.messageChars);
  if (longMessage) return bad(isUserMessage(longMessage) ? PICA_MESSAGES.messageTooLong : PICA_MESSAGES.tooLong);
  // The history has its own cap, apart from the session's products.
  if (new TextEncoder().encode(JSON.stringify(messages)).length > L.historyBytes) {
    return bad(PICA_MESSAGES.tooLong);
  }

  const parsed = sessionSchema.safeParse(session);
  if (!parsed.success) return bad();

  return { ok: true, messages, session: parsed.data as unknown as ChatSessionContext };
}
