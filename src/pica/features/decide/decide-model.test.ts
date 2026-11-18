import { describe, expect, it } from "vitest";
import type { CatalogProduct, CatalogVariant, CheckoutResponse } from "@/pica/lib/types";
import { STALE_AFTER_MS } from "@/pica/features/shared/format";
import {
  answerCheckout,
  canStartCheckout,
  checkoutAnswered,
  choicePending,
  choose,
  costsOf,
  freeCheckout,
  initialDecideState,
  loaded,
  payPress,
  press,
  primaryLabel,
  primaryStep,
  quoteExpired,
  retryLoad,
  savePress,
  shownQuantity,
  withChange,
  type CheckoutState,
  type DecideState,
} from "./decide-model";
import { RECHECK_GAP_MS } from "./checks";

const T0 = 1_700_000_000_000;
/** What the decision already holds: product p1 in size L. */
const held = { productId: "p1", variantId: "v-L" };
const black = [{ name: "Color", label: "Black" }];
const grey = [{ name: "Color", label: "Grey" }];

function variant(options: { name: string; label: string }[], available: boolean | null = true): CatalogVariant {
  return {
    id: `v-${options.map((o) => o.label).join("-") || "only"}`,
    title: "Default",
    price: { amount: 12_000, currency: "USD" },
    available,
    options,
    checkoutUrl: "https://shop.example/cart/1:1",
  };
}

function product(shown: CatalogVariant | null, fetchedAt = T0): CatalogProduct {
  return {
    id: "p1",
    title: "Day pack",
    descriptionText: "",
    images: [],
    seller: { id: "s1", name: "North Co", domain: "north.myshopify.com", links: [] },
    priceRange: { min: { amount: 12_000, currency: "USD" }, max: { amount: 12_000, currency: "USD" } },
    options: [{ name: "Color", values: [{ label: "Black", available: true }, { label: "Grey", available: false }] }],
    variants: shown ? [shown] : [],
    summarized: { sellingPoints: [], features: [], specs: [] },
    fetchedAt,
  };
}

function ready(p: CatalogProduct, at = p.fetchedAt): DecideState {
  return loaded(initialDecideState(black), { ok: true, product: p }, black, at);
}

const ucp: CheckoutResponse = {
  mode: "ucp",
  continueUrl: "https://north.example/checkouts/abc",
  quantity: 1,
  totals: {
    subtotal: { amount: 12_000, currency: "USD" },
    shipping: { amount: 800, currency: "USD" },
    tax: { amount: 960, currency: "USD" },
    total: { amount: 13_760, currency: "USD" },
  },
  expiresAt: "2026-11-17T16:00:00Z",
};

/** When the quote runs out, and when it arrived by a right clock: 15 minutes before. */
const EXPIRES = Date.parse(ucp.expiresAt!);
const QUOTED = EXPIRES - 15 * 60_000;

function reviewOf(result: CheckoutResponse = ucp, receivedAt = QUOTED): CheckoutState {
  return { state: "review", result, receivedAt };
}

describe("loading price and stock", () => {
  it("opens loading, then shows the product for the buyer's choice", () => {
    const start = initialDecideState(black);
    expect(start.load.state).toBe("loading");
    const state = ready(product(variant(black)));
    expect(state.load).toMatchObject({ state: "ready" });
    expect(state.choiceProblem).toBeNull();
    expect(state.loadedAt).toBe(T0);
  });

  it("keeps the last good product and its choice when a new choice has no variant", () => {
    const first = ready(product(variant(black)));
    const picked = choose(first, variant(black), "Color", "Grey");
    expect(picked.selected).toEqual(grey);
    // The route fell back to Black: Grey has no variant.
    const after = loaded(picked, { ok: true, product: product(variant(black), T0 + 1) }, grey, T0 + 1);
    expect(after.choiceProblem).toBe("revert");
    expect(after.selected).toEqual(black);
    // Still the first product on screen.
    expect(after.load).toBe(first.load);
  });

  it("says the choice is gone when the shown one is no longer listed, and drops old costs", () => {
    const shown = { ...ready(product(variant(black))), checkout: reviewOf() };
    const after = loaded(shown, { ok: true, product: product(variant(grey), T0 + 1) }, black, T0 + 1);
    expect(after.choiceProblem).toBe("gone");
    expect(after.selected).toEqual(grey);
    expect(after.checkout).toEqual({ state: "idle" });
    expect(after.load).toMatchObject({ state: "ready" });
  });

  it("shows a failed load, and Try again goes back to loading", () => {
    const failed = loaded(
      initialDecideState(black),
      { ok: false, error: { code: "catalog_unavailable", message: "Down." }, status: 503 },
      black,
      T0,
    );
    expect(failed.load).toEqual({ state: "failed", error: { code: "catalog_unavailable", message: "Down." }, status: 503 });
    expect(retryLoad(failed).load).toEqual({ state: "loading" });
  });
});

describe("stock", () => {
  it("lets the buyer go on with unknown stock (null), never with sold out or no variant", () => {
    expect(canStartCheckout(variant(black, true), "in_stock")).toBe(true);
    expect(canStartCheckout(variant(black, null), "unknown")).toBe(true);
    expect(canStartCheckout(variant(black, false), "sold_out")).toBe(false);
    expect(canStartCheckout(undefined, "unknown")).toBe(false);
  });
});

describe("two-step checkout", () => {
  it("asks the merchant nothing before the press", () => {
    const state = ready(product(variant(black)));
    expect(state.checkout).toEqual({ state: "idle" });
    expect(costsOf(state.checkout)).toBeUndefined();
    expect(primaryStep(state)).toBe("start");
    expect(primaryLabel(primaryStep(state), "North Co")).toBe("Continue to checkout");
  });

  it("the press posts one item of the shown variant, with the catalog's link as fallback", () => {
    const state = ready(product(variant(black)));
    const step = press(state, T0 + 1_000);
    expect(step.state.checkout).toEqual({ state: "busy" });
    expect(step.command).toEqual({
      kind: "post",
      body: {
        productId: "p1",
        variantId: "v-Black",
        quantity: 1,
        sellerDomain: "north.myshopify.com",
        checkoutUrl: "https://shop.example/cart/1:1",
      },
    });
  });

  it("ucp with totals shows the costs and the expiry, then reads 'Go to {merchant} to pay'", () => {
    const outcome = checkoutAnswered({ ok: true, data: ucp }, QUOTED);
    expect(outcome.leaveTo).toBeNull();
    const state = { ...ready(product(variant(black))), checkout: outcome.checkout! };
    expect(costsOf(state.checkout)).toEqual({ totals: ucp.totals, expiresAt: ucp.expiresAt });
    expect(primaryLabel(primaryStep(state), "North Co")).toBe("Go to North Co to pay");
  });

  it("direct mode sends the buyer straight out, and ucp without totals does too", () => {
    const direct: CheckoutResponse = { mode: "direct", continueUrl: "https://shop.example/cart/1:1", quantity: 1 };
    expect(checkoutAnswered({ ok: true, data: direct }, QUOTED)).toEqual({ checkout: null, leaveTo: direct.continueUrl });
    const bare: CheckoutResponse = { mode: "ucp", continueUrl: "https://north.example/c/1", quantity: 1 };
    expect(checkoutAnswered({ ok: true, data: bare }, QUOTED)).toEqual({ checkout: null, leaveTo: bare.continueUrl });
  });

  it("a failed checkout shows the server's error", () => {
    const error = { code: "checkout_unavailable" as const, message: "Server words." };
    expect(checkoutAnswered({ ok: false, error }, QUOTED)).toEqual({ checkout: { state: "failed", error }, leaveTo: null });
  });

  it("changing a choice clears the costs and brings back 'Continue to checkout'", () => {
    const review = { ...ready(product(variant(black))), checkout: reviewOf() };
    const after = choose(review, variant(black), "Color", "Grey");
    expect(after.checkout).toEqual({ state: "idle" });
    expect(costsOf(after.checkout)).toBeUndefined();
    // Busy until the new choice's price and stock are back, same words.
    expect(primaryStep(after)).toBe("busy");
    expect(primaryLabel(primaryStep(after), "North Co")).toBe("Continue to checkout");
    const back = loaded(after, { ok: true, product: product(variant(grey), T0 + 1) }, grey, T0 + 1);
    expect(primaryStep(back)).toBe("start");
  });

  it("does nothing while a new choice loads, so checkout never carries the old one", () => {
    // On Black, tap Grey, press before the product request returns.
    const onBlack = ready(product(variant(black)));
    const picked = choose(onBlack, variant(black), "Color", "Grey");
    expect(choicePending(picked)).toBe(true);
    expect(press(picked, T0 + 1_000)).toEqual({ state: picked, change: {}, command: { kind: "none" } });
    // Grey is back: the press posts Grey.
    const back = loaded(picked, { ok: true, product: product(variant(grey), T0 + 2_000) }, grey, T0 + 2_000);
    expect(choicePending(back)).toBe(false);
    const step = press(back, T0 + 3_000);
    expect(step.command).toMatchObject({ kind: "post", body: { variantId: "v-Grey" } });
  });

  it("'Save for later' waits while a new choice loads, then saves the new variant", () => {
    const onBlack = ready(product(variant(black)));
    expect(savePress(onBlack, "p1", held)).toEqual({ kind: "save", productId: "p1", variantId: "v-Black" });
    // On Black, tap Grey, press Save before the product request returns.
    const picked = choose(onBlack, variant(black), "Color", "Grey");
    expect(savePress(picked, "p1", held)).toEqual({ kind: "none" });
    const back = loaded(picked, { ok: true, product: product(variant(grey), T0 + 1) }, grey, T0 + 1);
    expect(savePress(back, "p1", held)).toEqual({ kind: "save", productId: "p1", variantId: "v-Grey" });
  });

  it("'Save for later' keeps the held size or colour before the product loads or after it failed", () => {
    const start = initialDecideState(black);
    const failed = loaded(start, { ok: false, error: { code: "unknown", message: "x" }, status: 500 }, black, T0);
    for (const state of [start, failed]) {
      expect(savePress(state, "p1", held)).toEqual({ kind: "save", productId: "p1", variantId: "v-L" });
      // The decision holds another product, or nothing: no variant to keep.
      expect(savePress(state, "p1", { productId: "p2", variantId: "v-other" })).toEqual({
        kind: "save",
        productId: "p1",
        variantId: undefined,
      });
      expect(savePress(state, "p1", {})).toEqual({ kind: "save", productId: "p1", variantId: undefined });
    }
  });

  it("is not waiting after a new choice fell back to the earlier one", () => {
    const picked = choose(ready(product(variant(black))), variant(black), "Color", "Grey");
    const reverted = loaded(picked, { ok: true, product: product(variant(black), T0 + 1) }, grey, T0 + 1);
    expect(reverted.choiceProblem).toBe("revert");
    expect(choicePending(reverted)).toBe(false);
    expect(press(reverted, T0 + 2).command.kind).toBe("post");
  });

  it("the pay press goes to the merchant's link while the quote holds", () => {
    const review = { ...ready(product(variant(black))), checkout: reviewOf() };
    const before = EXPIRES - 1_000;
    expect(quoteExpired(review.checkout, before)).toBe(false);
    expect(payPress(review, before)).toEqual({ change: {}, command: { kind: "leave", url: ucp.continueUrl } });
  });

  it("a quote that ran out never sends the buyer to the old link: back to step 1, and says why", () => {
    const review = { ...ready(product(variant(black))), checkout: reviewOf() };
    for (const at of [EXPIRES, EXPIRES + 60_000]) {
      expect(quoteExpired(review.checkout, at)).toBe(true);
      const step = payPress(review, at);
      expect(step.command).toEqual({ kind: "none" });
      const after = withChange(review, step.change);
      expect(after.checkout).toEqual({ state: "idle" });
      expect(after.quoteRanOut).toBe(true);
      expect(costsOf(after.checkout)).toBeUndefined();
      expect(primaryStep(after)).toBe("start");
      // The next press asks for fresh costs.
      expect(press(after, T0 + 1_000).command.kind).toBe("post");
    }
  });

  it("a buyer's clock far ahead does not loop: a quote that looks run out on arrival goes to the merchant", () => {
    // The clock runs two hours ahead, longer than the quote's 15-minute life.
    const ahead = 2 * 60 * 60_000;
    const landed = QUOTED + ahead;
    const outcome = checkoutAnswered({ ok: true, data: ucp }, landed);
    const review = { ...ready(product(variant(black))), checkout: outcome.checkout! };
    // Pay at once, or after reading the costs for ten minutes: both go out.
    for (const at of [landed + 1_000, landed + 10 * 60_000]) {
      expect(quoteExpired(review.checkout, at)).toBe(false);
      expect(payPress(review, at).command).toEqual({ kind: "leave", url: ucp.continueUrl });
    }
  });

  it("a quote that runs out within a minute of landing still goes to the merchant", () => {
    // Clock a little ahead: the expiry passes 30 seconds after the costs came.
    const review = reviewOf(ucp, EXPIRES - 30_000);
    expect(quoteExpired(review, EXPIRES + 1_000)).toBe(false);
    // Past the gap it counts as run out.
    expect(quoteExpired(review, EXPIRES - 30_000 + RECHECK_GAP_MS + 1)).toBe(true);
  });

  it("the next press or a new choice clears the 'ran out' flag", () => {
    const ranOut = withChange(
      { ...ready(product(variant(black))), checkout: reviewOf() },
      payPress({ ...ready(product(variant(black))), checkout: reviewOf() }, EXPIRES).change,
    );
    expect(ranOut.quoteRanOut).toBe(true);
    expect(withChange(ranOut, press(ranOut, T0 + 1_000).change).quoteRanOut).toBe(false);
    expect(press(ranOut, T0 + STALE_AFTER_MS + 60_000).state.quoteRanOut).toBe(false);
    expect(choose(ranOut, variant(black), "Color", "Grey").quoteRanOut).toBe(false);
    expect(initialDecideState(black).quoteRanOut).toBe(false);
  });

  it("a quote with no expiry, or one that does not parse, does not expire", () => {
    const late = EXPIRES + 60_000;
    expect(quoteExpired(reviewOf({ ...ucp, expiresAt: undefined }), late)).toBe(false);
    expect(quoteExpired(reviewOf({ ...ucp, expiresAt: "soon" }), late)).toBe(false);
    expect(quoteExpired({ state: "idle" }, late)).toBe(false);
  });

  it("the pay press does nothing outside the review step", () => {
    expect(payPress(ready(product(variant(black))), T0)).toEqual({ change: {}, command: { kind: "none" } });
  });

  it("shows the quantity the checkout holds, 1 before a review", () => {
    expect(shownQuantity({ state: "idle" })).toBe(1);
    expect(shownQuantity(reviewOf({ ...ucp, quantity: 2 }))).toBe(2);
  });

  it("frees a busy button when the page hides or comes back, and leaves other states alone", () => {
    const state = ready(product(variant(black)));
    expect(freeCheckout({ ...state, checkout: { state: "busy" } }).checkout).toEqual({ state: "idle" });
    const review = { ...state, checkout: reviewOf() };
    expect(freeCheckout(review)).toBe(review);
  });
});

describe("recheck when stale", () => {
  it("checks price and stock again instead of posting, then says so once they are back", () => {
    const state = ready(product(variant(black)));
    const late = T0 + STALE_AFTER_MS + 60_000;
    const step = press(state, late);
    expect(step.command).toEqual({ kind: "recheck" });
    expect(step.state.rechecking).toBe(true);
    expect(step.state.checkout).toEqual({ state: "idle" });
    expect(primaryLabel(primaryStep(step.state), "North Co")).toBe("Checking price and stock again");

    const back = loaded(step.state, { ok: true, product: product(variant(black), late) }, black, late);
    expect(back.rechecking).toBe(false);
    expect(back.rechecked).toBe(true);
    // Fresh now: the next press posts.
    expect(press(back, late + 1_000).command.kind).toBe("post");
  });

  it("a recheck that fails does not say it was checked", () => {
    const step = press(ready(product(variant(black))), T0 + STALE_AFTER_MS + 60_000);
    const back = loaded(step.state, { ok: false, error: { code: "unknown", message: "x" }, status: 500 }, black, T0);
    expect(back.rechecked).toBe(false);
    expect(back.load.state).toBe("failed");
  });

  it("a new choice clears the 'checked again' line", () => {
    const step = press(ready(product(variant(black))), T0 + STALE_AFTER_MS + 60_000);
    const back = loaded(step.state, { ok: true, product: product(variant(black), T0) }, black, T0 + STALE_AFTER_MS + 61_000);
    expect(choose(back, variant(black), "Color", "Grey").rechecked).toBe(false);
  });

  it("does nothing before the product has loaded", () => {
    const start = initialDecideState(black);
    expect(press(start, T0)).toEqual({ state: start, change: {}, command: { kind: "none" } });
  });
});

describe("the checkout answer meets the latest state", () => {
  const direct: CheckoutResponse = { mode: "direct", continueUrl: "https://shop.example/cart/1:1", quantity: 1 };

  function pressedOnBlack() {
    const step = press(ready(product(variant(black))), T0 + 1_000);
    if (step.command.kind !== "post") throw new Error("expected a post");
    return { busy: step.state, posted: step.command.body.variantId };
  }

  it("applies the answer while the posted variant is still on screen", () => {
    const { busy, posted } = pressedOnBlack();
    expect(answerCheckout(busy, posted, { ok: true, data: ucp }, QUOTED)).toEqual({
      change: { checkout: reviewOf(ucp, QUOTED) },
      leaveTo: null,
    });
    expect(answerCheckout(busy, posted, { ok: true, data: direct }, QUOTED)).toEqual({
      change: {},
      leaveTo: direct.continueUrl,
    });
    const error = { code: "checkout_unavailable" as const, message: "Server words." };
    expect(answerCheckout(busy, posted, { ok: false, error }, QUOTED).change).toEqual({
      checkout: { state: "failed", error },
    });
  });

  it("drops an answer for a variant a 'gone' refetch swapped out, and frees the button", () => {
    const { busy, posted } = pressedOnBlack();
    // A refetch came back: Black is gone, the catalog shows Grey.
    const swapped = loaded(busy, { ok: true, product: product(variant(grey), T0 + 2_000) }, black, T0 + 2_000);
    expect(swapped.choiceProblem).toBe("gone");
    // Costs for Black are not shown, and a direct answer does not leave.
    expect(answerCheckout(swapped, posted, { ok: true, data: ucp }, QUOTED)).toEqual({ change: {}, leaveTo: null });
    expect(answerCheckout(swapped, posted, { ok: true, data: direct }, QUOTED).leaveTo).toBeNull();
    // Had the button still been busy, it is freed.
    const stillBusy = { ...swapped, checkout: { state: "busy" as const } };
    expect(answerCheckout(stillBusy, posted, { ok: true, data: direct }, QUOTED)).toEqual({
      change: { checkout: { state: "idle" } },
      leaveTo: null,
    });
  });

  it("drops the answer while a new choice loads, or when the product is not on screen", () => {
    const { busy, posted } = pressedOnBlack();
    const choosing = { ...choose(busy, variant(black), "Color", "Grey"), checkout: { state: "busy" as const } };
    expect(answerCheckout(choosing, posted, { ok: true, data: direct }, QUOTED)).toEqual({
      change: { checkout: { state: "idle" } },
      leaveTo: null,
    });
    const reloading = retryLoad(busy);
    expect(answerCheckout(reloading, posted, { ok: true, data: direct }, QUOTED)).toEqual({
      change: { checkout: { state: "idle" } },
      leaveTo: null,
    });
  });
});

describe("applying a press to the latest state", () => {
  it("keeps a load result that landed after the render the press read", () => {
    // The screen rendered `seen`; a fresh load for the same choice is queued
    // (`latest`) before the press runs on `seen`.
    const seen = ready(product(variant(black)));
    const latest = loaded(seen, { ok: true, product: product(variant(black), T0 + 5_000) }, black, T0 + 5_000);
    const step = press(seen, T0 + 6_000);
    expect(step.change).toEqual({ checkout: { state: "busy" }, quoteRanOut: false });
    // The whole state built from `seen` would drop the newer load...
    expect(step.state.loadedAt).toBe(T0);
    // ...applying only the change keeps it.
    const applied = withChange(latest, step.change);
    expect(applied.load).toBe(latest.load);
    expect(applied.loadedAt).toBe(T0 + 5_000);
    expect(applied.checkout).toEqual({ state: "busy" });
  });

  it("a recheck press changes only the recheck flags", () => {
    const step = press(ready(product(variant(black))), T0 + STALE_AFTER_MS + 60_000);
    expect(step.change).toEqual({ rechecked: false, rechecking: true, quoteRanOut: false });
  });

  it("a press that does nothing leaves the latest state as it is", () => {
    const latest = ready(product(variant(black)));
    expect(withChange(latest, press(initialDecideState(black), T0).change)).toBe(latest);
  });
});
