/**
 * The chat's rules, without React: reply state, errors, questions, the notes
 * for Pica's tool work, and the confirm cards for Pica's guesses.
 *
 * Messages are read through a loose shape (`ChatMessageLike`) so the tests
 * need no AI SDK objects. `PicaUIMessage` fits it.
 */
import { PICA_MESSAGES } from "@/pica/lib/pica/constants";
import {
  EMPTY_CANVAS,
  type ApiError,
  type AskQuestionOutput,
  type Canvas,
  type CanvasItem,
  type CompareProductsOutput,
  type PicaQuestion,
  type PresentShortlistOutput,
  type SearchCatalogOutput,
  type UpdateCanvasOutput,
} from "@/pica/lib/types";
import { asApiError, OFFLINE_MESSAGE } from "@/pica/features/shared/api";
import { isNeed } from "./canvas-model";

export interface ChatPart {
  type: string;
  text?: string;
  state?: string;
  toolCallId?: string;
  output?: unknown;
}

export interface ChatMessageLike {
  id?: string;
  role: string;
  parts: readonly ChatPart[];
}

/** `useChat`'s status. */
export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

/** True while Pica replies: the request is out or the reply is streaming. */
export function isBusy(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}

const KNOWN_MESSAGES = new Set<string>([...Object.values(PICA_MESSAGES), OFFLINE_MESSAGE]);

/**
 * Turns `useChat`'s error into words for the buyer.
 * Before the stream: the body is JSON `{ error }`. Mid-stream: Pica's own message.
 */
export function chatErrorFrom(error: Error | undefined): ApiError | null {
  if (!error) return null;
  try {
    const parsed = asApiError(JSON.parse(error.message));
    if (parsed) return parsed;
  } catch {
    // Not JSON: fall through.
  }
  if (KNOWN_MESSAGES.has(error.message)) return { code: "model_unavailable", message: error.message };
  if (/fetch|network|load failed/i.test(error.message)) return { code: "unknown", message: OFFLINE_MESSAGE };
  return { code: "model_unavailable", message: PICA_MESSAGES.modelUnavailable };
}

/** Text of a message, joined. */
export function messageText(message: ChatMessageLike): string {
  return message.parts
    .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
    .join("\n")
    .trim();
}

/** What the screen reader hears when a reply ends. */
export function replyAnnouncement(message: ChatMessageLike): string {
  const text = messageText(message);
  return text ? `Pica replied: ${text.slice(0, 400)}` : "Pica updated your decision";
}

/** Drop the light markdown Pica sometimes writes; the chat shows plain text. */
export function plainText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/^#+\s*/gm, "");
}

/** A finished tool part, or null for text, failed calls and calls still running. */
function finishedTool(part: ChatPart): { name: string; toolCallId: string; output: unknown } | null {
  if (!part.type.startsWith("tool-")) return null;
  if (part.state !== "output-available" || part.output == null) return null;
  return { name: part.type.slice("tool-".length), toolCallId: part.toolCallId ?? "", output: part.output };
}

/* ---------------------------------------------------------------- */
/* Questions                                                         */
/* ---------------------------------------------------------------- */

export interface QuestionPart {
  toolCallId: string;
  question: PicaQuestion;
}

/** Every question Pica asked, oldest first. */
export function questionParts(messages: readonly ChatMessageLike[]): QuestionPart[] {
  const out: QuestionPart[] = [];
  for (const message of messages) {
    for (const part of message.parts) {
      const tool = finishedTool(part);
      if (tool?.name === "ask_question") {
        out.push({ toolCallId: tool.toolCallId, question: (tool.output as AskQuestionOutput).question });
      }
    }
  }
  return out;
}

/** The question waiting for an answer: the last one in Pica's last reply, once the reply is done. */
export function openQuestion(messages: readonly ChatMessageLike[], busy: boolean): QuestionPart | null {
  const last = messages.at(-1);
  if (busy || last?.role !== "assistant") return null;
  return questionParts([last]).at(-1) ?? null;
}

/** The buyer's message is the last one, no reply is coming, and no error says why. */
export function isUnanswered(messages: readonly ChatMessageLike[], busy: boolean, hasError: boolean): boolean {
  return !busy && !hasError && messages.at(-1)?.role === "user";
}

/** "Show me products now" shows once Pica has replied and no shortlist exists. */
export function offersProductsNow(messages: readonly ChatMessageLike[], busy: boolean, hasShortlist: boolean): boolean {
  return !hasShortlist && !busy && messages.some((message) => message.role === "assistant");
}

/* ---------------------------------------------------------------- */
/* Notes for Pica's tool work                                        */
/* ---------------------------------------------------------------- */

export type ToolNote =
  | { kind: "canvas"; toolCallId: string }
  /** `count` is what this one search returned; `problem` is the server's own words. */
  | { kind: "search"; toolCallId: string; count: number; problem: ApiError | null }
  | { kind: "shortlist"; toolCallId: string; count: number }
  | { kind: "compare"; toolCallId: string; count: number }
  | { kind: "question"; toolCallId: string; question: PicaQuestion };

/** The note for one finished tool part. Failed and running calls have none. */
export function toolNoteOf(part: ChatPart): ToolNote | null {
  const tool = finishedTool(part);
  if (!tool) return null;
  const { toolCallId } = tool;
  switch (tool.name) {
    case "update_canvas":
      return { kind: "canvas", toolCallId };
    case "search_catalog": {
      const output = tool.output as SearchCatalogOutput;
      return { kind: "search", toolCallId, count: output.products?.length ?? 0, problem: output.problem ?? null };
    }
    case "present_shortlist":
      return { kind: "shortlist", toolCallId, count: (tool.output as PresentShortlistOutput).shortlist?.entries?.length ?? 0 };
    case "compare_products":
      return { kind: "compare", toolCallId, count: (tool.output as CompareProductsOutput).comparison?.productIds?.length ?? 0 };
    case "ask_question":
      return { kind: "question", toolCallId, question: (tool.output as AskQuestionOutput).question };
    default:
      return null;
  }
}

/** The fallback line when a search found nothing and said no more. */
export const NO_RESULTS_MESSAGE = PICA_MESSAGES.noResults;

/**
 * Distinct products every search in one reply returned. This is the number the
 * search note shows, never the catalog's estimate of all matches.
 */
export function searchedProductCount(message: ChatMessageLike): number {
  const ids = new Set<string>();
  for (const part of message.parts) {
    const tool = finishedTool(part);
    if (tool?.name !== "search_catalog") continue;
    for (const product of (tool.output as SearchCatalogOutput).products ?? []) ids.add(product.id);
  }
  return ids.size;
}

/* ---------------------------------------------------------------- */
/* Confirm cards for Pica's guesses                                  */
/* ---------------------------------------------------------------- */

/** Rows a confirm card shows before "See all in your needs". */
export const CONFIRM_CARD_ROWS = 3;

/** What one canvas update from Pica added and guessed. Only needs count. */
export interface CanvasUpdate {
  toolCallId: string;
  /** Needs Pica added: not on the canvas before this update, and not added by the buyer. */
  added: CanvasItem[];
  /** Needs Pica guessed in this update: new, or reworded since the last update. */
  guesses: CanvasItem[];
}

export interface CanvasUpdatesOptions {
  /** The canvas before the first update. Empty by default. */
  start?: Canvas;
  /**
   * Ids of needs the buyer added by hand. Pica's next update carries them
   * along, so without these they would count as Pica's.
   */
  byHand?: Iterable<string>;
}

/** Each `update_canvas` in the history, in order, against the canvas before it. */
export function canvasUpdates(
  messages: readonly ChatMessageLike[],
  { start = EMPTY_CANVAS, byHand = [] }: CanvasUpdatesOptions = {},
): CanvasUpdate[] {
  const out: CanvasUpdate[] = [];
  const buyers = new Set(byHand);
  let before = start;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      const tool = finishedTool(part);
      if (tool?.name !== "update_canvas") continue;
      const canvas = (tool.output as UpdateCanvasOutput).canvas;
      if (!canvas) continue;
      const old = new Map(before.items.map((item) => [item.id, item]));
      const needs = canvas.items.filter(isNeed);
      out.push({
        toolCallId: tool.toolCallId,
        added: needs.filter((item) => !old.has(item.id) && !buyers.has(item.id)),
        guesses: needs.filter((item) => {
          if (item.source !== "inferred") return false;
          const prior = old.get(item.id);
          return !prior || prior.source !== "inferred" || prior.text !== item.text || prior.kind !== item.kind;
        }),
      });
      before = canvas;
    }
  }
  return out;
}

/**
 * Where a guess stands now.
 * - `open`: still Pica's guess, as guessed. Confirm and Edit show.
 * - `confirmed`: the buyer confirmed it, words unchanged. "You confirmed this".
 * - `changed`: changed or removed since. "Changed in your needs", no buttons.
 */
export type GuessState = "open" | "confirmed" | "changed";

export function guessState(guess: CanvasItem, canvas: Canvas): GuessState {
  const now = canvas.items.find((item) => item.id === guess.id);
  if (!now || now.text !== guess.text || now.kind !== guess.kind) return "changed";
  return now.source === "stated" ? "confirmed" : "open";
}

export interface ConfirmRow {
  item: CanvasItem;
  state: GuessState;
}

export interface ConfirmCard {
  toolCallId: string;
  /** Up to three rows. */
  rows: ConfirmRow[];
  /** Guesses past the first three; above zero, the card links to the needs. */
  more: number;
}

/** The card for one update, or null when it guessed no needs. */
export function confirmCard(update: CanvasUpdate, canvas: Canvas): ConfirmCard | null {
  if (update.guesses.length === 0) return null;
  return {
    toolCallId: update.toolCallId,
    rows: update.guesses.slice(0, CONFIRM_CARD_ROWS).map((item) => ({ item, state: guessState(item, canvas) })),
    more: Math.max(0, update.guesses.length - CONFIRM_CARD_ROWS),
  };
}
