import { describe, expect, it } from "vitest";
import { isSession } from "@/pica/lib/session";
import { stockState } from "@/pica/features/shared/format";
import { SEED_ID, seedDecision } from "./fixture";

describe("the seed decision", () => {
  const session = seedDecision(1_700_000_000_000);

  it("is a session the store will load", () => {
    expect(session.id).toBe(SEED_ID);
    expect(isSession(session)).toBe(true);
    expect(session.decision.status).toBe("open");
  });

  it("has needs, a guess to confirm and an open question", () => {
    const items = session.canvas.items;
    expect(items.some((item) => item.kind === "must_have" && item.source === "stated")).toBe(true);
    expect(items.some((item) => item.source === "inferred" && item.kind !== "open_question")).toBe(true);
    expect(items.some((item) => item.kind === "open_question")).toBe(true);
  });

  it("has four options, one sold out and one with unknown stock", () => {
    const products = Object.values(session.products);
    expect(products).toHaveLength(4);
    const soldOut = products.filter((p) => p.variants.every((v) => stockState(v.available) === "sold_out"));
    const unknown = products.filter((p) => p.variants.every((v) => stockState(v.available) === "unknown"));
    expect(soldOut).toHaveLength(1);
    expect(unknown).toHaveLength(1);
  });

  it("has a shortlist of all four with a note, and a comparison", () => {
    expect(session.shortlist?.entries).toHaveLength(4);
    expect(session.shortlist?.note).toBeTruthy();
    expect(session.shortlist?.stale).toBe(false);
    expect(session.comparison?.rows.length).toBeGreaterThan(0);
    for (const id of session.comparison?.productIds ?? []) expect(session.products[id]).toBeDefined();
  });

  it("names only products it holds", () => {
    for (const entry of session.shortlist?.entries ?? []) expect(session.products[entry.productId]).toBeDefined();
  });
});
