/**
 * The chat thread as rows, without React: bubbles, notes for Pica's tool work,
 * confirm cards for its guesses and question cards.
 */
import type { Canvas, PicaQuestion } from "@/pica/lib/types";
import {
  canvasUpdates,
  guessState,
  messageText,
  NO_RESULTS_MESSAGE,
  openQuestion,
  plainText,
  searchedProductCount,
  toolNoteOf,
  type CanvasUpdate,
  type ChatMessageLike,
} from "./chat-model";
import { SKIP_MESSAGE } from "./useChatActions";

/**
 * Where a note's link goes. Only Compare: on desktop the options sit beside
 * the chat and the strip shows the needs, so notes for those would repeat
 * what is already on screen.
 */
export type NoteTarget = "compare";

/** Where a question stands. */
export type QuestionState =
  | { kind: "open" }
  | { kind: "answered"; answer: string }
  | { kind: "skipped" };

export type ThreadRow =
  | { kind: "user"; key: string; text: string }
  | { kind: "pica"; key: string; text: string }
  /** A line from the server inside Pica's reply (catalog down, no results): Pica's bubble, unsure. */
  | { kind: "problem"; key: string; text: string }
  /** A small centred line naming the place it links to. */
  | { kind: "note"; key: string; text: string; target: NoteTarget }
  | { kind: "confirm"; key: string; update: CanvasUpdate }
  | { kind: "question"; key: string; toolCallId: string; question: PicaQuestion; number: number; state: QuestionState };

export interface ThreadOptions {
  /** The canvas before the first update. Empty by default. */
  start?: Canvas;
  /** Needs the buyer added by hand on this page load (`ws.addedByHand`). */
  byHand?: Iterable<string>;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const NOTE_LINKS: Record<NoteTarget, string> = {
  compare: "See the comparison",
};

/** What the buyer sent after the message at `index`, if anything. */
function replyAfter(messages: readonly ChatMessageLike[], index: number): ChatMessageLike | null {
  for (let i = index + 1; i < messages.length; i++) {
    if (messages[i].role === "user") return messages[i];
  }
  return null;
}

function questionState(messages: readonly ChatMessageLike[], index: number): QuestionState {
  const reply = replyAfter(messages, index);
  if (!reply) return { kind: "open" };
  const answer = messageText(reply);
  return answer === SKIP_MESSAGE ? { kind: "skipped" } : { kind: "answered", answer };
}

/**
 * Every row of the thread, in order. Running and failed tool calls have no
 * row. Needs updates, searches and new shortlists show no note: the strip and
 * the options beside the chat already show them. A search that failed or
 * found nothing still says so, once per reply. Questions count from the last
 * shortlist, as Pica's limit of four does.
 */
export function threadRows(messages: readonly ChatMessageLike[], options: ThreadOptions = {}): ThreadRow[] {
  const updates = new Map(canvasUpdates(messages, options).map((update) => [update.toolCallId, update]));
  const rows: ThreadRow[] = [];
  let questionsSinceShortlist = 0;

  messages.forEach((message, index) => {
    const id = message.id ?? `m${index}`;
    let searchSeen = false;
    message.parts.forEach((part, partIndex) => {
      const key = `${id}-${partIndex}`;
      if (part.type === "text") {
        const text = (part.text ?? "").trim();
        if (!text) return;
        if (message.role === "user") rows.push({ kind: "user", key, text });
        else if (message.role === "assistant") rows.push({ kind: "pica", key, text: plainText(text) });
        return;
      }
      if (message.role !== "assistant") return;
      const note = toolNoteOf(part);
      if (!note) return;
      switch (note.kind) {
        case "canvas": {
          const update = updates.get(note.toolCallId);
          if (update && update.guesses.length > 0) rows.push({ kind: "confirm", key: `${key}-confirm`, update });
          return;
        }
        case "search": {
          if (note.problem) {
            rows.push({ kind: "problem", key, text: note.problem.message });
            return;
          }
          if (searchSeen) return;
          searchSeen = true;
          if (searchedProductCount(message) === 0) rows.push({ kind: "problem", key, text: NO_RESULTS_MESSAGE });
          return;
        }
        case "shortlist":
          questionsSinceShortlist = 0;
          return;
        case "compare":
          rows.push({
            kind: "note",
            key,
            text: `Comparing ${plural(note.count, "option", "options")}`,
            target: "compare",
          });
          return;
        case "question":
          questionsSinceShortlist += 1;
          rows.push({
            kind: "question",
            key,
            toolCallId: note.toolCallId,
            question: note.question,
            number: questionsSinceShortlist,
            state: questionState(messages, index),
          });
          return;
      }
    });
  });
  return rows;
}

/**
 * The first row of Pica's newest reply: the rows after the buyer's last
 * message, or, while that message has no reply, the reply before it. -1 when
 * Pica has said nothing. "Open chat" on a phone sends focus here.
 */
export function newestReplyStart(rows: readonly ThreadRow[]): number {
  let end = rows.length - 1;
  while (end >= 0 && rows[end].kind === "user") end--;
  if (end < 0) return -1;
  let begin = end;
  while (begin > 0 && rows[begin - 1].kind !== "user") begin--;
  return begin;
}

/** The plain lines the phone dock shows in place of a card, which lives in Chat. */
export const DOCK_LINES = {
  question: "Pica asked a question",
  guesses: "Pica has guesses to confirm",
} as const;

/**
 * What the docked thread shows on a phone, beside "Open chat" (brief 6.2):
 * - `banner`: an error or "no reply came", in full, below; no line.
 * - `thinking`: the thinking row while Pica works.
 * - `card`: one plain line naming an open question or guesses to confirm.
 * - `reply`: the start of Pica's newest reply, cut at two lines by CSS. Pica's
 *   own problem lines count; the buyer's message never shows.
 * - `none`: Pica has said nothing yet.
 * Within a reply, an open question comes first, then guesses still waiting,
 * then Pica's first words, then its first note.
 */
export type DockLine =
  | { kind: "banner" }
  | { kind: "thinking" }
  | { kind: "card"; text: string }
  | { kind: "reply"; text: string }
  | { kind: "none" };

export interface DockInput {
  busy: boolean;
  /** An error or the "no reply came" banner shows. */
  banner: boolean;
  /** The canvas now, for whether any guess still waits. */
  canvas: Canvas;
}

export function dockLine(rows: readonly ThreadRow[], { busy, banner, canvas }: DockInput): DockLine {
  if (banner) return { kind: "banner" };
  if (busy) return { kind: "thinking" };
  const begin = newestReplyStart(rows);
  if (begin < 0) return { kind: "none" };
  let end = begin;
  while (end + 1 < rows.length && rows[end + 1].kind !== "user") end++;
  const reply = rows.slice(begin, end + 1);
  if (reply.some((row) => row.kind === "question" && row.state.kind === "open")) {
    return { kind: "card", text: DOCK_LINES.question };
  }
  const waiting = reply.some(
    (row) => row.kind === "confirm" && row.update.guesses.some((guess) => guessState(guess, canvas) === "open"),
  );
  if (waiting) return { kind: "card", text: DOCK_LINES.guesses };
  const words =
    reply.find((row) => row.kind === "pica" || row.kind === "problem") ?? reply.find((row) => row.kind === "note");
  return words ? { kind: "reply", text: words.text } : { kind: "none" };
}

/** Whether the question card takes answers now: it is the open question and Pica is not replying. */
export function questionLive(messages: readonly ChatMessageLike[], busy: boolean, toolCallId: string): boolean {
  return openQuestion(messages, busy)?.toolCallId === toolCallId;
}
