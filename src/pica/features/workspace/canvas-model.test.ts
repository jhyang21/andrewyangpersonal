import { describe, expect, it } from "vitest";
import type { Canvas, CanvasItem } from "@/pica/lib/types";
import {
  budgetFields,
  budgetText,
  categoryEdit,
  confirmEdit,
  editAnalytics,
  guessesWaiting,
  itemAddEdit,
  itemSaveEdit,
  needsOf,
  recordHandAdded,
  summaryStrip,
} from "./canvas-model";

const item = (id: string, kind: CanvasItem["kind"], source: CanvasItem["source"] = "stated"): CanvasItem => ({
  id,
  kind,
  text: `Item ${id}`,
  source,
});

const canvas: Canvas = {
  category: "backpack",
  outcome: { text: "A work backpack", source: "stated" },
  budget: { maxUsd: 200, source: "stated" },
  items: [item("a", "must_have"), item("b", "preference", "inferred"), item("c", "must_have"), item("q", "open_question")],
};

describe("needs", () => {
  it("a need is a must-have or a nice-to-have", () => {
    expect(needsOf(canvas).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("counts every guess still waiting, outcome and budget included", () => {
    expect(guessesWaiting(canvas)).toBe(1);
    expect(
      guessesWaiting({
        ...canvas,
        outcome: { text: "x", source: "inferred" },
        budget: { maxUsd: 1, source: "inferred" },
      }),
    ).toBe(3);
  });
});

describe("summary strip", () => {
  it("reads the goal first, then category, budget, needs and guesses", () => {
    expect(summaryStrip(canvas).text).toBe("A work backpack · Backpacks · under $200 · 3 needs · 1 to confirm");
  });

  it("leaves out parts with no value", () => {
    const one: Canvas = { category: null, outcome: null, budget: { minUsd: 50, source: "stated" }, items: [item("a", "must_have")] };
    expect(summaryStrip(one).text).toBe("from $50 · 1 need");
    expect(summaryStrip({ ...one, budget: { minUsd: 50, maxUsd: 90, source: "stated" } }).parts[0]).toBe("$50 to $90");
  });

  it("says none yet when the canvas is empty", () => {
    const empty: Canvas = { category: null, outcome: null, budget: null, items: [item("q", "open_question")] };
    expect(summaryStrip(empty)).toEqual({ parts: [], text: "Your needs: none yet" });
  });
});

describe("budget words", () => {
  it("matches the canvas row", () => {
    expect(budgetText(null)).toBe("Not set yet");
    expect(budgetText({ minUsd: 50, maxUsd: 100, source: "stated" })).toBe("$50 to $100");
    expect(budgetText({ maxUsd: 100, source: "stated" })).toBe("Up to $100");
    expect(budgetText({ minUsd: 50, source: "stated" })).toBe("From $50");
    expect(budgetText({ source: "stated" })).toBe("Not set yet");
  });

  it("fills the form from the budget", () => {
    expect(budgetFields({ minUsd: 50, source: "inferred" })).toEqual({ min: "50", max: "" });
    expect(budgetFields(null)).toEqual({ min: "", max: "" });
  });
});

describe("edits", () => {
  it("saving an item sends a change unless it is blank or the buyer's own words unchanged", () => {
    const stated = item("a", "must_have");
    expect(itemSaveEdit(stated, "  ")).toBeNull();
    expect(itemSaveEdit(stated, " Item a ")).toBeNull();
    expect(itemSaveEdit(stated, "New words")).toEqual({ kind: "item_changed", id: "a", text: "New words" });
    // Saving a guess as it is makes it the buyer's.
    expect(itemSaveEdit({ ...stated, source: "inferred" }, "Item a")).toEqual({ kind: "item_changed", id: "a", text: "Item a" });
  });

  it("adding trims, and refuses a blank", () => {
    expect(itemAddEdit("preference", "  Black ", "n1")).toEqual({
      kind: "item_added",
      item: { id: "n1", kind: "preference", text: "Black" },
    });
    expect(itemAddEdit("preference", " ", "n1")).toBeNull();
  });

  it("records the id of a need the buyer added, only when the add landed", () => {
    const add = itemAddEdit("must_have", "Waterproof", "w")!;
    const none: readonly string[] = [];
    expect(recordHandAdded(none, add, true)).toEqual(["w"]);
    // Dropped by the canvas lock: not the buyer's need after all.
    expect(recordHandAdded(none, add, false)).toBe(none);
    // Other edits and repeats leave the list as it is.
    expect(recordHandAdded(none, { kind: "item_removed", id: "a" }, true)).toBe(none);
    const once = ["w"];
    expect(recordHandAdded(once, add, true)).toBe(once);
  });

  it("a category chip picks, or clears when already picked", () => {
    expect(categoryEdit(null, "bag")).toEqual({ kind: "category", category: "bag" });
    expect(categoryEdit("bag", "bag")).toEqual({ kind: "category", category: null });
  });

  it("confirm sends the right edit for each kind of guess", () => {
    expect(confirmEdit({ kind: "item", id: "a" })).toEqual({ kind: "item_confirmed", id: "a" });
    expect(confirmEdit({ kind: "outcome" })).toEqual({ kind: "outcome_confirmed" });
    expect(confirmEdit({ kind: "budget" })).toEqual({ kind: "budget_confirmed" });
  });
});

describe("requirement_edited props", () => {
  it("names the action and the kind, as the canvas sent them before", () => {
    expect(editAnalytics({ kind: "category", category: "bag" }, canvas)).toEqual({ action: "changed", itemKind: "category" });
    expect(editAnalytics({ kind: "outcome", text: "x" }, canvas)).toEqual({ action: "changed", itemKind: "outcome" });
    expect(editAnalytics({ kind: "outcome_confirmed" }, canvas)).toEqual({ action: "confirmed", itemKind: "outcome" });
    expect(editAnalytics({ kind: "budget", maxUsd: 9 }, canvas)).toEqual({ action: "changed", itemKind: "budget" });
    expect(editAnalytics({ kind: "budget_confirmed" }, canvas)).toEqual({ action: "confirmed", itemKind: "budget" });
    expect(editAnalytics({ kind: "item_added", item: { id: "n", kind: "open_question", text: "x" } }, canvas)).toEqual({
      action: "added",
      itemKind: "open_question",
    });
    expect(editAnalytics({ kind: "item_changed", id: "b", text: "x" }, canvas)).toEqual({ action: "changed", itemKind: "preference" });
    expect(editAnalytics({ kind: "item_removed", id: "a" }, canvas)).toEqual({ action: "removed", itemKind: "must_have" });
    expect(editAnalytics({ kind: "item_confirmed", id: "q" }, canvas)).toEqual({ action: "confirmed", itemKind: "open_question" });
  });

  it("has nothing to report for an item not on the canvas", () => {
    expect(editAnalytics({ kind: "item_removed", id: "gone" }, canvas)).toBeNull();
  });
});
