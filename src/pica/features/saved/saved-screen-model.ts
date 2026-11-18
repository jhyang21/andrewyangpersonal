/**
 * Saved's words, its card thumbnail, and where focus goes (brief 6.8). Pure.
 */
import type { CatalogProduct, DecisionSession, DecisionStatus } from "@/pica/lib/types";
import { focusAfterRemove } from "@/pica/features/parts/canvas-item-model";
import { optionRows } from "@/pica/features/workspace/shortlist-model";
import { savedCard, type SavedGroup } from "./saved-model";

export const SAVED = {
  heading: "Saved decisions",
  line: "Decisions are saved in this browser only.",
  emptyTitle: "No decisions yet",
  emptyLine: "Decisions you start show up here, so you can pick them up later.",
  start: "Start a decision",
  resume: "Resume",
  open: "Open",
  checkIn: "Check in",
  editCheckIn: "Edit check-in",
  remove: "Remove",
  removeTitle: "Remove this decision?",
  removeLine: "You can't undo this.",
  keep: "Keep it",
  confirmRemove: "Remove decision",
} as const;

/** Group headings, with no counts, and the one line under Bought. */
export const GROUPS: Record<DecisionStatus, { title: string; note?: string }> = {
  open: { title: "Open" },
  saved: { title: "Saved for later" },
  bought: { title: "Bought", note: "Pica can't see your orders. The merchant's email has your order status." },
  declined: { title: "Not buying" },
};

export const SAVED_HEADING_ID = "saved-heading";

/** The id of a card's title, which takes focus after a change to the list. */
export function savedTitleId(sessionId: string): string {
  return `saved-title-${sessionId}`;
}

/** The card menu's button, named for its card: "More for A work backpack". */
export function menuLabel(title: string): string {
  return `More for ${title}`;
}

/** "Updated Nov 17, 2026". */
export function updatedText(date: string): string {
  return `Updated ${date}`;
}

/** "Check-in saved Nov 17, 2026." */
export function checkInSavedText(date: string): string {
  return `Check-in saved ${date}.`;
}

/** What the page's hidden status line says once a check-in saves. */
export function checkInSavedStatus(title: string): string {
  return `Check-in saved for ${title}.`;
}

/** The remove sheet's line under its title. */
export function removeDescription(title: string): string {
  return `${title} and its chat leave this browser for good.`;
}

/** The product a card's thumbnail shows: the chosen one, else the first option. */
export function cardProduct(session: DecisionSession): CatalogProduct | undefined {
  return savedCard(session).product ?? optionRows(session)[0]?.product;
}

/**
 * Where focus goes once a card is removed: the next card's title in the
 * order the page shows them, else the one before, else the page heading.
 */
export function focusAfterRemoval(groups: readonly SavedGroup[], removedId: string): string {
  const ids = groups.flatMap((group) => group.sessions.map((session) => session.id));
  const next = focusAfterRemove(ids, removedId);
  return next ? savedTitleId(next) : SAVED_HEADING_ID;
}
