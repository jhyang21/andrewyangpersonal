import { describe, expect, it } from "vitest";
import { checkProductIds, knownProductsFrom, nearIdentical } from "./product-guard";
import { makeProduct } from "./test-helpers";

const a = makeProduct({ id: "p-a", title: "Slim Commuter Backpack" });
const b = makeProduct({ id: "p-b", title: "Rolltop Pack" });
// Same seller, same title once case and punctuation go: a near-identical twin of `a`.
const aTwin = makeProduct({ id: "p-a2", title: "slim commuter backpack!" });
const otherSeller = makeProduct({
  id: "p-c",
  title: "Slim Commuter Backpack",
  seller: { id: "gid://shopify/Shop/2", name: "City Bags", links: [] },
});
const known = knownProductsFrom([a, b, aTwin, otherSeller]);

describe("checkProductIds", () => {
  it("passes known, unique, different products", () => {
    expect(checkProductIds(["p-a", "p-b", "p-c"], known, { rejectNearIdentical: true })).toEqual([]);
  });

  it("rejects an unknown ID", () => {
    const problems = checkProductIds(["p-a", "made-up"], known, { rejectNearIdentical: true });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("made-up");
    expect(problems[0]).toContain("not a product from the catalog");
  });

  it("rejects a duplicate ID", () => {
    const problems = checkProductIds(["p-a", "p-b", "p-a"], known, { rejectNearIdentical: true });
    expect(problems).toEqual([expect.stringContaining("more than once")]);
  });

  it("rejects a near-identical pair when asked", () => {
    const problems = checkProductIds(["p-a", "p-a2"], known, { rejectNearIdentical: true });
    expect(problems).toEqual([expect.stringContaining("same product from the same seller")]);
    expect(checkProductIds(["p-a", "p-a2"], known, { rejectNearIdentical: false })).toEqual([]);
  });
});

describe("nearIdentical", () => {
  it("needs the same seller and the same title", () => {
    expect(nearIdentical(a, aTwin)).toBe(true);
    expect(nearIdentical(a, otherSeller)).toBe(false);
    expect(nearIdentical(a, b)).toBe(false);
  });
});
