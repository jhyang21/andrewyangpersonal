import { describe, expect, it } from "vitest";
import type { CatalogProduct, CatalogVariant, ShortlistEntry } from "@/pica/lib/types";
import {
  OPTIONS_STAGE,
  canChoose,
  canEnd,
  cardLines,
  cardStockText,
  domKey,
  everyVersionSoldOut,
  moreLines,
  optionsHeadline,
  pickControl,
  picksText,
} from "./options-stage-model";

const usd = (amount: number) => ({ amount, currency: "USD" });

function variant(available: boolean | null): CatalogVariant {
  return { id: "v", title: "Default", price: usd(1000), available, options: [] };
}

function product(variants: CatalogVariant[], colours: (boolean | null)[] | null = null): CatalogProduct {
  return {
    id: "gid://shopify/p/1",
    title: "Pack",
    descriptionText: "",
    images: [],
    seller: { id: "s", name: "Shop", links: [] },
    priceRange: { min: usd(1000), max: usd(1000) },
    options: colours ? [{ name: "Color", values: colours.map((available, i) => ({ label: `c${i}`, available })) }] : [],
    variants,
    summarized: { sellingPoints: [], features: [], specs: [] },
    fetchedAt: 1,
  };
}

const entry = (over: Partial<ShortlistEntry> = {}): ShortlistEntry => ({
  productId: "p",
  angle: "The light one",
  whyItFits: ["Fits a 16-inch laptop.", "Under budget."],
  whyNot: ["Heavy.", "Few ratings."],
  valueNote: "Costs $20 more.",
  unverified: ["Strap comfort."],
  ...over,
});

describe("optionsHeadline", () => {
  it("counts the options and says the order means nothing", () => {
    expect(optionsHeadline(4)).toBe("4 options, in no particular order");
    expect(optionsHeadline(1)).toBe("1 option, in no particular order");
  });
});

describe("cardLines and moreLines", () => {
  it("shows the first reason and the first drawback closed, the rest behind More", () => {
    expect(cardLines(entry())).toEqual({ fit: "Fits a 16-inch laptop.", whyNot: "Heavy." });
    expect(moreLines(entry())).toEqual({
      fits: ["Under budget."],
      whyNot: ["Few ratings."],
      value: "Costs $20 more.",
      unverified: ["Strap comfort."],
    });
  });

  it("never leaves the drawback line empty", () => {
    expect(cardLines(entry({ whyItFits: [], whyNot: [] }))).toEqual({
      fit: OPTIONS_STAGE.noFit,
      whyNot: OPTIONS_STAGE.noWhyNot,
    });
  });

  it("drops a blank value note", () => {
    expect(moreLines(entry({ valueNote: "  " })).value).toBeNull();
  });
});

describe("stock and Choose this one", () => {
  it("speaks of the matched version and keeps Choose on when it alone is sold out", () => {
    const matchedGone = product([variant(false)], [false, true]);
    expect(cardStockText(matchedGone)).toBe("This version is sold out. Other sizes or colours may be in stock.");
    expect(canChoose(matchedGone)).toBe(true);
  });

  it("keeps Choose on when search fetched one sold-out version and the other colours are unknown", () => {
    const one = product([variant(false)], [false, null]);
    expect(everyVersionSoldOut(one)).toBe(false);
    expect(canChoose(one)).toBe(true);
  });

  it("turns Choose off, with words, only when every version is sold out", () => {
    const gone = product([variant(false), variant(false)], [false, false]);
    expect(everyVersionSoldOut(gone)).toBe(true);
    expect(canChoose(gone)).toBe(false);
    expect(cardStockText(gone)).toBe(OPTIONS_STAGE.allSoldOut);
    // No sizes or colours listed: the one version is the product.
    expect(everyVersionSoldOut(product([variant(false)]))).toBe(true);
  });

  it("keeps Choose on with two lists, since a value's stock holds for the current pick only", () => {
    // Size 20L/30L and colour Black/Grey. Search matched 20L Black, sold out;
    // with 20L picked both colours read sold out, yet 30L Black is in stock.
    const twoLists: CatalogProduct = {
      ...product([variant(false)]),
      options: [
        { name: "Size", values: [{ label: "20L", available: true }, { label: "30L", available: true }] },
        { name: "Color", values: [{ label: "Black", available: false }, { label: "Grey", available: false }] },
      ],
    };
    expect(everyVersionSoldOut(twoLists)).toBe(false);
    expect(canChoose(twoLists)).toBe(true);
    expect(cardStockText(twoLists)).toBe("This version is sold out. Other sizes or colours may be in stock.");
    // Even with every value of both lists false, it cannot be sure.
    const allFalse: CatalogProduct = {
      ...twoLists,
      options: twoLists.options.map((option) => ({
        ...option,
        values: option.values.map((value) => ({ ...value, available: false })),
      })),
    };
    expect(canChoose(allFalse)).toBe(true);
  });

  it("never guesses stock", () => {
    expect(cardStockText(product([variant(null)], [null]))).toBe("Stock not confirmed");
    expect(cardStockText(product([variant(true)], [true]))).toBe("In stock");
    expect(canChoose(product([]))).toBe(true);
  });
});

describe("pickControl", () => {
  it("is pressed when picked, and off when full or locked", () => {
    expect(pickControl(["a"], "a", 5, false)).toEqual({ pressed: true, disabled: false });
    expect(pickControl(["a", "b"], "c", 2, false)).toEqual({ pressed: false, disabled: true });
    expect(pickControl(["a", "b"], "a", 2, false)).toEqual({ pressed: true, disabled: false });
    expect(pickControl(["a"], "a", 5, true)).toEqual({ pressed: true, disabled: true });
  });
});

describe("picksText", () => {
  const limits = { min: 2, max: 5 };
  it("says the limits in words at every count", () => {
    expect(picksText(0, limits, 6)).toBe("Pick 2 to 5 options to compare.");
    expect(picksText(1, limits, 6)).toBe("1 picked. Pick at least 1 more to compare.");
    expect(picksText(3, limits, 6)).toBe("3 picked to compare. You can pick up to 5.");
    expect(picksText(5, limits, 6)).toBe("5 picked, the most Pica compares at once. Take one out to pick another.");
  });

  it("says there is nothing to compare when there are fewer options than the least Pica compares", () => {
    expect(picksText(0, limits, 1)).toBe("Pica has 1 option so far, so there is nothing to compare yet.");
    expect(picksText(1, limits, 1)).toBe("Pica has 1 option so far, so there is nothing to compare yet.");
    expect(picksText(0, limits, 0)).toBe("There is nothing to compare yet.");
    expect(picksText(0, limits, 2)).toBe("Pick 2 to 5 options to compare.");
  });
});

describe("canEnd and domKey", () => {
  it("offers the way out while open or saved, as the header menu does", () => {
    expect(canEnd("open")).toBe(true);
    expect(canEnd("saved")).toBe(true);
    expect(canEnd("bought")).toBe(false);
    expect(canEnd("declined")).toBe(false);
  });

  it("makes a product id safe for an element id", () => {
    expect(domKey("gid://shopify/p/seed-slim")).toBe("gid___shopify_p_seed-slim");
  });
});
