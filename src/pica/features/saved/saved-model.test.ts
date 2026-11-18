import { describe, expect, it } from "vitest";
import { createSession, sessionReducer } from "@/pica/lib/session";
import type { CatalogProduct, DecisionSession, DecisionStatus } from "@/pica/lib/types";
import { askCardId, groupSessions, savedCard } from "./saved-model";

const pack = { id: "p1", title: "Day pack", seller: { id: "s", name: "North Co", links: [] }, variants: [] } as unknown as CatalogProduct;

function session(id: string, status: DecisionStatus, updatedAt: number): DecisionSession {
  const base = createSession({ id, at: 1, title: id, products: [pack] });
  let decided = base;
  if (status === "saved" || status === "declined") {
    decided = sessionReducer(base, { type: "decided", status, productId: "p1", at: 2 });
  } else if (status === "bought") {
    const started = sessionReducer(base, { type: "checkout_started", productId: "p1", variantId: "v", at: 2 });
    decided = sessionReducer(started, { type: "checkout_answered", bought: true, at: 3 });
  }
  return { ...decided, updatedAt };
}

function byId(...list: DecisionSession[]): Record<string, DecisionSession> {
  return Object.fromEntries(list.map((s) => [s.id, s]));
}

describe("groupSessions", () => {
  it("groups as Open, Saved for later, Bought, Not buying, newest first, and leaves out empty groups", () => {
    const groups = groupSessions(
      byId(session("a", "declined", 10), session("b", "open", 20), session("c", "open", 30), session("d", "bought", 5)),
    );
    expect(groups.map((g) => [g.status, g.sessions.map((s) => s.id)])).toEqual([
      ["open", ["c", "b"]],
      ["bought", ["d"]],
      ["declined", ["a"]],
    ]);
  });

  it("is empty with no decisions", () => {
    expect(groupSessions({})).toEqual([]);
  });
});

describe("askCardId", () => {
  const start = (s: DecisionSession, at: number) =>
    sessionReducer(s, { type: "checkout_started", productId: "p1", variantId: "v", at });

  it("picks the newest unanswered checkout, so only one card asks", () => {
    const older = start(session("old", "open", 1), 100);
    const newer = start(session("new", "saved", 1), 200);
    expect(askCardId(byId(older, newer, session("x", "open", 300)))).toBe("new");
  });

  it("skips answered checkouts, and is null when none wait", () => {
    const answered = sessionReducer(start(session("a", "open", 1), 500), { type: "checkout_answered", bought: false, at: 600 });
    const waiting = start(session("b", "open", 1), 100);
    expect(askCardId(byId(answered, waiting))).toBe("b");
    expect(askCardId(byId(answered))).toBeNull();
  });
});

describe("savedCard", () => {
  it("open and saved decisions resume; closed ones open", () => {
    expect(savedCard(session("a", "open", 1)).resumable).toBe(true);
    expect(savedCard(session("a", "saved", 1)).resumable).toBe(true);
    expect(savedCard(session("a", "declined", 1)).resumable).toBe(false);
  });

  it("bought decisions get a check-in, and say when it was saved", () => {
    const bought = session("a", "bought", 1);
    expect(savedCard(bought)).toMatchObject({ canCheckIn: true, checkInSavedAt: null, product: pack });
    const withOutcome = { ...bought, outcome: { satisfied: "yes" as const, requirements: [], submittedAt: 77 } };
    expect(savedCard(withOutcome).checkInSavedAt).toBe(77);
    expect(savedCard(session("b", "saved", 1)).canCheckIn).toBe(false);
  });

  it("shows the product taken to checkout when none is decided", () => {
    const started = sessionReducer(session("a", "open", 1), {
      type: "checkout_started",
      productId: "p1",
      variantId: "v",
      at: 2,
    });
    expect(savedCard(started).product).toBe(pack);
    expect(savedCard(session("b", "open", 1)).shortlistCount).toBeNull();
  });
});
