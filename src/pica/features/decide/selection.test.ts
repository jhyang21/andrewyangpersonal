import { describe, expect, it } from "vitest";
import { createSession, sessionReducer } from "@/pica/lib/session";
import type { CatalogProduct, CatalogVariant } from "@/pica/lib/types";
import { choiceGroups, initialSelection, nextSelection, shownStock } from "./selection";

function variant(id: string, options: { name: string; label: string }[], available: boolean | null): CatalogVariant {
  return { id, title: id, price: { amount: 100, currency: "USD" }, available, options };
}

const blackLarge = variant("v1", [{ name: "Color", label: "Black" }, { name: "Size", label: "Large" }], false);
const greyLarge = variant("v2", [{ name: "Color", label: "Grey" }, { name: "Size", label: "Large" }], true);

const product = {
  id: "p1",
  title: "Day pack",
  seller: { id: "s", name: "North Co", links: [] },
  options: [
    { name: "Color", values: [{ label: "Black", available: false }, { label: "Grey", available: null }] },
    { name: "Size", values: [{ label: "Large", available: true }] },
  ],
  variants: [blackLarge, greyLarge],
  fetchedAt: 1,
} as unknown as CatalogProduct;

describe("initialSelection", () => {
  const base = createSession({ id: "s1", at: 1, title: "Bag", products: [product] });

  it("opens with the choice taken to checkout", () => {
    const session = sessionReducer(base, {
      type: "checkout_started",
      productId: "p1",
      variantId: "v1",
      options: blackLarge.options,
      at: 2,
    });
    expect(initialSelection(session, "p1")).toEqual(blackLarge.options);
  });

  it("then the variant decided on", () => {
    const session = sessionReducer(base, { type: "decided", status: "saved", productId: "p1", variantId: "v1", at: 2 });
    expect(initialSelection(session, "p1")).toEqual(blackLarge.options);
  });

  it("then the first variant not sold out", () => {
    expect(initialSelection(base, "p1")).toEqual(greyLarge.options);
  });

  it("is undefined for a product the session has not stored", () => {
    expect(initialSelection(base, "other")).toBeUndefined();
  });
});

describe("nextSelection", () => {
  it("changes one option and keeps the shown others", () => {
    expect(nextSelection(greyLarge, undefined, "Color", "Black")).toEqual([
      { name: "Color", label: "Black" },
      { name: "Size", label: "Large" },
    ]);
  });

  it("adds an option the shown variant lacks", () => {
    const bare = variant("v3", [], true);
    expect(nextSelection(bare, [{ name: "Size", label: "Large" }], "Color", "Grey")).toEqual([
      { name: "Size", label: "Large" },
      { name: "Color", label: "Grey" },
    ]);
  });
});

describe("choiceGroups", () => {
  it("marks the shown value, the sold-out values, and options with one value", () => {
    const groups = choiceGroups(product, greyLarge);
    expect(groups).toEqual([
      {
        name: "Color",
        current: "Grey",
        fixed: false,
        values: [
          { label: "Black", soldOut: true, selected: false },
          // Unknown stock (null) is not sold out.
          { label: "Grey", soldOut: false, selected: true },
        ],
      },
      { name: "Size", current: "Large", fixed: true, values: [{ label: "Large", soldOut: false, selected: true }] },
    ]);
  });
});

describe("shownStock", () => {
  it("reads sold out, in stock, and unknown for null or no variant", () => {
    expect(shownStock(blackLarge)).toBe("sold_out");
    expect(shownStock(greyLarge)).toBe("in_stock");
    expect(shownStock(variant("v4", [], null))).toBe("unknown");
    expect(shownStock(undefined)).toBe("unknown");
  });
});
