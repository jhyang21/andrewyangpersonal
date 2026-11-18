import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import { sessionReducer } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import {
  DECIDE,
  choiceProblemError,
  costRows,
  decideTarget,
  entryOf,
  focusAfterLoad,
  noPolicyText,
  optionsHref,
  policyLinks,
  pressAnnouncement,
  quantityNote,
  quoteRanOutText,
  quoteUntilText,
  showsEndActions,
  stockLine,
  tradeoffOf,
} from "./decide-screen-model";

const AT = Date.UTC(2026, 10, 17, 14, 0);
const session = seedDecision(AT);
const commuter = "gid://shopify/p/seed-commuter";
const usd = (dollars: number) => ({ amount: dollars * 100, currency: "USD" });

describe("decideTarget", () => {
  it("takes a product on the decision's options", () => {
    expect(decideTarget(session, commuter)).toBe(commuter);
  });

  it("gives null with no product, or one the decision does not hold", () => {
    expect(decideTarget(session, undefined)).toBeNull();
    expect(decideTarget(session, "gid://shopify/p/not-here")).toBeNull();
  });

  it("takes the product the buyer decided on, even off the options", () => {
    const off = "gid://shopify/p/elsewhere";
    const saved: DecisionSession = { ...session, decision: { status: "saved", productId: off } };
    expect(decideTarget(saved, off)).toBe(off);
  });

  it("takes the product taken to checkout", () => {
    const off = "gid://shopify/p/elsewhere";
    const started = sessionReducer(session, {
      type: "checkout_started",
      productId: off,
      variantId: "v1",
      at: AT,
    });
    expect(decideTarget(started, off)).toBe(off);
  });
});

describe("the two ways out", () => {
  it("show while the decision is open or saved, not once it ended", () => {
    expect(showsEndActions("open")).toBe(true);
    expect(showsEndActions("saved")).toBe(true);
    expect(showsEndActions("declined")).toBe(false);
    expect(showsEndActions("bought")).toBe(false);
  });
});

describe("words on Decide", () => {
  it("links back to Options", () => {
    expect(optionsHref("abc")).toBe("/projects/pica/d/abc?view=options");
  });

  it("says stock plainly and never guesses", () => {
    expect(stockLine("in_stock")).toBe("In stock");
    expect(stockLine("sold_out")).toBe("This choice is sold out. Pick another size or colour, or another option.");
    expect(stockLine("unknown")).toBe("Stock not confirmed. You can still continue; the merchant confirms at checkout.");
  });

  it("calls a size or colour a choice, never an option, and never says we", () => {
    for (const problem of ["revert", "gone"] as const) {
      const error = choiceProblemError(problem);
      expect(error.code).toBe("variant_unavailable");
      expect(error.message).not.toMatch(/\boption\b|\bwe\b/i);
    }
    expect(choiceProblemError("revert").message).toBe(
      "That size or colour isn't available. Your earlier choice is still selected.",
    );
  });

  it("names the merchant when it lists no policy", () => {
    expect(noPolicyText("Harbor Bags")).toBe("The catalog lists no return or shipping policy for Harbor Bags.");
  });

  it("lists https policy links, refund and shipping first, in plain words", () => {
    const links = policyLinks([
      { type: "privacy_policy", url: "https://a.example/privacy" },
      { type: "shipping_policy", url: "https://a.example/ship" },
      { type: "refund_policy", url: "http://a.example/refund" },
    ]);
    expect(links).toEqual([
      { label: "Shipping policy", url: "https://a.example/ship" },
      { label: "Privacy policy", url: "https://a.example/privacy" },
    ]);
  });
});

describe("the tradeoff", () => {
  it("takes the first fit line and the first drawback from the shortlist", () => {
    const entry = entryOf(session, commuter);
    expect(entry).not.toBeNull();
    expect(tradeoffOf(entry)).toEqual({
      fits: { text: entry!.whyItFits[0], given: true },
      not: { text: entry!.whyNot[0], given: true },
    });
  });

  it("gives a missing side a plain line, so both sides always show", () => {
    const entry = entryOf(session, commuter)!;
    expect(tradeoffOf({ ...entry, whyNot: [] })?.not).toEqual({ text: "Pica listed no drawback.", given: false });
    expect(tradeoffOf({ ...entry, whyItFits: [], whyNot: [] })).toEqual({
      fits: { text: "Pica gave no reason here.", given: false },
      not: { text: "Pica listed no drawback.", given: false },
    });
  });

  it("is null for a product with no shortlist entry", () => {
    expect(entryOf(session, "gid://shopify/p/none")).toBeNull();
    expect(tradeoffOf(null)).toBeNull();
  });
});

describe("focusAfterLoad", () => {
  const lost = { live: true, retried: false, wasOnContinue: false, focusLost: true };

  it("moves focus to Save only when the load failed and focus fell from Continue", () => {
    expect(focusAfterLoad({ ...lost, load: "failed", wasOnContinue: true })).toBe("save");
    // Focus was elsewhere, or is still on something: leave it.
    expect(focusAfterLoad({ ...lost, load: "failed" })).toBeNull();
    expect(focusAfterLoad({ ...lost, load: "failed", wasOnContinue: true, focusLost: false })).toBeNull();
    // Loaded: Continue is on screen.
    expect(focusAfterLoad({ ...lost, load: "ready", wasOnContinue: true })).toBeNull();
  });

  it("moves focus to the busy Continue after Try again", () => {
    // If the retry fails too, the case above carries focus on to Save.
    expect(focusAfterLoad({ ...lost, load: "loading", retried: true })).toBe("continue");
    // A first load, with no Try again: leave it.
    expect(focusAfterLoad({ ...lost, load: "loading" })).toBeNull();
    // Focus already went somewhere: leave it.
    expect(focusAfterLoad({ ...lost, load: "loading", retried: true, focusLost: false })).toBeNull();
  });

  it("moves focus to See how this ended after Try again on an ended decision", () => {
    expect(focusAfterLoad({ ...lost, load: "loading", retried: true, live: false })).toBe("ending");
    expect(focusAfterLoad({ ...lost, load: "loading", live: false })).toBeNull();
  });
});

describe("costs", () => {
  it("shows the merchant's figures, and says where a missing one shows", () => {
    const rows = costRows({ subtotal: usd(129), tax: usd(10), total: usd(139) }, "North Trail Supply");
    expect(rows).toEqual([
      { label: "Subtotal", value: "$129", total: false },
      { label: "Shipping", value: "Shown at North Trail Supply", total: false },
      { label: "Tax", value: "$10", total: false },
      { label: "Total", value: "$139", total: true },
    ]);
  });

  it("says when the quote runs out, and nothing when it has no time or a bad one", () => {
    expect(quoteUntilText("2026-11-17T15:40:00Z")).toMatch(/^These costs hold until .+\.$/);
    expect(quoteUntilText(undefined)).toBeNull();
    expect(quoteUntilText("not a time")).toBeNull();
  });

  it("notes a checkout that holds more than one", () => {
    expect(quantityNote(1, "Harbor Bags")).toBeNull();
    expect(quantityNote(2, "Harbor Bags")).toBe(
      "Harbor Bags's checkout holds 2 of this item, not 1. Change the amount there before you pay.",
    );
  });
});

describe("pressAnnouncement", () => {
  const none = { quoteRanOut: false, rechecked: false, quantity: 1 };

  it("is empty until a press changes something", () => {
    expect(pressAnnouncement(none, "North")).toBe("");
  });

  it("says the costs came, they ran out, or the price was checked again", () => {
    const costs = { totals: { subtotal: usd(129), total: usd(139) } };
    expect(pressAnnouncement({ ...none, costs }, "North")).toBe("North sent the costs. Total $139.");
    expect(pressAnnouncement({ ...none, quoteRanOut: true }, "North")).toBe(quoteRanOutText("North"));
    expect(pressAnnouncement({ ...none, rechecked: true }, "North")).toBe(DECIDE.rechecked);
    expect(pressAnnouncement({ ...none, costs, quantity: 2 }, "North")).toBe(
      `North sent the costs. Total $139. ${quantityNote(2, "North")}`,
    );
  });
});
