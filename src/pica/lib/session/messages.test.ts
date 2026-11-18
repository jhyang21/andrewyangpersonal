import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAT_LIMITS } from "@/pica/lib/pica/constants";
import type { CatalogProduct, DecisionSession, Shortlist } from "@/pica/lib/types";
import { CHAT_PRODUCT_LIMIT, buildChatContext } from "./context";
import { compactMessages, hydrateMessages, recentTurns } from "./messages";
import { createSession, sessionReducer } from "./reducer";
import { STORAGE_KEY, readSessions, writeSessions, type StorageLike } from "./storage";
import { addSession, dispatch, getSession, resetStoreForTests, setCanvasLocked } from "./store";

const T0 = 1_700_000_000_000;

/** A record about the size of a real catalog product (about 7 KB). */
function product(id: string, fetchedAt = T0): CatalogProduct {
  return {
    id,
    title: `Product ${id}`,
    descriptionText: "x".repeat(7_000),
    images: [],
    seller: { id: "s", name: "Shop", links: [] },
    priceRange: { min: { amount: 1000, currency: "USD" }, max: { amount: 1000, currency: "USD" } },
    options: [],
    variants: [],
    summarized: { sellingPoints: [], features: [], specs: [] },
    fetchedAt,
  } as unknown as CatalogProduct;
}

function searchMessage(n: number, products: CatalogProduct[]) {
  return {
    id: `a${n}`,
    role: "assistant",
    parts: [
      { type: "text", text: `Search ${n}` },
      {
        type: "tool-search_catalog",
        toolCallId: `call-${n}`,
        state: "output-available",
        input: { query: `query ${n}` },
        output: { products, totalCount: 500 },
      },
    ],
  };
}

/** Six searches of ten products each, with a user turn before each. */
function sixSearches() {
  const messages: unknown[] = [];
  const all: CatalogProduct[] = [];
  for (let n = 0; n < 6; n++) {
    const found = Array.from({ length: 10 }, (_, i) => product(`p${n}-${i}`, T0 + n * 100 + i));
    all.push(...found);
    messages.push({ id: `u${n}`, role: "user", parts: [{ type: "text", text: `Show me more ${n}` }] });
    messages.push(searchMessage(n, found));
  }
  return { messages, all };
}

function bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

describe("compactMessages and hydrateMessages", () => {
  it("keeps only product IDs in stored search results", () => {
    const found = [product("a"), product("b")];
    const [, compact] = compactMessages([{ id: "u", role: "user", parts: [] }, searchMessage(1, found)]) as {
      parts: { output?: { products: unknown[]; productIds?: string[]; totalCount: number } }[];
    }[];
    expect(compact.parts[1].output).toEqual({ products: [], productIds: ["a", "b"], totalCount: 500 });
  });

  it("returns the same array when there is nothing to strip", () => {
    const messages = [{ id: "u", role: "user", parts: [{ type: "text", text: "hi" }] }, searchMessage(1, [])];
    expect(compactMessages(messages)).toBe(messages);
  });

  it("puts the records back, in order, and skips IDs it has no record for", () => {
    const a = product("a");
    const b = product("b");
    const compact = compactMessages([searchMessage(1, [a, b])]);
    const [message] = hydrateMessages(compact, { a }) as { parts: { output?: unknown }[] }[];
    expect(message.parts[1].output).toEqual({ products: [a], totalCount: 500 });
    const [full] = hydrateMessages(compact, { a, b }) as { parts: { output?: unknown }[] }[];
    expect(full.parts[1].output).toEqual({ products: [a, b], totalCount: 500 });
  });
});

describe("messages_set in the reducer", () => {
  it("stores the compact history and keeps each record once, in products", () => {
    const { messages, all } = sixSearches();
    const session = sessionReducer(createSession({ id: "s1", at: T0, title: "Bag" }), {
      type: "messages_set",
      messages,
      at: T0 + 1,
    });
    expect(Object.keys(session.products)).toHaveLength(all.length);
    expect(JSON.stringify(session.messages)).not.toContain("xxxxxxxx");
    // Saving the same full history again is not a change.
    expect(sessionReducer(session, { type: "messages_set", messages, at: T0 + 2 })).toBe(session);
  });

  it("keeps a fresher record over the copy in an old search result", () => {
    const fresh = { ...product("a", T0 + 999), title: "Fresh" };
    const start = { ...createSession({ id: "s1", at: T0, title: "Bag" }), products: { a: fresh } };
    const next = sessionReducer(start, { type: "messages_set", messages: [searchMessage(1, [product("a")])], at: T0 + 1 });
    expect(next.products.a.title).toBe("Fresh");
  });
});

describe("size with six searches", () => {
  const { messages } = sixSearches();
  const shortlist: Shortlist = {
    entries: ["p0-0", "p0-1", "p0-2"].map((productId) => ({
      productId,
      angle: "",
      whyItFits: [],
      whyNot: [],
      valueNote: "",
      unverified: [],
    })),
    note: "",
    createdAt: T0,
    stale: false,
  };
  const session: DecisionSession = {
    ...sessionReducer(createSession({ id: "s1", at: T0, title: "Bag" }), { type: "messages_set", messages, at: T0 + 1 }),
    shortlist,
  };

  it("stores each record once: the history is small and the session well under 1 MB", () => {
    expect(bytes(session.messages)).toBeLessThan(20_000);
    expect(bytes(session)).toBeLessThan(600_000);
    // Saved as they came, the history alone would hold all 60 records again.
    expect(bytes(messages)).toBeGreaterThan(400_000);
  });

  it("builds a chat request within the route's limits", () => {
    const context = buildChatContext(session);
    expect(context.products.length).toBeLessThanOrEqual(CHAT_PRODUCT_LIMIT);
    const history = hydrateMessages(session.messages, session.products);
    expect(bytes(history)).toBeLessThan(CHAT_LIMITS.historyBytes);
    expect(bytes({ messages: history, session: context })).toBeLessThan(CHAT_LIMITS.bodyBytes);
  });

  it("sends the newest products and always the shortlisted ones", () => {
    const many: DecisionSession = { ...session, products: { ...session.products } };
    for (let i = 0; i < 100; i++) many.products[`late-${i}`] = product(`late-${i}`, T0 + 10_000 + i);
    const ids = buildChatContext(many).products.map((p) => p.id);
    expect(ids).toHaveLength(CHAT_PRODUCT_LIMIT);
    expect(ids).toEqual(expect.arrayContaining(["p0-0", "p0-1", "p0-2", "late-99"]));
    expect(ids).not.toContain("late-0");
  });
});

describe("a full store", () => {
  /** A store that refuses any value over `limit` characters, like a browser near its quota. */
  function smallStore(limit: number): StorageLike & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    return {
      data,
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => {
        if (value.length > limit) {
          const error = new Error("The quota has been exceeded.");
          error.name = "QuotaExceededError";
          throw error;
        }
        data[key] = value;
      },
      removeItem: (key) => {
        delete data[key];
      },
    };
  }

  function finished(id: string): DecisionSession {
    const { messages } = sixSearches();
    const base = sessionReducer(createSession({ id, at: T0, title: "Bag" }), { type: "messages_set", messages, at: T0 + 1 });
    return { ...base, decision: { status: "declined", productId: "p0-0", decidedAt: T0 + 2 } };
  }

  it("trims finished decisions to the products they point at, then saves", () => {
    const store = smallStore(150_000);
    const sessions = { a: finished("a"), b: finished("b") };
    expect(writeSessions(store, sessions)).toBe("ok");
    const saved = readSessions(store).sessions;
    expect(Object.keys(saved.a.products)).toEqual(["p0-0"]);
    expect(saved.a.messages).toEqual(sessions.a.messages);
  });

  it("reports full, without throwing, when even the trimmed copy does not fit", () => {
    const store = smallStore(1_000);
    expect(() => writeSessions(store, { a: finished("a") })).not.toThrow();
    expect(writeSessions(store, { a: finished("a") })).toBe("full");
    expect(store.data[STORAGE_KEY]).toBeUndefined();
  });
});

describe("canvas lock in the store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetStoreForTests();
  });

  it("drops buyer canvas edits while Pica replies, and takes them after", () => {
    const data: Record<string, string> = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => {
          data[key] = value;
        },
        removeItem: (key: string) => {
          delete data[key];
        },
      },
    });
    resetStoreForTests();
    addSession(createSession({ id: "s1", at: T0, title: "Bag" }));
    const edit = { type: "canvas_edited", edit: { kind: "category", category: "luggage" }, at: T0 + 1 } as const;

    setCanvasLocked("s1", true);
    expect(dispatch("s1", edit)).toBe(false);
    expect(getSession("s1")?.canvas.category).toBeNull();
    // Pica's own canvas still lands while locked.
    expect(
      dispatch("s1", {
        type: "tool_output_applied",
        toolCallId: "c1",
        tool: "update_canvas",
        output: { canvas: { category: "backpack", outcome: null, budget: null, items: [] } },
        at: T0 + 2,
      }),
    ).toBe(true);

    setCanvasLocked("s1", false);
    expect(dispatch("s1", edit)).toBe(true);
    expect(getSession("s1")?.canvas.category).toBe("luggage");
  });
});

describe("recentTurns", () => {
  const turns = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `m${i}`, role: i % 2 === 0 ? "user" : "assistant" }));

  it("sends a short history as it is", () => {
    const messages = turns(4);
    expect(recentTurns(messages, 10)).toBe(messages);
  });

  it("drops the oldest turns and starts on a buyer message", () => {
    const sent = recentTurns(turns(CHAT_LIMITS.messages + 5), CHAT_LIMITS.messages);
    expect(sent.length).toBeLessThanOrEqual(CHAT_LIMITS.messages);
    expect(sent[0].role).toBe("user");
    expect(sent.at(-1)?.id).toBe(`m${CHAT_LIMITS.messages + 4}`);
  });
});

describe("recentTurns by size", () => {
  const big = (id: string, role: string) => ({ id, role, parts: [{ type: "text", text: "x".repeat(400_000) }] });

  it("drops the oldest turns until the history fits, cutting at a buyer message", () => {
    const messages = [big("u1", "user"), big("a1", "assistant"), big("u2", "user"), big("a2", "assistant"), big("u3", "user")];
    const sent = recentTurns(messages, CHAT_LIMITS.messages, 1_500_000);
    expect(sent.map((m) => m.id)).toEqual(["u2", "a2", "u3"]);
    expect(JSON.stringify(sent).length).toBeLessThan(1_500_000);
  });

  it("keeps the newest turn even when it is over the limit on its own", () => {
    const messages = [big("u1", "user"), big("u2", "user")];
    expect(recentTurns(messages, CHAT_LIMITS.messages, 100_000).map((m) => m.id)).toEqual(["u2"]);
  });
});
