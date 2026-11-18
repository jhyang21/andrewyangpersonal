import { describe, expect, it } from "vitest";
import type { Canvas, CatalogProduct, Comparison, DecisionSession, Shortlist } from "@/pica/lib/types";
import { checkoutTargetOf, createSession, sessionReducer, titleFrom, type SessionAction } from "./reducer";

const T0 = 1_700_000_000_000;

function product(id: string, fetchedAt = T0): CatalogProduct {
  return {
    id,
    title: `Product ${id}`,
    descriptionText: "",
    images: [],
    seller: { id: "s", name: "Shop", links: [] },
    priceRange: { min: { amount: 1000, currency: "USD" }, max: { amount: 1000, currency: "USD" } },
    options: [],
    variants: [],
    summarized: { sellingPoints: [], features: [], specs: [] },
    fetchedAt,
  } as unknown as CatalogProduct;
}

const shortlist: Shortlist = {
  entries: [
    { productId: "p1", angle: "Lighter", whyItFits: [], whyNot: [], valueNote: "", unverified: [] },
  ],
  note: "",
  createdAt: T0,
  stale: false,
};

const comparison: Comparison = {
  productIds: ["p1", "p2"],
  rows: [],
  takeaway: "",
  createdAt: T0,
  stale: false,
};

const guessed: Canvas = {
  category: "backpack",
  outcome: { text: "A work backpack", source: "inferred" },
  budget: { maxUsd: 150, source: "inferred" },
  items: [{ id: "i1", kind: "must_have", text: "Fits a 16-inch laptop", source: "inferred" }],
};

function withShortlist(): DecisionSession {
  return { ...createSession({ id: "s1", at: T0, title: "Work bag", canvas: guessed }), shortlist, comparison };
}

function run(session: DecisionSession, ...actions: SessionAction[]) {
  return actions.reduce(sessionReducer, session);
}

describe("createSession", () => {
  it("starts open with an empty canvas and a short title", () => {
    const session = createSession({ id: "s1", at: T0, title: "  Help me   find a bag  " });
    expect(session.decision).toEqual({ status: "open" });
    expect(session.title).toBe("Help me find a bag");
    expect(session.canvas.items).toEqual([]);
    expect(session.shortlist).toBeNull();
  });

  it("cuts a long title on a word", () => {
    const title = titleFrom("word ".repeat(30));
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith(" ")).toBe(false);
  });
});

describe("stale marking", () => {
  it("a buyer edit marks the shortlist and comparison stale", () => {
    const next = sessionReducer(withShortlist(), {
      type: "canvas_edited",
      edit: { kind: "item_added", item: { id: "i2", kind: "preference", text: "Black" } },
      at: T0 + 1,
    });
    expect(next.shortlist?.stale).toBe(true);
    expect(next.comparison?.stale).toBe(true);
    expect(next.canvas.items.at(-1)).toMatchObject({ text: "Black", source: "stated" });
    expect(next.updatedAt).toBe(T0 + 1);
  });

  it("an edit that changes nothing leaves the session alone", () => {
    const session = withShortlist();
    const next = sessionReducer(session, {
      type: "canvas_edited",
      edit: { kind: "category", category: "backpack" },
      at: T0 + 1,
    });
    expect(next).toBe(session);
  });

  it("Pica's canvas change from chat marks the old shortlist stale", () => {
    const next = sessionReducer(withShortlist(), {
      type: "tool_output_applied",
      toolCallId: "c1",
      tool: "update_canvas",
      output: { canvas: { ...guessed, budget: { maxUsd: 100, source: "stated" } } },
      at: T0 + 1,
    });
    expect(next.canvas.budget?.maxUsd).toBe(100);
    expect(next.shortlist?.stale).toBe(true);
    expect(next.comparison?.stale).toBe(true);
  });

  it("Pica's canvas update that changes nothing leaves the shortlist current, whatever the key order", () => {
    // The same canvas as `guessed`, with every object's keys in another order.
    const reordered = {
      items: [{ source: "inferred", text: "Fits a 16-inch laptop", kind: "must_have", id: "i1" }],
      budget: { source: "inferred", maxUsd: 150 },
      outcome: { source: "inferred", text: "A work backpack" },
      category: "backpack",
    } as Canvas;
    const session = withShortlist();
    const next = sessionReducer(session, {
      type: "tool_output_applied",
      toolCallId: "c1",
      tool: "update_canvas",
      output: { canvas: reordered },
      at: T0 + 1,
    });
    expect(next.shortlist?.stale).toBe(false);
    expect(next.canvas).toBe(session.canvas);
  });

  it("a buyer's budget and the server's copy of it count as the same", () => {
    const fresh = run(
      withShortlist(),
      { type: "canvas_edited", edit: { kind: "budget", minUsd: 50, maxUsd: 100 }, at: T0 + 1 },
      {
        type: "tool_output_applied",
        toolCallId: "c2",
        tool: "present_shortlist",
        output: { shortlist: { ...shortlist, createdAt: T0 + 3 } },
        request: { at: T0 + 2, canvas: guessed },
        at: T0 + 3,
      },
    );
    expect(fresh.shortlist?.stale).toBe(false);
    // The server sends the budget back as {minUsd, maxUsd, source}.
    const next = sessionReducer(fresh, {
      type: "tool_output_applied",
      toolCallId: "c3",
      tool: "update_canvas",
      output: { canvas: { ...fresh.canvas, budget: { minUsd: 50, maxUsd: 100, source: "stated" } } },
      request: { at: T0 + 4, canvas: fresh.canvas },
      at: T0 + 5,
    });
    expect(next.shortlist?.stale).toBe(false);
  });

  // The buyer edits at T0 + 2. A shortlist is fresh only if its request went out after that.
  const edited = () =>
    run(withShortlist(), { type: "canvas_edited", edit: { kind: "item_removed", id: "i1" }, at: T0 + 2 });
  const newShortlist = (requestAt: number): SessionAction => ({
    type: "tool_output_applied",
    toolCallId: "c2",
    tool: "present_shortlist",
    output: { shortlist: { ...shortlist, createdAt: T0 + 5, stale: true } },
    request: { at: requestAt, canvas: guessed },
    at: T0 + 5,
  });

  it("a shortlist asked for after the last edit clears the stale mark", () => {
    const next = sessionReducer(edited(), newShortlist(T0 + 3));
    expect(next.shortlist?.stale).toBe(false);
    expect(next.comparison?.stale).toBe(true);
  });

  it("a shortlist asked for before the last edit stays stale", () => {
    const next = sessionReducer(edited(), newShortlist(T0 + 1));
    expect(next.shortlist?.stale).toBe(true);
  });

  it("a comparison follows the same rule", () => {
    const next = sessionReducer(edited(), {
      type: "tool_output_applied",
      toolCallId: "c3",
      tool: "compare_products",
      output: { comparison: { ...comparison, createdAt: T0 + 5 } },
      request: { at: T0 + 1, canvas: guessed },
      at: T0 + 5,
    });
    expect(next.comparison?.stale).toBe(true);
  });

  it("a shortlist later in the same reply clears the mark Pica's canvas change set", () => {
    const next = run(
      withShortlist(),
      {
        type: "tool_output_applied",
        toolCallId: "c1",
        tool: "update_canvas",
        output: { canvas: { ...guessed, category: "luggage" } },
        request: { at: T0 + 1, canvas: guessed },
        at: T0 + 2,
      },
      newShortlist(T0 + 1),
    );
    expect(next.shortlist?.stale).toBe(false);
  });

  const canvasUpdate = (requestAt: number): SessionAction => ({
    type: "tool_output_applied",
    toolCallId: "c9",
    tool: "update_canvas",
    output: { canvas: { ...guessed, category: "luggage" } },
    request: { at: requestAt, canvas: guessed },
    at: T0 + 6,
  });
  const newComparison = (requestAt: number): SessionAction => ({
    type: "tool_output_applied",
    toolCallId: "c8",
    tool: "compare_products",
    output: { comparison: { ...comparison, createdAt: T0 + 5 } },
    request: { at: requestAt, canvas: guessed },
    at: T0 + 5,
  });

  it("a shortlist and comparison earlier in the same reply stay current after Pica's canvas change", () => {
    const next = run(withShortlist(), newShortlist(T0 + 1), newComparison(T0 + 1), canvasUpdate(T0 + 1));
    expect(next.canvas.category).toBe("luggage");
    expect(next.shortlist?.stale).toBe(false);
    expect(next.comparison?.stale).toBe(false);
  });

  it("a comparison later in the same reply is current too", () => {
    const next = run(withShortlist(), canvasUpdate(T0 + 1), newComparison(T0 + 1));
    expect(next.comparison?.stale).toBe(false);
  });

  it("Pica's canvas change in a later reply marks the earlier shortlist and comparison stale", () => {
    const next = run(withShortlist(), newShortlist(T0 + 1), newComparison(T0 + 1), canvasUpdate(T0 + 7));
    expect(next.shortlist?.stale).toBe(true);
    expect(next.comparison?.stale).toBe(true);
  });

  it("confirming a guess turns it into a stated item", () => {
    const next = run(
      withShortlist(),
      { type: "canvas_edited", edit: { kind: "item_confirmed", id: "i1" }, at: T0 + 1 },
      { type: "canvas_edited", edit: { kind: "outcome_confirmed" }, at: T0 + 2 },
      { type: "canvas_edited", edit: { kind: "budget_confirmed" }, at: T0 + 3 },
    );
    expect(next.canvas.items[0].source).toBe("stated");
    expect(next.canvas.outcome?.source).toBe("stated");
    expect(next.canvas.budget?.source).toBe("stated");
  });

  it("confirming a guess leaves the shortlist and comparison current", () => {
    const next = run(
      withShortlist(),
      { type: "canvas_edited", edit: { kind: "item_confirmed", id: "i1" }, at: T0 + 1 },
      { type: "canvas_edited", edit: { kind: "outcome_confirmed" }, at: T0 + 2 },
      { type: "canvas_edited", edit: { kind: "budget_confirmed" }, at: T0 + 3 },
    );
    expect(next.canvas.items[0].source).toBe("stated");
    expect(next.shortlist?.stale).toBe(false);
    expect(next.comparison?.stale).toBe(false);
    expect(next.updatedAt).toBe(T0 + 3);
  });

  it("changing or removing a guess still marks the shortlist and comparison stale", () => {
    for (const edit of [
      { kind: "item_changed", id: "i1", text: "Fits a 15-inch laptop" },
      { kind: "item_removed", id: "i1" },
      { kind: "outcome", text: "A gym bag" },
      { kind: "budget", maxUsd: 120 },
    ] as const) {
      const next = sessionReducer(withShortlist(), { type: "canvas_edited", edit, at: T0 + 1 });
      expect(next.shortlist?.stale).toBe(true);
      expect(next.comparison?.stale).toBe(true);
    }
  });

  it("a confirm does not clear a stale mark set by an earlier edit", () => {
    const next = run(
      withShortlist(),
      { type: "canvas_edited", edit: { kind: "budget", maxUsd: 120 }, at: T0 + 1 },
      { type: "canvas_edited", edit: { kind: "item_confirmed", id: "i1" }, at: T0 + 2 },
    );
    expect(next.shortlist?.stale).toBe(true);
    expect(next.comparison?.stale).toBe(true);
  });

  it("a confirm made after a request went out survives Pica's canvas from that request", () => {
    const next = run(
      withShortlist(),
      { type: "canvas_edited", edit: { kind: "item_confirmed", id: "i1" }, at: T0 + 2 },
      {
        type: "tool_output_applied",
        toolCallId: "c1",
        tool: "update_canvas",
        output: { canvas: guessed },
        request: { at: T0 + 1, canvas: guessed },
        at: T0 + 3,
      },
    );
    expect(next.canvas.items[0].source).toBe("stated");
  });

  it("a confirm that comes through chat leaves the shortlist and comparison current", () => {
    // The buyer says "yes, 16-inch"; Pica's update only turns guesses into stated needs.
    const confirmed: Canvas = {
      ...guessed,
      budget: { maxUsd: 150, source: "stated" },
      items: [{ ...guessed.items[0], source: "stated" }],
    };
    const next = sessionReducer(withShortlist(), {
      type: "tool_output_applied",
      toolCallId: "c1",
      tool: "update_canvas",
      output: { canvas: confirmed },
      at: T0 + 1,
    });
    expect(next.canvas.items[0].source).toBe("stated");
    expect(next.canvas.budget?.source).toBe("stated");
    expect(next.shortlist?.stale).toBe(false);
    expect(next.comparison?.stale).toBe(false);
  });

  it("a chat update that confirms one need and changes another still marks things stale", () => {
    const next = sessionReducer(withShortlist(), {
      type: "tool_output_applied",
      toolCallId: "c1",
      tool: "update_canvas",
      output: {
        canvas: { ...guessed, items: [{ ...guessed.items[0], source: "stated" }], budget: { maxUsd: 100, source: "inferred" } },
      },
      at: T0 + 1,
    });
    expect(next.shortlist?.stale).toBe(true);
    expect(next.comparison?.stale).toBe(true);
  });

  it("a budget edit swaps a reversed range", () => {
    const next = sessionReducer(withShortlist(), {
      type: "canvas_edited",
      edit: { kind: "budget", minUsd: 200, maxUsd: 100 },
      at: T0 + 1,
    });
    expect(next.canvas.budget).toEqual({ minUsd: 100, maxUsd: 200, source: "stated" });
  });
});

describe("tool outputs apply once", () => {
  it("ignores a tool call ID it has already applied", () => {
    const action: SessionAction = {
      type: "tool_output_applied",
      toolCallId: "search-1",
      tool: "search_catalog",
      output: { products: [product("p1")], totalCount: 1 },
      at: T0 + 1,
    };
    const once = sessionReducer(withShortlist(), action);
    const twice = sessionReducer(once, { ...action, at: T0 + 2 });
    expect(twice).toBe(once);
    expect(once.appliedToolCallIds).toEqual(["search-1"]);
    expect(Object.keys(once.products)).toEqual(["p1"]);
  });

  it("a replayed canvas update does not undo a later buyer edit", () => {
    const update: SessionAction = {
      type: "tool_output_applied",
      toolCallId: "canvas-1",
      tool: "update_canvas",
      output: { canvas: guessed },
      at: T0 + 1,
    };
    const next = run(
      createSession({ id: "s1", at: T0, title: "Bag" }),
      update,
      { type: "canvas_edited", edit: { kind: "category", category: "luggage" }, at: T0 + 2 },
      update,
    );
    expect(next.canvas.category).toBe("luggage");
  });

  it("records ask_question without changing anything else", () => {
    const session = withShortlist();
    const next = sessionReducer(session, {
      type: "tool_output_applied",
      toolCallId: "q1",
      tool: "ask_question",
      output: { question: { question: "Q", why: "W", options: ["A", "B"] } },
      at: T0 + 1,
    });
    expect(next.appliedToolCallIds).toEqual(["q1"]);
    expect(next.canvas).toBe(session.canvas);
  });
});

describe("canvas race with a streaming reply", () => {
  // Pica's update_canvas returns a whole canvas built from the one sent with
  // the request (at T0 + 1). The workspace locks edits mid-reply; the reducer
  // still keeps any buyer change made after the request went out.
  const sent = withShortlist();
  const request = { at: T0 + 1, canvas: sent.canvas };
  const fromPica: Canvas = {
    ...sent.canvas,
    budget: { maxUsd: 200, source: "stated" },
    items: [...sent.canvas.items, { id: "p1", kind: "preference", text: "Black", source: "inferred" }],
  };
  const picaOutput: SessionAction = {
    type: "tool_output_applied",
    toolCallId: "canvas-1",
    tool: "update_canvas",
    output: { canvas: fromPica },
    request,
    at: T0 + 3,
  };
  const added: SessionAction = {
    type: "canvas_edited",
    edit: { kind: "item_added", item: { id: "i9", kind: "must_have", text: "Waterproof" } },
    at: T0 + 2,
  };

  it("keeps an item the buyer added after the request, and takes Pica's changes", () => {
    const next = run(sent, added, picaOutput);
    expect(next.canvas.items.map((item) => item.id)).toEqual(["i1", "p1", "i9"]);
    expect(next.canvas.budget?.maxUsd).toBe(200);
  });

  it("keeps the buyer's removal, change and budget over Pica's copy", () => {
    const next = run(
      sent,
      { type: "canvas_edited", edit: { kind: "item_changed", id: "i1", text: "Fits a 15-inch laptop" }, at: T0 + 2 },
      { type: "canvas_edited", edit: { kind: "budget", maxUsd: 120 }, at: T0 + 2 },
      picaOutput,
    );
    expect(next.canvas.items.find((item) => item.id === "i1")).toMatchObject({
      text: "Fits a 15-inch laptop",
      source: "stated",
    });
    expect(next.canvas.budget).toEqual({ maxUsd: 120, source: "stated" });

    const removed = run(sent, { type: "canvas_edited", edit: { kind: "item_removed", id: "i1" }, at: T0 + 2 }, picaOutput);
    expect(removed.canvas.items.map((item) => item.id)).toEqual(["p1"]);
  });

  it("takes Pica's canvas whole when the buyer made no change since the request", () => {
    const before = run(sent, { ...added, at: T0 });
    const next = sessionReducer(before, picaOutput);
    expect(next.canvas).toEqual(fromPica);
  });

  it("an edit made after Pica's canvas lands keeps both", () => {
    const next = run(sent, picaOutput, { ...added, at: T0 + 4 });
    expect(next.canvas.budget?.maxUsd).toBe(200);
    expect(next.canvas.items.at(-1)).toMatchObject({ id: "i9", source: "stated" });
    expect(next.shortlist?.stale).toBe(true);
  });
});

describe("decisions and outcomes", () => {
  it("checkout start, then 'yes, I bought it', ends as bought", () => {
    const next = run(
      withShortlist(),
      { type: "checkout_started", productId: "p1", variantId: "v1", at: T0 + 1 },
      { type: "checkout_answered", bought: true, at: T0 + 2 },
    );
    expect(next.checkoutStartedAt).toBeUndefined();
    expect(next.decision).toMatchObject({ status: "bought", productId: "p1", variantId: "v1", decidedAt: T0 + 2 });
  });

  it("checkout start keeps the chosen options until the buyer answers", () => {
    const options = [{ name: "Size", label: '16"' }];
    const started = run(withShortlist(), {
      type: "checkout_started",
      productId: "p1",
      variantId: "v1",
      options,
      at: T0 + 1,
    });
    expect(checkoutTargetOf(started)).toEqual({ productId: "p1", variantId: "v1", options });
    const answered = sessionReducer(started, { type: "checkout_answered", bought: false, at: T0 + 2 });
    expect(checkoutTargetOf(answered).options).toBeUndefined();
  });

  it("'not yet' clears the question and keeps the session open", () => {
    const next = run(
      withShortlist(),
      { type: "checkout_started", productId: "p1", variantId: "v1", at: T0 + 1 },
      { type: "checkout_answered", bought: false, at: T0 + 2 },
    );
    expect(next.checkoutStartedAt).toBeUndefined();
    expect(next.decision.status).toBe("open");
  });

  it("starting checkout on a finished decision keeps it, and 'not yet' leaves it as it was", () => {
    const bought = run(
      withShortlist(),
      { type: "checkout_started", productId: "p1", variantId: "v1", at: T0 + 1 },
      { type: "checkout_answered", bought: true, at: T0 + 2 },
    );
    const again = sessionReducer(bought, { type: "checkout_started", productId: "p2", variantId: "v2", at: T0 + 3 });
    expect(again.decision).toEqual(bought.decision);
    expect(again.checkoutStartedAt).toBe(T0 + 3);

    const notYet = sessionReducer(again, { type: "checkout_answered", bought: false, at: T0 + 4 });
    expect(notYet.decision).toEqual({ status: "bought", productId: "p1", variantId: "v1", decidedAt: T0 + 2 });
    expect(notYet.checkoutStartedAt).toBeUndefined();
  });

  it("a saved decision stays saved through checkout and 'not yet'", () => {
    const next = run(
      withShortlist(),
      { type: "decided", status: "saved", productId: "p1", variantId: "v1", at: T0 + 1 },
      { type: "checkout_started", productId: "p2", variantId: "v2", at: T0 + 2 },
      { type: "checkout_answered", bought: false, at: T0 + 3 },
    );
    expect(next.decision).toMatchObject({ status: "saved", productId: "p1", variantId: "v1" });
  });

  it("'yes, I bought it' records the product they went to check out", () => {
    const next = run(
      withShortlist(),
      { type: "decided", status: "saved", productId: "p1", variantId: "v1", at: T0 + 1 },
      { type: "checkout_started", productId: "p2", variantId: "v2", at: T0 + 2 },
      { type: "checkout_answered", bought: true, at: T0 + 3 },
    );
    expect(next.decision).toEqual({ status: "bought", productId: "p2", variantId: "v2", decidedAt: T0 + 3 });
  });

  it("a bought decision cannot be turned into saved or declined", () => {
    const bought = run(
      withShortlist(),
      { type: "checkout_started", productId: "p1", variantId: "v1", at: T0 + 1 },
      { type: "checkout_answered", bought: true, at: T0 + 2 },
    );
    expect(sessionReducer(bought, { type: "decided", status: "declined", at: T0 + 3 })).toBe(bought);
    expect(sessionReducer(bought, { type: "decided", status: "saved", productId: "p2", at: T0 + 3 })).toBe(bought);
  });

  it("an answer without a checkout start does nothing", () => {
    const session = withShortlist();
    expect(sessionReducer(session, { type: "checkout_answered", bought: true, at: T0 + 1 })).toBe(session);
  });

  it("not buying records the status and an optional reason, and can reopen", () => {
    const declined = run(
      withShortlist(),
      { type: "decided", status: "declined", at: T0 + 1 },
      { type: "reason_set", reason: "too_expensive", at: T0 + 2 },
    );
    expect(declined.decision).toMatchObject({ status: "declined", reason: "too_expensive", decidedAt: T0 + 1 });
    const reopened = sessionReducer(declined, { type: "reopened", at: T0 + 3 });
    expect(reopened.decision).toEqual({ status: "open" });
  });

  it("stores the confidence check and the outcome", () => {
    const next = run(
      withShortlist(),
      {
        type: "confidence_submitted",
        check: { understandNeeds: true, canExplainTradeoffs: false, confidentInChoice: true, submittedAt: T0 + 1 },
        at: T0 + 1,
      },
      {
        type: "outcome_submitted",
        outcome: {
          satisfied: "partly",
          requirements: [{ itemId: "i1", text: "Fits a 16-inch laptop", met: true }],
          submittedAt: T0 + 2,
        },
        at: T0 + 2,
      },
    );
    expect(next.confidence?.canExplainTradeoffs).toBe(false);
    expect(next.outcome?.satisfied).toBe("partly");
  });
});

describe("messages", () => {
  it("skips a write when the messages did not change", () => {
    const session = { ...withShortlist(), messages: [{ id: "m1", role: "user", parts: [] }] };
    const next = sessionReducer(session, {
      type: "messages_set",
      messages: [{ id: "m1", role: "user", parts: [] }],
      at: T0 + 1,
    });
    expect(next).toBe(session);
  });
});
