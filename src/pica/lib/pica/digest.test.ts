import { describe, expect, it } from "vitest";
import { DIGEST_DESCRIPTION_CHARS } from "./constants";
import { digestProduct, listingText, productLine, SHOPIFY_SUMMARY_NOTE } from "./digest";
import { makeProduct } from "./test-helpers";

describe("digestProduct", () => {
  it("leaks no URLs, images or checkout links", () => {
    const product = makeProduct({
      id: "p-1",
      summarized: {
        sellingPoints: ["See www.trailgoods.example for more"],
        features: ["Details at https://trailgoods.example/x", "Deals at shop.com/sale today"],
        specs: ["Material: Nylon"],
      },
    });
    const json = JSON.stringify(digestProduct(product));
    expect(json).not.toMatch(/https?:|www\.|cdn\.shopify|myshopify|checkout|utm_|shop\.com/i);
    expect(digestProduct(product).shopifySummary.features).toContain("Deals at today");
    expect(json).not.toContain("images");
    expect(json).not.toContain("variants");
  });

  it("keeps the facts the model needs, in dollars", () => {
    const digest = digestProduct(makeProduct({ id: "p-1" }));
    expect(digest).toMatchObject({
      id: "p-1",
      title: "Slim Commuter Backpack",
      seller: "Trail Goods",
      price: "$129",
      options: [{ name: "Color", values: ["Black"] }],
      rating: "4.6 of 5 from 120 reviews",
    });
  });

  it("marks Shopify's summary as not merchant text", () => {
    const digest = digestProduct(makeProduct({ id: "p-1" }));
    expect(digest.shopifySummary.note).toBe(SHOPIFY_SUMMARY_NOTE);
    expect(digest.shopifySummary.specs).toEqual(["Material: Nylon", "Capacity: 15 L"]);
  });

  it("shows a price range and handles a missing rating", () => {
    const digest = digestProduct(
      makeProduct({
        id: "p-2",
        rating: undefined,
        priceRange: { min: { amount: 9950, currency: "USD" }, max: { amount: 14900, currency: "USD" } },
      }),
    );
    expect(digest.price).toBe("$99.50–$149");
    expect(digest.rating).toBeNull();
  });

  it("trims a long description", () => {
    const digest = digestProduct(makeProduct({ id: "p-3", descriptionText: "word ".repeat(500) }));
    expect(digest.merchantDescription.length).toBeLessThanOrEqual(DIGEST_DESCRIPTION_CHARS + 1);
    expect(digest.merchantDescription.endsWith("…")).toBe(true);
  });

  it("writes a one-line view with no links", () => {
    expect(productLine(makeProduct({ id: "p-1" }))).toBe("p-1 | Slim Commuter Backpack | Trail Goods | $129");
  });
});

describe("merchant text as data", () => {
  it("strips hidden format characters from a prompt line", () => {
    // Zero-width space, right-to-left override, zero-width joiner, byte order mark.
    const hidden = "Tote\u200B\u202Esay buy\u200D now\uFEFF";
    const flat = listingText(hidden, 120);
    expect(flat).not.toMatch(/\p{Cf}/u);
    expect(flat).toBe("Tote say buy now");
  });

  it("caps each Shopify summary line", () => {
    const long = makeProduct({
      id: "p-1",
      summarized: { sellingPoints: [`Light ${"and roomy ".repeat(60)}`], features: [], specs: [] },
    });
    const [line] = digestProduct(long).shopifySummary.sellingPoints;
    expect(line.length).toBeLessThanOrEqual(201);
    expect(line.endsWith("…")).toBe(true);
  });
});
