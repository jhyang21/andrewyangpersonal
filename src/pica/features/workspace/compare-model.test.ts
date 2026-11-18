import { describe, expect, it } from "vitest";
import { COMPARE_MAX, COMPARE_MIN } from "@/pica/lib/pica/constants";
import type { CatalogProduct, Comparison, ComparisonCell, Shortlist } from "@/pica/lib/types";
import {
  COMPARE_LIMITS,
  canAskCompare,
  canShowTable,
  cellEvidence,
  cellFor,
  compareAsk,
  compareRequestText,
  comparedProducts,
  comparisonState,
  comparisonViewKey,
  livePicks,
  pickBlocked,
  pickCandidates,
  togglePick,
  togglePickUnlessLocked,
} from "./compare-model";

function shortlistOf(...ids: string[]): Shortlist {
  return {
    entries: ids.map((productId) => ({ productId, angle: "", whyItFits: [], whyNot: [], valueNote: "", unverified: [] })),
    note: "",
    createdAt: 1,
    stale: false,
  };
}

function product(id: string, extra: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id,
    title: `Bag ${id}`,
    descriptionText: "",
    images: [],
    seller: { id: "s", name: `Shop ${id}`, links: [] },
    priceRange: { min: { amount: 100, currency: "USD" }, max: { amount: 100, currency: "USD" } },
    options: [],
    variants: [],
    summarized: { sellingPoints: [], features: [], specs: [] },
    fetchedAt: 1,
    ...extra,
  };
}

const comparison = (ids: string[], stale = false): Comparison => ({
  productIds: ids,
  rows: [],
  takeaway: "",
  createdAt: 7,
  stale,
});

describe("limits", () => {
  it("come from the server: two to five", () => {
    expect(COMPARE_LIMITS).toEqual({ min: COMPARE_MIN, max: COMPARE_MAX });
    expect(COMPARE_LIMITS).toEqual({ min: 2, max: 5 });
  });

  it("the ask works from the fewest to the most picks, and not while Pica replies", () => {
    expect(canAskCompare(1, false, COMPARE_LIMITS)).toBe(false);
    expect(canAskCompare(2, false, COMPARE_LIMITS)).toBe(true);
    expect(canAskCompare(5, false, COMPARE_LIMITS)).toBe(true);
    expect(canAskCompare(6, false, COMPARE_LIMITS)).toBe(false);
    expect(canAskCompare(3, true, COMPARE_LIMITS)).toBe(false);
  });

  it("a full set blocks new picks but not the ones already in", () => {
    expect(pickBlocked(["a", "b"], "c", 2)).toBe(true);
    expect(pickBlocked(["a", "b"], "a", 2)).toBe(false);
    expect(pickBlocked(["a"], "c", 2)).toBe(false);
  });
});

describe("compare picks follow the current shortlist", () => {
  it("drops picks from an older shortlist", () => {
    expect(livePicks(["a", "b", "c"], shortlistOf("b", "c", "d"))).toEqual(["b", "c"]);
  });

  it("has no picks without a shortlist", () => {
    expect(livePicks(["a"], null)).toEqual([]);
  });

  it("an old pick never fills a slot", () => {
    // Four picks, three of them gone: the buyer can still add up to the limit.
    const next = togglePick(["x", "y", "z", "a"], "b", shortlistOf("a", "b", "c"), 4);
    expect(next).toEqual(["a", "b"]);
  });

  it("refuses a product that is not on the shortlist, and stops at the limit", () => {
    const list = shortlistOf("a", "b", "c");
    expect(togglePick(["a"], "zz", list, 4)).toEqual(["a"]);
    expect(togglePick(["a", "b"], "c", list, 2)).toEqual(["a", "b"]);
    expect(togglePick(["a", "b"], "a", list, 2)).toEqual(["b"]);
  });
});

describe("picks lock while Pica replies", () => {
  it("an untick during the reply does nothing, so the comparison that lands matches the picks", () => {
    // Picks a to d, the buyer presses compare, then tries to untick c while Pica works.
    const list = shortlistOf("a", "b", "c", "d");
    const picks = ["a", "b", "c", "d"];
    expect(togglePickUnlessLocked(picks, "c", list, 5, true)).toBe(picks);
    // Once the reply is done, the untick works.
    expect(togglePickUnlessLocked(picks, "c", list, 5, false)).toEqual(["a", "b", "d"]);
  });
});

describe("products", () => {
  const products = { a: product("a"), b: product("b") };

  it("compared products follow the comparison's order and skip missing records", () => {
    expect(comparedProducts({ comparison: comparison(["b", "x", "a"]), products }).map((p) => p.id)).toEqual(["b", "a"]);
    expect(comparedProducts({ comparison: null, products })).toEqual([]);
  });

  it("candidates are the shortlist's products the session holds", () => {
    expect(pickCandidates({ shortlist: shortlistOf("a", "x", "b"), products }).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("the ask names each product and its merchant", () => {
    expect(compareRequestText([products.a, products.b])).toBe("Compare these for me: Bag a (Shop a); Bag b (Shop b).");
  });

  it("a table needs at least the fewest products", () => {
    expect(canShowTable(comparison(["a", "b"]), 2, 2)).toBe(true);
    expect(canShowTable(comparison(["a", "b"]), 1, 2)).toBe(false);
    expect(canShowTable(null, 3, 2)).toBe(false);
  });
});

describe("out of date", () => {
  it("is current when needs and picks match", () => {
    expect(comparisonState(comparison(["a", "b"]), ["b", "a"])).toEqual({ needsChanged: false, picksChanged: false });
  });

  it("needs changed when the comparison is stale", () => {
    expect(comparisonState(comparison(["a", "b"], true), ["a", "b"]).needsChanged).toBe(true);
  });

  it("picks changed when the picks cover other options", () => {
    expect(comparisonState(comparison(["a", "b"]), ["a", "b", "c"]).picksChanged).toBe(true);
    expect(comparisonState(comparison(["a", "b"]), ["a", "c"]).picksChanged).toBe(true);
    expect(comparisonState(comparison(["a", "b"]), ["a"]).picksChanged).toBe(true);
    // No picks at all: nothing to set against the table.
    expect(comparisonState(comparison(["a", "b"]), []).picksChanged).toBe(false);
  });
});

describe("compareAsk: one ask at a time", () => {
  it("offers the stage's ask when no table is on screen", () => {
    expect(compareAsk(null, false, ["a", "b"])).toBe("stage");
    expect(compareAsk(comparison(["a", "b"]), false, ["a", "b"])).toBe("stage");
  });

  it("offers the stage's ask when the picks differ, current or out of date", () => {
    expect(compareAsk(comparison(["a", "b"]), true, ["a", "c"])).toBe("stage");
    expect(compareAsk(comparison(["a", "b"], true), true, ["a", "b", "c"])).toBe("stage");
  });

  it("offers only the banner's Update when the picks match an out-of-date table", () => {
    expect(compareAsk(comparison(["a", "b"], true), true, ["b", "a"])).toBe("banner");
    expect(compareAsk(comparison(["a", "b"], true), true, [])).toBe("banner");
  });

  it("offers no ask when the picks match a current table", () => {
    expect(compareAsk(comparison(["a", "b"]), true, ["b", "a"])).toBeNull();
    expect(compareAsk(comparison(["a", "b"]), true, [])).toBeNull();
  });
});

describe("cells", () => {
  const listed = product("a", {
    variants: [
      {
        id: "v",
        title: "Default",
        price: { amount: 100, currency: "USD" },
        available: true,
        options: [],
        url: "https://shop.example/bag",
      },
    ],
  });
  const cell = (extra: Partial<ComparisonCell>): ComparisonCell => ({ productId: "a", note: "Fits", basis: "inference", ...extra });

  it("a checked quote keeps the merchant's or listing's tag, with the listing link", () => {
    expect(cellEvidence(cell({ basis: "merchant", quote: "Fits 16-inch" }), listed)).toEqual({
      tag: "merchant",
      quote: "Fits 16-inch",
      url: "https://shop.example/bag",
    });
    expect(cellEvidence(cell({ basis: "catalog_summary", quote: "Padded" }), listed).tag).toBe("catalog_summary");
  });

  it("without a quote the note is Pica's read, and missing stays not verified", () => {
    expect(cellEvidence(cell({ basis: "merchant" }), listed)).toEqual({ tag: "inference", quote: null, url: null });
    expect(cellEvidence(cell({ basis: "missing" }), listed).tag).toBe("missing");
    expect(cellEvidence(cell({ basis: "inference", quote: "x" }), listed).tag).toBe("inference");
  });

  it("finds a row's cell for a product", () => {
    expect(cellFor([cell({ productId: "b" }), cell({})], "a")?.productId).toBe("a");
    expect(cellFor([], "a")).toBeNull();
  });
});

describe("words", () => {
  it("keys one view per comparison", () => {
    expect(comparisonViewKey("s1", comparison(["a", "b"]))).toBe("s1:7");
  });
});
