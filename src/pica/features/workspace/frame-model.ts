/**
 * The workspace frame's rules, without React: which view the address asks
 * for, where the chat sits in each view, the bottom bar, the summary strip,
 * the composer's words, and the banner for a closed decision.
 */
import { BASE } from "@/pica/lib/base";
import type { SummaryInput } from "@/pica/components/kit";
import type { Canvas, DecisionSession, DecisionStatus } from "@/pica/lib/types";
import { optionCount } from "@/pica/features/shared/journey";
import { guessesWaiting, needsOf, summaryStrip } from "./canvas-model";
import { messageText, replyAnnouncement, type ChatMessageLike } from "./chat-model";
import { opensCanvas, parseView, type WorkspaceView } from "./views";

/* ---------------------------------------------------------------- */
/* The address                                                       */
/* ---------------------------------------------------------------- */

/** Where a frame link goes. "canvas" is Chat with the needs open, as the path's Needs stage uses. */
export function viewHref(sessionId: string, target: WorkspaceView | "canvas"): string {
  return `${BASE}/d/${sessionId}?view=${target}`;
}

/** What a new `?view=` value asks the frame to do. */
export type ViewStep = { kind: "show"; view: WorkspaceView } | { kind: "needs" };

/**
 * The step for a change in `?view=`, or null when the value has not changed.
 * Same-route links do not remount the screen, so the frame compares the value
 * it last saw with the one in the address on each render.
 */
export function viewStep(seen: string | null, now: string | null): ViewStep | null {
  if (seen === now) return null;
  if (opensCanvas(now)) return { kind: "needs" };
  return { kind: "show", view: parseView(now) };
}

/* ---------------------------------------------------------------- */
/* Zones                                                             */
/* ---------------------------------------------------------------- */

/**
 * Where the chat sits (brief 6.2).
 * - `column`: the whole conversation. Chat on a phone; the left column on desktop.
 * - `docked`: the last exchange in a small panel above the composer. Compare, at every width.
 * - `split`: docked on a phone, the column from 1024px. Options.
 * The chat is mounted once in every view, so the thinking row, an error and
 * an open question each show in one place.
 */
export type ChatShape = "column" | "docked" | "split";

export function chatShape(view: WorkspaceView): ChatShape {
  if (view === "chat") return "column";
  return view === "options" ? "split" : "docked";
}

/**
 * Tailwind's `lg`, 1024px at the default text size: the desktop layout.
 * Written in rem, as the CSS breakpoint is, so script and CSS switch together.
 */
export const DESKTOP_QUERY = "(min-width: 64rem)";

/**
 * A load of `?view=canvas` opens the needs sheet once, and never later: the
 * flag is cleared on first read.
 */
export function takeLoadOpen(flag: { current: boolean }): boolean {
  const pending = flag.current;
  flag.current = false;
  return pending;
}

/**
 * What stays fixed on a phone (brief 6.2), as class lists. "Typing" is a
 * focused text box; "short" is a screen under 30em high: 480px at the default
 * text size, and most phones at 200% text, as em in a media query follows
 * the buyer's text size. Both are phone only (below `lg`).
 * - The strip is sticky; it hides while typing and scrolls with the page when short.
 * - The docked thread's title row hides while typing and when short.
 * - Its lines are two at most, one when short.
 * Visually hidden rather than removed, so the strip's status region still speaks.
 */
export const PHONE_FIXED = {
  strip: "sticky top-2 z-20 max-lg:[html:has(textarea:focus)_&]:sr-only max-lg:[@media(max-height:29.99em)]:static",
  titleRow: "max-lg:[html:has(textarea:focus)_&]:sr-only max-lg:[@media(max-height:29.99em)]:sr-only",
  lines: "line-clamp-2 [@media(max-height:29.99em)]:line-clamp-1",
} as const;

/* ---------------------------------------------------------------- */
/* The composer                                                      */
/* ---------------------------------------------------------------- */

export const COMPOSER = {
  chatLabel: "Message Pica",
  stageLabel: "Ask Pica about these options",
  submit: "Send message",
  placeholder: "Ask Pica or add a detail",
  answerPlaceholder: "Type your own answer",
} as const;

/** The composer's label: the full chat input in Chat, the one-line input over Options and Compare. */
export function composerLabel(view: WorkspaceView): string {
  return view === "chat" ? COMPOSER.chatLabel : COMPOSER.stageLabel;
}

export function composerPlaceholder(questionOpen: boolean): string {
  return questionOpen ? COMPOSER.answerPlaceholder : COMPOSER.placeholder;
}

/**
 * After a `bad_request` (the conversation is full, or the message too long:
 * the server does not say which), the buyer's last words go back in the
 * composer if it is empty, so nothing typed is lost. Null leaves it alone.
 */
export function restoredDraft(
  errorCode: string | undefined,
  draft: string,
  messages: readonly ChatMessageLike[],
): string | null {
  if (errorCode !== "bad_request" || draft.trim()) return null;
  const last = messages.findLast((message) => message.role === "user");
  return last ? messageText(last) || null : null;
}

/**
 * The thread once refused words are back in the composer: the buyer's
 * message at the end goes, so sending the words again carries them once.
 * The same list when the last message is not the buyer's.
 */
export function withoutRefused<T extends ChatMessageLike>(messages: T[]): T[] {
  return messages.at(-1)?.role === "user" ? messages.slice(0, -1) : messages;
}

/**
 * A plain click: the main button, no modifier key. Any other click may open
 * a new tab or window and leave this page, so it sets nothing on arrival.
 */
export function isPlainClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/* ---------------------------------------------------------------- */
/* The live announcement                                             */
/* ---------------------------------------------------------------- */

export interface FinishFlags {
  isError: boolean;
  isAbort: boolean;
  isDisconnect: boolean;
}

/**
 * What the live region says when a reply ends. A reply that failed, was
 * stopped or lost its connection says nothing: the error's alert speaks.
 */
export function finishAnnouncement(message: ChatMessageLike, flags: FinishFlags): string {
  if (flags.isError || flags.isAbort || flags.isDisconnect) return "";
  return replyAnnouncement(message);
}

/* ---------------------------------------------------------------- */
/* The bottom bar                                                    */
/* ---------------------------------------------------------------- */

export interface BarEntry {
  id: WorkspaceView;
  href: string;
  label: string;
  count: number;
  countLabel?: string;
}

/**
 * Chat, Options and Compare. Options counts the options; Compare counts the
 * options picked to compare. A count shows once it is above zero.
 */
export function barEntries(session: DecisionSession, picks: number): BarEntry[] {
  const options = optionCount(session);
  return [
    { id: "chat", href: viewHref(session.id, "chat"), label: "Chat", count: 0 },
    {
      id: "options",
      href: viewHref(session.id, "options"),
      label: "Options",
      count: options,
      countLabel: `${options} ${options === 1 ? "option" : "options"}`,
    },
    {
      id: "compare",
      href: viewHref(session.id, "compare"),
      label: "Compare",
      count: picks,
      countLabel: `${picks} picked to compare`,
    },
  ];
}

/* ---------------------------------------------------------------- */
/* The summary strip                                                 */
/* ---------------------------------------------------------------- */

/**
 * The kit strip's input, in the words `summaryStrip` already uses: the
 * category in the plural ("Backpacks") and the budget in short ("under $200").
 * The parts come out of `summaryStrip` in order, so neither word list is copied.
 */
export function summaryInput(canvas: Canvas): SummaryInput {
  const { parts } = summaryStrip(canvas);
  let next = 0;
  const goal = canvas.outcome?.text.trim() ? parts[next++] : null;
  const category = canvas.category ? parts[next++] : null;
  const budget = canvas.budget && (canvas.budget.minUsd !== undefined || canvas.budget.maxUsd !== undefined) ? parts[next++] : null;
  return { goal, category, budget, needs: needsOf(canvas).length, toConfirm: guessesWaiting(canvas) };
}

/* ---------------------------------------------------------------- */
/* A closed decision                                                 */
/* ---------------------------------------------------------------- */

export interface ClosedBanner {
  title: string;
  body: string;
  action: { label: string; href?: string; reopen?: true };
}

/** The banner over a decision that is no longer open, or null while it is open. */
export function closedBanner(status: DecisionStatus): ClosedBanner | null {
  switch (status) {
    case "open":
      return null;
    case "saved":
      return {
        title: "Saved for later",
        body: "Pick up where you left off. Pica still has your needs and options.",
        action: { label: "Reopen this decision", reopen: true },
      };
    case "declined":
      return {
        title: "You decided not to buy",
        body: "Deciding not to buy is a real answer. You can still look things over here.",
        action: { label: "Reopen this decision", reopen: true },
      };
    case "bought":
      return {
        title: "You bought this",
        body: "Your order details are in the merchant's confirmation email.",
        action: { label: "Check in on your purchase", href: `${BASE}/saved` },
      };
  }
}
