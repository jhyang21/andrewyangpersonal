/**
 * The canvas's rules, without React: what counts as a need, the summary strip,
 * the edits each form sends, and what each edit reports to analytics.
 */
import { CATEGORY_WORDS } from "@/pica/features/shared/categories";
import type { CanvasEdit } from "@/pica/lib/session";
import type { Canvas, CanvasItem, CanvasItemKind, Category } from "@/pica/lib/types";

/** A need is a must-have or a nice-to-have. Budget, outcome and open questions are not. */
export const NEED_KINDS: readonly CanvasItemKind[] = ["must_have", "preference"];

export function isNeed(item: CanvasItem): boolean {
  return NEED_KINDS.includes(item.kind);
}

export function needsOf(canvas: Canvas): CanvasItem[] {
  return canvas.items.filter(isNeed);
}

/** Every guess on the canvas still waiting for the buyer: outcome, budget and items. */
export function guessesWaiting(canvas: Canvas): number {
  return (
    (canvas.outcome?.source === "inferred" ? 1 : 0) +
    (canvas.budget?.source === "inferred" ? 1 : 0) +
    canvas.items.filter((item) => item.source === "inferred").length
  );
}

export function itemsOfKind(canvas: Canvas, kind: CanvasItemKind): CanvasItem[] {
  return canvas.items.filter((item) => item.kind === kind);
}

/* ---------------------------------------------------------------- */
/* Words                                                             */
/* ---------------------------------------------------------------- */

/** "3 needs", "1 need". */
export function needsText(count: number): string {
  return `${count} ${count === 1 ? "need" : "needs"}`;
}

/** The budget as the canvas row says it: "$50 to $100", "Up to $100", "From $50". */
export function budgetText(budget: Canvas["budget"]): string {
  if (!budget) return "Not set yet";
  if (budget.minUsd !== undefined && budget.maxUsd !== undefined) return `$${budget.minUsd} to $${budget.maxUsd}`;
  if (budget.maxUsd !== undefined) return `Up to $${budget.maxUsd}`;
  if (budget.minUsd !== undefined) return `From $${budget.minUsd}`;
  return "Not set yet";
}

/** The budget inside the summary strip: "under $200", "$50 to $200", "from $50". */
function budgetShort(budget: Canvas["budget"]): string | null {
  if (!budget) return null;
  if (budget.minUsd !== undefined && budget.maxUsd !== undefined) return `$${budget.minUsd} to $${budget.maxUsd}`;
  if (budget.maxUsd !== undefined) return `under $${budget.maxUsd}`;
  if (budget.minUsd !== undefined) return `from $${budget.minUsd}`;
  return null;
}

/**
 * The one-line summary, goal first: "A lighter commute · Backpacks · under $200 · 3 needs · 1 to confirm".
 * Parts with no value are left out; with nothing yet it reads "Your needs: none yet".
 */
export function summaryStrip(canvas: Canvas): { parts: string[]; text: string } {
  const needs = needsOf(canvas).length;
  const waiting = guessesWaiting(canvas);
  const parts = [
    canvas.outcome?.text.trim() || null,
    canvas.category ? CATEGORY_WORDS[canvas.category].many : null,
    budgetShort(canvas.budget),
    needs > 0 ? needsText(needs) : null,
    waiting > 0 ? `${waiting} to confirm` : null,
  ].filter((part): part is string => part !== null);
  return { parts, text: parts.length > 0 ? parts.join(" · ") : "Your needs: none yet" };
}

/* ---------------------------------------------------------------- */
/* Edits                                                             */
/* ---------------------------------------------------------------- */

/** Saving an item's form. Null when there is nothing to send: blank, or the buyer's own words unchanged. */
export function itemSaveEdit(item: CanvasItem, text: string): CanvasEdit | null {
  const value = text.trim();
  if (!value) return null;
  if (value === item.text && item.source === "stated") return null;
  return { kind: "item_changed", id: item.id, text: value };
}

/** Adding an item. Null when the text is blank. */
export function itemAddEdit(kind: CanvasItemKind, text: string, id: string): CanvasEdit | null {
  const value = text.trim();
  if (!value) return null;
  return { kind: "item_added", item: { id, kind, text: value } };
}

/**
 * The ids of needs the buyer added by hand, after one edit: the new id joins
 * when the edit added an item and landed. The same list back otherwise.
 */
export function recordHandAdded(ids: readonly string[], edit: CanvasEdit, landed: boolean): readonly string[] {
  if (!landed || edit.kind !== "item_added" || ids.includes(edit.item.id)) return ids;
  return [...ids, edit.item.id];
}

/** Tapping a category chip: picks it, or clears it when it is already picked. */
export function categoryEdit(current: Category | null, tapped: Category): CanvasEdit {
  return { kind: "category", category: current === tapped ? null : tapped };
}

/** What a guess's "Confirm" sends. */
export type GuessTarget = { kind: "item"; id: string } | { kind: "outcome" } | { kind: "budget" };

export function confirmEdit(target: GuessTarget): CanvasEdit {
  if (target.kind === "item") return { kind: "item_confirmed", id: target.id };
  return target.kind === "outcome" ? { kind: "outcome_confirmed" } : { kind: "budget_confirmed" };
}

/** The budget form's starting values. */
export function budgetFields(budget: Canvas["budget"]): { min: string; max: string } {
  return {
    min: budget?.minUsd !== undefined ? String(budget.minUsd) : "",
    max: budget?.maxUsd !== undefined ? String(budget.maxUsd) : "",
  };
}

/**
 * The props `requirement_edited` carries for an edit. `canvas` is the canvas
 * before the edit, so a removed item still has its kind. Null when the item is
 * not on the canvas: the store refuses that edit anyway.
 */
export function editAnalytics(edit: CanvasEdit, canvas: Canvas): { action: string; itemKind: string } | null {
  const kindOf = (id: string) => canvas.items.find((item) => item.id === id)?.kind ?? null;
  const item = (action: string, id: string) => {
    const kind = kindOf(id);
    return kind ? { action, itemKind: kind } : null;
  };
  switch (edit.kind) {
    case "category":
      return { action: "changed", itemKind: "category" };
    case "outcome":
      return { action: "changed", itemKind: "outcome" };
    case "outcome_confirmed":
      return { action: "confirmed", itemKind: "outcome" };
    case "budget":
      return { action: "changed", itemKind: "budget" };
    case "budget_confirmed":
      return { action: "confirmed", itemKind: "budget" };
    case "item_added":
      return { action: "added", itemKind: edit.item.kind };
    case "item_changed":
      return item("changed", edit.id);
    case "item_removed":
      return item("removed", edit.id);
    case "item_confirmed":
      return item("confirmed", edit.id);
  }
}
