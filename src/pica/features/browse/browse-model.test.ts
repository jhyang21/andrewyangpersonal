import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("@/pica/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));

import { getSession } from "@/pica/lib/session";
import { resetStoreForTests } from "@/pica/lib/session/store";
import type { CatalogProduct } from "@/pica/lib/types";
import { startDecision } from "@/pica/features/shared/startDecision";
import {
  PAGE_SIZE,
  askInput,
  browseUrl,
  browseView,
  categoryTap,
  mergePage,
  parseBrowseParams,
  searchBody,
  searchesOnOpen,
  submitSearch,
  toggleCategory,
} from "./browse-model";

function product(id: string): CatalogProduct {
  return { id, title: `Pack ${id}`, seller: { id: "s", name: "North Co", links: [] } } as unknown as CatalogProduct;
}

describe("the address bar", () => {
  it("reads a known category and a query, and ignores the rest", () => {
    expect(parseBrowseParams({ category: "backpack", q: "laptop" })).toEqual({ category: "backpack", query: "laptop" });
    expect(parseBrowseParams({ category: "shoes", q: ["a", "b"] })).toEqual({ category: null, query: "" });
    expect(parseBrowseParams({ q: "x".repeat(300) }).query).toHaveLength(200);
  });

  it("writes the search back, and searches on open only when there is one", () => {
    expect(browseUrl("bag", "tote bag")).toBe("/projects/pica/browse?category=bag&q=tote+bag");
    expect(browseUrl(null, "")).toBe("/projects/pica/browse");
    expect(searchesOnOpen(null, "")).toBe(false);
    expect(searchesOnOpen("luggage", "")).toBe(true);
  });
});

describe("searching", () => {
  it("asks for one page, with the category and cursor only when set", () => {
    expect(searchBody({ query: "laptop", category: null })).toEqual({ query: "laptop", limit: PAGE_SIZE });
    expect(searchBody({ query: "", category: "bag", cursor: "c2" })).toEqual({
      query: "",
      limit: PAGE_SIZE,
      category: "bag",
      cursor: "c2",
    });
  });

  it("a first page replaces the list; Load more adds without repeats", () => {
    const first = mergePage(null, { products: [product("a"), product("b")], nextCursor: "c2" });
    expect(first.products.map((p) => p.id)).toEqual(["a", "b"]);
    const more = mergePage(first, { products: [product("b"), product("c")], nextCursor: null }, "c2");
    expect(more).toEqual({ products: [product("a"), product("b"), product("c")], nextCursor: null });
    const fresh = mergePage(more, { products: [product("z")], nextCursor: null });
    expect(fresh.products.map((p) => p.id)).toEqual(["z"]);
  });

  it("an empty box with no category asks for something to search", () => {
    expect(submitSearch("   ", null)).toEqual({ kind: "hint" });
    expect(submitSearch("  tote ", null)).toEqual({ kind: "search", query: "tote" });
    expect(submitSearch("", "bag")).toEqual({ kind: "search", query: "" });
  });

  it("tapping the chosen category clears it, and the list with it when the box is empty", () => {
    expect(toggleCategory("bag", "bag")).toBeNull();
    expect(toggleCategory("bag", "luggage")).toBe("luggage");
    expect(categoryTap("bag", "bag", "  ")).toEqual({ category: null, query: "", search: false });
    expect(categoryTap("bag", "bag", "tote")).toEqual({ category: null, query: "tote", search: true });
  });

  it("a category tap searches with the words in the box now, trimmed", () => {
    expect(categoryTap(null, "luggage", "  carry-on ")).toEqual({ category: "luggage", query: "carry-on", search: true });
    expect(categoryTap("bag", "backpack", "")).toEqual({ category: "backpack", query: "", search: true });
  });
});

describe("browseView", () => {
  it("shows the prompt before any search", () => {
    expect(browseView({ results: null, loading: false, error: null })).toEqual({
      prompt: true,
      skeleton: false,
      noMatch: false,
      list: false,
    });
  });

  it("shows the skeleton while the first page loads", () => {
    expect(browseView({ results: null, loading: true, error: null }).skeleton).toBe(true);
  });

  it("says no match only when nothing came back and no page is left", () => {
    expect(browseView({ results: { products: [], nextCursor: null }, loading: false, error: null }).noMatch).toBe(true);
    const emptyPage = browseView({ results: { products: [], nextCursor: "c2" }, loading: false, error: null });
    expect(emptyPage).toMatchObject({ noMatch: false, list: true });
  });

  it("shows no prompt over an error", () => {
    expect(browseView({ results: null, loading: false, error: { code: "unknown", message: "x" } }).prompt).toBe(false);
  });
});

describe("Ask Pica about this", () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStoreForTests();
  });

  it("starts a new decision about the product, and sends goal_stated once", () => {
    const pack = product("p1");
    const input = askInput(pack, "backpack");
    expect(input).toEqual({
      text: "I'm looking at Pack p1 from North Co. Is it worth it for me?",
      source: "browse",
      category: "backpack",
      product: pack,
    });
    const id = startDecision(input);
    const session = getSession(id);
    expect(session?.title).toBe("Pack p1");
    expect(session?.products.p1).toEqual(pack);
    expect(session?.canvas.category).toBe("backpack");
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("goal_stated", { source: "browse", category: "backpack", length: input.text.length }, id);
    // A second ask is a second decision.
    expect(startDecision(input)).not.toBe(id);
  });
});
