import { describe, expect, it } from "vitest";
import type { CatalogProduct, ShortlistEntry } from "@/pica/lib/types";
import { CATALOG_NOTE, EVIDENCE_TAGS, evidenceSheet, hasFewReviews } from "./evidence-model";
import { FEW_REVIEWS } from "./format";

function product(extra: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "p1",
    title: "Day Pack",
    descriptionText: "Fits a 16-inch laptop.",
    images: [],
    seller: { id: "s", name: "Trail Co", links: [], url: "https://trail.example" },
    priceRange: { min: { amount: 1, currency: "USD" }, max: { amount: 1, currency: "USD" } },
    options: [],
    variants: [],
    summarized: { sellingPoints: ["Light"], features: ["Padded sleeve"], specs: ["20 L"] },
    rating: { value: 4.5, count: 12, scaleMax: 5 },
    fetchedAt: 1,
    ...extra,
  };
}

const entry: ShortlistEntry = {
  productId: "p1",
  angle: "The lighter option",
  whyItFits: ["Fits your laptop"],
  whyNot: ["No wheels"],
  valueNote: "Middle of the range",
  unverified: ["Water resistance"],
};

describe("evidence tags", () => {
  it("has the four tags with their words and icons", () => {
    expect(EVIDENCE_TAGS).toEqual({
      merchant: { label: "Merchant says", icon: "Store" },
      catalog_summary: { label: "From the listing", icon: "FileText" },
      inference: { label: "Pica's read", icon: "Feather" },
      missing: { label: "Not verified", icon: "CircleDashed" },
    });
    expect(CATALOG_NOTE).toBe("From the catalog");
  });
});

describe("few reviews", () => {
  it("uses the shared threshold", () => {
    expect(FEW_REVIEWS).toBe(20);
    expect(hasFewReviews({ value: 5, count: 19, scaleMax: 5 })).toBe(true);
    expect(hasFewReviews({ value: 5, count: 20, scaleMax: 5 })).toBe(false);
    expect(hasFewReviews(undefined)).toBe(false);
  });

  it("does not throw on a null rating, and a rating on no reviews is not few", () => {
    expect(hasFewReviews(null)).toBe(false);
    expect(hasFewReviews({ value: 0, count: 0, scaleMax: 5 })).toBe(false);
    expect(hasFewReviews({ value: 5, count: 1, scaleMax: 5 })).toBe(true);
  });
});

describe("evidence sheet", () => {
  it("fills each section in order from the product and the entry", () => {
    const sheet = evidenceSheet(product(), entry);
    expect(sheet.description).toBe("Day Pack from Trail Co");
    expect(sheet.merchant).toMatchObject({
      tag: "merchant",
      text: "Fits a 16-inch laptop.",
      link: { url: "https://trail.example", label: "See it on Trail Co" },
    });
    expect(sheet.summary.items).toEqual(["Light", "Padded sleeve", "20 L"]);
    expect(sheet.rating.note).toBe("Few reviews so far");
    expect(sheet.picaRead).toEqual({
      tag: "inference",
      whyItFits: ["Fits your laptop"],
      whyNot: ["No wheels"],
      valueNote: "Middle of the range",
    });
    expect(sheet.unverified.items).toEqual(["Water resistance"]);
  });

  it("has three review links that open other sites, and says Pica does not check them", () => {
    const { reviews } = evidenceSheet(product(), entry);
    expect(reviews.links.map((link) => link.site)).toEqual(["web", "reddit", "youtube"]);
    expect(reviews.links.every((link) => link.url.startsWith("https://"))).toBe(true);
    expect(reviews.note).toBe("These links open other sites. Pica does not check what they say.");
  });

  it("handles a bare product off the shortlist", () => {
    const sheet = evidenceSheet(
      product({ descriptionText: "  ", rating: undefined, seller: { id: "s", name: "Trail Co", links: [], url: "http://x" } }),
      null,
    );
    expect(sheet.merchant.text).toBeNull();
    expect(sheet.merchant.link).toBeNull();
    expect(sheet.rating).toMatchObject({ rating: null, note: null });
    expect(sheet.picaRead).toBeNull();
    expect(sheet.unverified.items).toEqual([]);
    expect(sheet.unverified.empty).toBe("Pica listed nothing here. That does not mean every claim was checked.");
  });

  it("shows no rating at all when it rests on no reviews", () => {
    const sheet = evidenceSheet(product({ rating: { value: 0, count: 0, scaleMax: 5 } }), entry);
    expect(sheet.rating).toMatchObject({ rating: null, note: null });
  });

  it("a rating on enough reviews has no note", () => {
    expect(evidenceSheet(product({ rating: { value: 4, count: 300, scaleMax: 5 } }), entry).rating.note).toBeNull();
  });
});
