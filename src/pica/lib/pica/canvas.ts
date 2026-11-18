/**
 * Apply the model's `update_canvas` patch to the decision canvas.
 *
 * Pure: takes a canvas and a patch, returns a new canvas. Unknown item IDs
 * are skipped, not fatal, so one bad ID does not lose the rest of the patch.
 */
import { z } from "zod";
import { CATEGORIES, type Canvas, type CanvasItem, type Category } from "@/pica/lib/types";
import { stripLinks } from "./text-guard";

/** Most items a canvas holds. Past this, new items are dropped. */
export const MAX_CANVAS_ITEMS = 20;

const sourceSchema = z
  .enum(["stated", "inferred"])
  .describe('"stated" only when the buyer said it. Otherwise "inferred".');

const kindSchema = z.enum(["must_have", "preference", "open_question"]);

export const canvasPatchSchema = z.object({
  category: z
    .enum(CATEGORIES as [Category, ...Category[]])
    .nullable()
    .optional()
    .describe("Set the category. Null clears it. Leave out to keep it."),
  outcome: z
    .object({ text: z.string().min(1).max(200), source: sourceSchema })
    .nullable()
    .optional()
    .describe("The buyer's goal: what they want to be true once they own it, as a short phrase in their words."),
  budget: z
    .object({
      minUsd: z.number().nonnegative().optional(),
      maxUsd: z.number().positive().optional(),
      source: sourceSchema,
    })
    .nullable()
    .optional()
    .describe("Budget in whole US dollars. Null clears it."),
  add: z
    .array(
      z.object({
        kind: kindSchema,
        text: z.string().min(1).max(160),
        source: sourceSchema,
      }),
    )
    .optional()
    .describe("New must-haves, preferences or open questions."),
  change: z
    .array(
      z.object({
        id: z.string(),
        kind: kindSchema.optional(),
        text: z.string().min(1).max(160).optional(),
        source: sourceSchema.optional(),
      }),
    )
    .optional()
    .describe("Edit items by ID. Leave out fields you keep."),
  remove: z.array(z.string()).optional().describe("Item IDs to remove."),
});

export type CanvasPatch = z.infer<typeof canvasPatchSchema>;

export function newCanvasItemId(): string {
  return `pica-${crypto.randomUUID().slice(0, 8)}`;
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function cleanBudget(budget: NonNullable<CanvasPatch["budget"]>): Canvas["budget"] {
  let minUsd = budget.minUsd !== undefined ? Math.round(budget.minUsd) : undefined;
  let maxUsd = budget.maxUsd !== undefined ? Math.round(budget.maxUsd) : undefined;
  if (minUsd !== undefined && maxUsd !== undefined && minUsd > maxUsd) {
    [minUsd, maxUsd] = [maxUsd, minUsd];
  }
  if (minUsd === undefined && maxUsd === undefined) return null;
  return {
    ...(minUsd !== undefined ? { minUsd } : {}),
    ...(maxUsd !== undefined ? { maxUsd } : {}),
    source: budget.source,
  };
}

export function applyCanvasPatch(
  canvas: Canvas,
  patch: CanvasPatch,
  makeId: () => string = newCanvasItemId,
): Canvas {
  const next: Canvas = {
    category: canvas.category,
    outcome: canvas.outcome,
    budget: canvas.budget,
    items: canvas.items.map((item) => ({ ...item })),
  };

  if (patch.category !== undefined) next.category = patch.category;

  if (patch.outcome !== undefined) {
    const text = patch.outcome ? stripLinks(patch.outcome.text) : "";
    next.outcome = patch.outcome && text ? { text, source: patch.outcome.source } : null;
  }

  if (patch.budget !== undefined) {
    next.budget = patch.budget ? cleanBudget(patch.budget) : null;
  }

  if (patch.remove?.length) {
    const drop = new Set(patch.remove);
    next.items = next.items.filter((item) => !drop.has(item.id));
  }

  for (const change of patch.change ?? []) {
    const item = next.items.find((candidate) => candidate.id === change.id);
    if (!item) continue;
    if (change.kind) item.kind = change.kind;
    if (change.text !== undefined) {
      const text = stripLinks(change.text);
      if (text) item.text = text;
    }
    if (change.source) item.source = change.source;
  }

  for (const add of patch.add ?? []) {
    const text = stripLinks(add.text);
    if (!text) continue;
    const existing = next.items.find(
      (item) => item.kind === add.kind && sameText(item.text, text),
    );
    if (existing) {
      // A buyer restating a guess turns it into a stated item.
      if (add.source === "stated") existing.source = "stated";
      continue;
    }
    if (next.items.length >= MAX_CANVAS_ITEMS) break;
    const item: CanvasItem = { id: makeId(), kind: add.kind, text, source: add.source };
    next.items.push(item);
  }

  return next;
}

/** Texts of the canvas must-haves, for screening and prompts. */
export function mustHaves(canvas: Canvas): string[] {
  return canvas.items.filter((item) => item.kind === "must_have").map((item) => item.text);
}
