import { describe, expect, it } from "vitest";
import { createSession, sessionReducer } from "@/pica/lib/session";
import type { CatalogProduct } from "@/pica/lib/types";
import { doneView, returnCheckOf, toggleReason } from "./done-model";

const pack = { id: "p1", title: "Day pack", seller: { id: "s", name: "North Co", links: [] }, variants: [] } as unknown as CatalogProduct;
const tote = { id: "p2", title: "Tote", seller: { id: "s", name: "North Co", links: [] }, variants: [] } as unknown as CatalogProduct;
const base = createSession({ id: "s1", at: 1, title: "Bag", products: [pack, tote] });

describe("doneView", () => {
  it("shows reasons for not buying only, and the confidence check once closed", () => {
    expect(doneView(base)).toMatchObject({ status: "open", showReasons: false, showConfidence: false, askBought: false });
    const declined = sessionReducer(base, { type: "decided", status: "declined", productId: "p1", at: 2 });
    expect(doneView(declined)).toMatchObject({ status: "declined", product: pack, showReasons: true, showConfidence: true });
    const saved = sessionReducer(base, { type: "decided", status: "saved", productId: "p2", at: 2 });
    expect(doneView(saved)).toMatchObject({ status: "saved", product: tote, showReasons: false, showConfidence: true });
  });

  it("asks whether they bought it once checkout started", () => {
    const started = sessionReducer(base, { type: "checkout_started", productId: "p2", variantId: "v", at: 2 });
    expect(doneView(started).askBought).toBe(true);
  });

  it("hides the reasons and the confidence check while Did you buy it is up, even on a closed decision", () => {
    for (const status of ["declined", "saved"] as const) {
      const closed = sessionReducer(base, { type: "decided", status, productId: "p1", at: 2 });
      const asking = { ...closed, checkoutStartedAt: 3 };
      expect(doneView(asking)).toMatchObject({ status, askBought: true, showReasons: false, showConfidence: false });
    }
  });
});

describe("toggleReason", () => {
  it("picks a reason, and the same tap clears it", () => {
    expect(toggleReason(undefined, "price")).toBe("price");
    expect(toggleReason("price", "fit")).toBe("fit");
    expect(toggleReason("price", "price")).toBeUndefined();
  });
});

describe("returnCheckOf", () => {
  it("is null before any checkout", () => {
    expect(returnCheckOf(base)).toBeNull();
  });

  it("asks about the product taken to checkout", () => {
    const started = sessionReducer(base, { type: "checkout_started", productId: "p2", variantId: "v", at: 2 });
    expect(returnCheckOf(started)).toEqual({ product: tote });
  });

  it("goes away after 'Not yet'", () => {
    const started = sessionReducer(base, { type: "checkout_started", productId: "p2", variantId: "v", at: 2 });
    const notYet = sessionReducer(started, { type: "checkout_answered", bought: false, at: 3 });
    expect(returnCheckOf(notYet)).toBeNull();
  });
});
