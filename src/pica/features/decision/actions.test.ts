import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("@/pica/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));

import { addSession, createSession, dispatch, getSession } from "@/pica/lib/session";
import { resetStoreForTests } from "@/pica/lib/session/store";
import { endWithoutBuying, recordPurchase, saveForLater } from "./actions";

describe("endWithoutBuying", () => {
  beforeEach(() => {
    const data: Record<string, string> = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => (data[key] = value),
        removeItem: (key: string) => delete data[key],
      },
    });
    resetStoreForTests();
    track.mockClear();
    addSession(createSession({ id: "s1", at: 1, title: "Bag" }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStoreForTests();
  });

  it("fires no_purchase_decided once, with no reason", () => {
    endWithoutBuying("s1", "workspace");
    endWithoutBuying("s1", "decide", "p1");
    expect(getSession("s1")?.decision.status).toBe("declined");
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("no_purchase_decided", { from: "workspace", productId: null }, "s1");
  });

  it("does not count a decline on a bought decision", () => {
    dispatch("s1", { type: "checkout_started", productId: "p1", variantId: "v1", at: 2 });
    recordPurchase("s1");
    track.mockClear();
    endWithoutBuying("s1", "decide", "p1");
    saveForLater("s1", "decide", "p1");
    expect(getSession("s1")?.decision.status).toBe("bought");
    // No event of any kind: not the decline, not a save.
    expect(track).not.toHaveBeenCalled();
  });

  it("fires nothing for a session that does not exist", () => {
    endWithoutBuying("missing", "workspace");
    expect(track).not.toHaveBeenCalled();
  });
});

describe("recordPurchase", () => {
  beforeEach(() => {
    const data: Record<string, string> = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => (data[key] = value),
        removeItem: (key: string) => delete data[key],
      },
    });
    resetStoreForTests();
    track.mockClear();
    addSession(createSession({ id: "s1", at: 1, title: "Bag" }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStoreForTests();
  });

  it("fires purchase_completed once, with the checkout target", () => {
    dispatch("s1", { type: "checkout_started", productId: "p1", variantId: "v1", at: 2 });
    expect(recordPurchase("s1")).toBe(true);
    expect(recordPurchase("s1")).toBe(false);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("purchase_completed", { productId: "p1", variantId: "v1" }, "s1");
  });

  it("fires nothing when no checkout was started", () => {
    expect(recordPurchase("s1")).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });
});
