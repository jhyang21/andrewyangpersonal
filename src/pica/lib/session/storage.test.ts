import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession } from "./reducer";
import type { DecisionSession } from "@/pica/lib/types";
import { STORAGE_KEY, browserStore, readSessions, trimForSpace, writeSessions, type StorageLike } from "./storage";
import { addSession, dispatch, getSession, getStoreHealth, onStorage, resetStoreForTests } from "./store";

function memoryStore(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const session = createSession({ id: "s1", at: 1, title: "Work backpack" });

describe("readSessions", () => {
  it("reports a missing store as blocked and returns no sessions", () => {
    expect(readSessions(null)).toEqual({ sessions: {}, health: "blocked" });
  });

  it("reports a store that throws on read as blocked", () => {
    const store: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(readSessions(store).health).toBe("blocked");
  });

  it("survives bad JSON", () => {
    const result = readSessions(memoryStore({ [STORAGE_KEY]: "{not json" }));
    expect(result).toEqual({ sessions: {}, health: "ok" });
  });

  it("ignores another version and drops broken sessions", () => {
    expect(readSessions(memoryStore({ [STORAGE_KEY]: JSON.stringify({ version: 2, sessions: {} }) })).sessions).toEqual({});
    const raw = JSON.stringify({ version: 1, sessions: { s1: session, bad: { id: "bad" }, worse: null } });
    expect(Object.keys(readSessions(memoryStore({ [STORAGE_KEY]: raw })).sessions)).toEqual(["s1"]);
  });

  it("reads a canvas saved with the old intent field as the outcome", () => {
    const oldCanvas = { category: session.canvas.category, budget: session.canvas.budget, items: session.canvas.items };
    const old = { ...session, canvas: { ...oldCanvas, intent: { text: "A work backpack", source: "stated" } } };
    const raw = JSON.stringify({ version: 1, sessions: { s1: old, s2: { ...session, id: "s2", canvas: oldCanvas } } });
    const { sessions } = readSessions(memoryStore({ [STORAGE_KEY]: raw }));
    expect(sessions.s1.canvas.outcome).toEqual({ text: "A work backpack", source: "stated" });
    expect("intent" in sessions.s1.canvas).toBe(false);
    expect(sessions.s2.canvas.outcome).toBeNull();
  });

  it("reads back what it wrote", () => {
    const store = memoryStore();
    expect(writeSessions(store, { s1: session })).toBe("ok");
    expect(readSessions(store).sessions.s1).toEqual(session);
  });
});

describe("writeSessions", () => {
  it("reports a missing store as blocked", () => {
    expect(writeSessions(null, { s1: session })).toBe("blocked");
  });

  it("reports a full store", () => {
    const store = memoryStore();
    store.setItem = () => {
      const error = new Error("The quota has been exceeded.");
      error.name = "QuotaExceededError";
      throw error;
    };
    expect(writeSessions(store, { s1: session })).toBe("full");
  });

  it("reports any other write failure as blocked", () => {
    const store = memoryStore();
    store.setItem = () => {
      throw new Error("SecurityError");
    };
    expect(writeSessions(store, { s1: session })).toBe("blocked");
  });
});

describe("full or blocked store in the browser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetStoreForTests();
  });

  function quota(): never {
    const error = new Error("The quota has been exceeded.");
    error.name = "QuotaExceededError";
    throw error;
  }

  it("probes with a read, never a write", () => {
    const setItem = vi.fn(quota);
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem, removeItem: () => {} } });
    expect(browserStore()).not.toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("treats a store that throws on read as blocked", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {},
        removeItem: () => {},
      },
    });
    expect(browserStore()).toBeNull();
  });

  it("keeps unsaved changes in memory when another tab writes", () => {
    const data: Record<string, string> = {};
    let full = false;
    vi.stubGlobal("window", {
      addEventListener: () => {},
      removeEventListener: () => {},
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => (full ? quota() : (data[key] = value)),
        removeItem: (key: string) => delete data[key],
      },
    });
    resetStoreForTests();
    addSession(createSession({ id: "s1", at: 1, title: "Bag" }));
    full = true;
    dispatch("s1", { type: "canvas_edited", edit: { kind: "category", category: "luggage" }, at: 2 });
    expect(getSession("s1")?.canvas.category).toBe("luggage");

    // Another tab saves its own copy; ours could not be saved, so we keep it.
    data[STORAGE_KEY] = JSON.stringify({ version: 1, sessions: {} });
    onStorage({ key: STORAGE_KEY });
    expect(getSession("s1")?.canvas.category).toBe("luggage");
  });

  it("reads the other tab's copy when our saves are working", () => {
    const data: Record<string, string> = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => (data[key] = value),
        removeItem: (key: string) => delete data[key],
      },
    });
    resetStoreForTests();
    addSession(createSession({ id: "s1", at: 1, title: "Bag" }));
    data[STORAGE_KEY] = JSON.stringify({ version: 1, sessions: {} });
    onStorage({ key: STORAGE_KEY });
    expect(getSession("s1")).toBeUndefined();
  });
});

describe("trimForSpace", () => {
  it("keeps the shortlist products and the product the buyer went to check out", () => {
    const products = Object.fromEntries(
      ["p1", "p2", "p3", "p4"].map((id) => [id, { id } as unknown as DecisionSession["products"][string]]),
    );
    const base = createSession({ id: "s1", at: 1, title: "Bag" });
    const session = {
      ...base,
      products,
      shortlist: { entries: [{ productId: "p1" }], note: "", createdAt: 1, stale: false },
      decision: { status: "saved", productId: "p2", decidedAt: 2 },
      checkoutStartedAt: 3,
      checkoutTarget: { productId: "p3", variantId: "v3" },
    } as unknown as DecisionSession;
    expect(Object.keys(trimForSpace({ s1: session }).s1.products).sort()).toEqual(["p1", "p2", "p3"]);
  });
});

describe("save health recovers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetStoreForTests();
  });

  it("clears 'blocked' when a later write works", () => {
    const data: Record<string, string> = {};
    let refuse = true;
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => {
          if (refuse) throw new Error("SecurityError");
          data[key] = value;
        },
        removeItem: (key: string) => delete data[key],
      },
    });
    resetStoreForTests();
    addSession(createSession({ id: "s1", at: 1, title: "Bag" }));
    expect(getStoreHealth()).toBe("blocked");

    refuse = false;
    dispatch("s1", { type: "canvas_edited", edit: { kind: "category", category: "luggage" }, at: 2 });
    expect(getStoreHealth()).toBe("ok");
    expect(readSessions(window.localStorage).sessions.s1.canvas.category).toBe("luggage");
  });
});
