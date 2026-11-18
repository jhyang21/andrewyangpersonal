import { describe, expect, it } from "vitest";
import { EMPTY_CANVAS, type Canvas } from "@/pica/lib/types";
import { applyCanvasPatch, MAX_CANVAS_ITEMS, mustHaves } from "./canvas";

function idMaker() {
  let n = 0;
  return () => `item-${++n}`;
}

const base: Canvas = {
  category: "backpack",
  outcome: { text: "Work backpack", source: "stated" },
  budget: { maxUsd: 200, source: "stated" },
  items: [
    { id: "a", kind: "must_have", text: "Fits a 16-inch laptop", source: "stated" },
    { id: "b", kind: "preference", text: "Looks polished", source: "inferred" },
  ],
};

describe("applyCanvasPatch", () => {
  it("sets category, outcome and budget on an empty canvas", () => {
    const next = applyCanvasPatch(EMPTY_CANVAS, {
      category: "luggage",
      outcome: { text: "Carry-on for short trips", source: "stated" },
      budget: { maxUsd: 250.4, source: "inferred" },
    });
    expect(next.category).toBe("luggage");
    expect(next.outcome).toEqual({ text: "Carry-on for short trips", source: "stated" });
    expect(next.budget).toEqual({ maxUsd: 250, source: "inferred" });
  });

  it("does not change the input canvas", () => {
    const copy = structuredClone(base);
    applyCanvasPatch(base, { remove: ["a"], change: [{ id: "b", text: "Changed" }] });
    expect(base).toEqual(copy);
  });

  it("leaves fields alone when the patch leaves them out, and clears them on null", () => {
    expect(applyCanvasPatch(base, {}).budget).toEqual(base.budget);
    const cleared = applyCanvasPatch(base, { budget: null, category: null, outcome: null });
    expect(cleared.budget).toBeNull();
    expect(cleared.category).toBeNull();
    expect(cleared.outcome).toBeNull();
  });

  it("swaps a reversed budget and drops an empty one", () => {
    expect(applyCanvasPatch(base, { budget: { minUsd: 300, maxUsd: 100, source: "stated" } }).budget).toEqual({
      minUsd: 100,
      maxUsd: 300,
      source: "stated",
    });
    expect(applyCanvasPatch(base, { budget: { source: "stated" } }).budget).toBeNull();
  });

  it("adds items with new IDs and keeps their source", () => {
    const next = applyCanvasPatch(
      base,
      {
        add: [
          { kind: "must_have", text: "Water resistant", source: "stated" },
          { kind: "open_question", text: "Daily or weekly use?", source: "inferred" },
        ],
      },
      idMaker(),
    );
    expect(next.items.slice(2)).toEqual([
      { id: "item-1", kind: "must_have", text: "Water resistant", source: "stated" },
      { id: "item-2", kind: "open_question", text: "Daily or weekly use?", source: "inferred" },
    ]);
  });

  it("skips duplicates, and a restated guess becomes stated", () => {
    const next = applyCanvasPatch(
      base,
      {
        add: [
          { kind: "must_have", text: "fits a 16-inch laptop ", source: "inferred" },
          { kind: "preference", text: "Looks polished", source: "stated" },
        ],
      },
      idMaker(),
    );
    expect(next.items).toHaveLength(2);
    expect(next.items.find((item) => item.id === "a")?.source).toBe("stated");
    expect(next.items.find((item) => item.id === "b")?.source).toBe("stated");
  });

  it("changes and removes items by ID and skips unknown IDs", () => {
    const next = applyCanvasPatch(base, {
      change: [
        { id: "b", kind: "must_have", source: "stated" },
        { id: "nope", text: "Ignored" },
      ],
      remove: ["a", "also-nope"],
    });
    expect(next.items).toEqual([{ id: "b", kind: "must_have", text: "Looks polished", source: "stated" }]);
  });

  it("strips links from text", () => {
    const next = applyCanvasPatch(
      EMPTY_CANVAS,
      { add: [{ kind: "preference", text: "Like this one https://shop.example/x please", source: "stated" }] },
      idMaker(),
    );
    expect(next.items[0].text).toBe("Like this one please");

    const withOutcome = applyCanvasPatch(
      next,
      {
        outcome: { text: "A bag like www.bagshop.example/x or shop.com/sale", source: "stated" },
        change: [{ id: next.items[0].id, text: "Like https://shop.example/y and trailgoods.shop/bag" }],
      },
      idMaker(),
    );
    expect(withOutcome.outcome?.text).toBe("A bag like or");
    expect(withOutcome.items[0].text).toBe("Like and");
  });

  it("stops adding at the item cap", () => {
    const add = Array.from({ length: MAX_CANVAS_ITEMS + 5 }, (_, i) => ({
      kind: "preference" as const,
      text: `Preference ${i}`,
      source: "inferred" as const,
    }));
    expect(applyCanvasPatch(EMPTY_CANVAS, { add }, idMaker()).items).toHaveLength(MAX_CANVAS_ITEMS);
  });

  it("lists must-have texts", () => {
    expect(mustHaves(base)).toEqual(["Fits a 16-inch laptop"]);
  });
});
