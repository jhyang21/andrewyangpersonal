import { describe, expect, it } from "vitest";
import type { CatalogProduct, CatalogVariant, Shortlist } from "@/pica/lib/types";
import {
  VERSION_STOCK_TEXT,
  decideHref,
  optionRows,
  optionsText,
  priceLine,
  shortlistViewKey,
  versionStock,
} from "./shortlist-model";

const usd = (amount: number) => ({ amount, currency: "USD" });

function variant(price: number, available: boolean | null): CatalogVariant {
  return { id: "v", title: "Default", price: usd(price), available, options: [] };
}

function product(id: string, min: number, max: number, variants: CatalogVariant[] = []): CatalogProduct {
  return {
    id,
    title: id,
    descriptionText: "",
    images: [],
    seller: { id: "s", name: "Shop", links: [] },
    priceRange: { min: usd(min), max: usd(max) },
    options: [],
    variants,
    summarized: { sellingPoints: [], features: [], specs: [] },
    fetchedAt: 1,
  };
}

const shortlist: Shortlist = {
  entries: ["a", "gone", "b"].map((productId) => ({
    productId,
    angle: "",
    whyItFits: [],
    whyNot: [],
    valueNote: "",
    unverified: [],
  })),
  note: "",
  createdAt: 42,
  stale: false,
};

describe("option rows", () => {
  it("joins entries to their records in Pica's order, leaving out entries with no record", () => {
    const rows = optionRows({ shortlist, products: { a: product("a", 1, 1), b: product("b", 1, 1) } });
    expect(rows.map((row) => row.product.id)).toEqual(["a", "b"]);
    expect(optionRows({ shortlist: null, products: {} })).toEqual([]);
  });

  it("counts options in words", () => {
    expect(optionsText(1)).toBe("1 option");
    expect(optionsText(4)).toBe("4 options");
  });
});

describe("price line", () => {
  it("shows the matched version's price, with the range when other versions cost more or less", () => {
    expect(priceLine(product("a", 16800, 22800, [variant(19800, true)]))).toEqual({
      price: usd(19800),
      range: { min: usd(16800), max: usd(22800) },
    });
  });

  it("has no range when every version costs the same", () => {
    expect(priceLine(product("a", 5000, 5000, [variant(5000, true)]))).toEqual({ price: usd(5000), range: null });
  });

  it("has no range line when the catalog's lowest and highest are equal, even if the version's price is off", () => {
    expect(priceLine(product("a", 5000, 5000, [variant(6000, true)]))).toEqual({ price: usd(6000), range: null });
  });

  it("falls back to the lowest price when no version came back", () => {
    expect(priceLine(product("a", 5000, 9000))).toEqual({ price: usd(5000), range: { min: usd(5000), max: usd(9000) } });
  });

  it("never carries the list price", () => {
    const sale = product("a", 5000, 5000, [{ ...variant(5000, true), listPrice: usd(8000) }]);
    expect(priceLine(sale)).toEqual({ price: usd(5000), range: null });
  });
});

describe("stock", () => {
  it("is about the matched version, and unknown when the catalog does not say", () => {
    expect(versionStock(product("a", 1, 1, [variant(1, true)]))).toBe("in_stock");
    expect(versionStock(product("a", 1, 1, [variant(1, false), variant(1, true)]))).toBe("sold_out");
    expect(versionStock(product("a", 1, 1, [variant(1, null)]))).toBe("unknown");
    expect(versionStock(product("a", 1, 1))).toBe("unknown");
  });

  it("says a sold-out version may come in other sizes or colours, and never guesses in stock", () => {
    expect(VERSION_STOCK_TEXT.sold_out).toBe("This version is sold out. Other sizes or colours may be in stock.");
    expect(VERSION_STOCK_TEXT.unknown).toBe("Stock not confirmed");
  });
});

describe("links and keys", () => {
  it("links to Decide for one option", () => {
    expect(decideHref("s1", "gid://shopify/p/1")).toBe("/projects/pica/d/s1/decide?product=gid%3A%2F%2Fshopify%2Fp%2F1");
  });

  it("keys one view per shortlist", () => {
    expect(shortlistViewKey("s1", shortlist)).toBe("s1:42");
  });
});
