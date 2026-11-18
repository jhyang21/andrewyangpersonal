import { describe, expect, it } from "vitest";
import { createSession, sessionReducer } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import { groupSessions } from "./saved-model";
import {
  GROUPS,
  SAVED,
  SAVED_HEADING_ID,
  cardProduct,
  checkInSavedStatus,
  focusAfterRemoval,
  menuLabel,
  savedTitleId,
} from "./saved-screen-model";

function plain(id: string, updatedAt: number, status: "open" | "saved" | "declined" = "open"): DecisionSession {
  const base = { ...createSession({ id, at: 1, title: `Decision ${id}` }), updatedAt };
  if (status === "open") return base;
  return { ...sessionReducer(base, { type: "decided", status, at: 2 }), updatedAt };
}

function byId(...list: DecisionSession[]): Record<string, DecisionSession> {
  return Object.fromEntries(list.map((s) => [s.id, s]));
}

describe("cardProduct", () => {
  it("is the first option when none is chosen", () => {
    expect(cardProduct(seedDecision(1))?.title).toBe("Commuter Pack 24L");
  });

  it("is the chosen product once there is one", () => {
    const seed = seedDecision(1);
    const travel = Object.values(seed.products).find((p) => p.title === "Travel Pack 30L")!;
    const saved = sessionReducer(seed, { type: "decided", status: "saved", productId: travel.id, at: 5 });
    expect(cardProduct(saved)?.title).toBe("Travel Pack 30L");
  });

  it("is none with no options", () => {
    expect(cardProduct(plain("a", 1))).toBeUndefined();
  });
});

describe("focusAfterRemoval", () => {
  // Shown as: Open a (30), c (10); Saved for later b (20); Not buying d (5).
  const groups = groupSessions(byId(plain("a", 30), plain("b", 20, "saved"), plain("c", 10), plain("d", 5, "declined")));

  it("goes to the next card's title in page order, across groups", () => {
    expect(focusAfterRemoval(groups, "a")).toBe(savedTitleId("c"));
    expect(focusAfterRemoval(groups, "c")).toBe(savedTitleId("b"));
  });

  it("goes to the card before when the last one goes", () => {
    expect(focusAfterRemoval(groups, "d")).toBe(savedTitleId("b"));
  });

  it("goes to the page heading when no card is left", () => {
    expect(focusAfterRemoval(groupSessions(byId(plain("a", 1))), "a")).toBe(SAVED_HEADING_ID);
  });
});

describe("Saved words", () => {
  it("names each card's menu for its card", () => {
    expect(menuLabel("A work backpack")).toBe("More for A work backpack");
  });

  it("says which check-in was saved", () => {
    expect(checkInSavedStatus("A work backpack")).toBe("Check-in saved for A work backpack.");
  });

  it("uses the brief's group names and Bought line, with no counts", () => {
    expect(Object.values(GROUPS).map((g) => g.title)).toEqual(["Open", "Saved for later", "Bought", "Not buying"]);
    expect(GROUPS.bought.note).toBe("Pica can't see your orders. The merchant's email has your order status.");
    expect(SAVED.line).toBe("Decisions are saved in this browser only.");
  });

  it("never says we, and never names the old product", () => {
    const words = JSON.stringify({ SAVED, GROUPS });
    expect(words).not.toMatch(/\bwe\b/i);
    expect(words).not.toContain("Shop Companion");
  });
});
