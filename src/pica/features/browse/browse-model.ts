/**
 * Browse (brief 6.9): the search, its pages, the address bar, and "Ask Pica
 * about this". Pure.
 */
import { BASE } from "@/pica/lib/base";
import {
  CATEGORIES,
  type ApiError,
  type CatalogProduct,
  type CatalogSearchParams,
  type Category,
} from "@/pica/lib/types";
import type { StartInput } from "@/pica/features/shared/startDecision";

export const PAGE_SIZE = 10;
/** Longest search the page takes from the address bar or the box. */
export const QUERY_MAX = 200;

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export type SearchInput = { query: string; category: Category | null; cursor?: string | null };

export type Results = {
  products: CatalogProduct[];
  nextCursor: string | null;
};

/** The search in the address bar. Anything not a known category or a single string is ignored. */
export function parseBrowseParams(params: { category?: string | string[]; q?: string | string[] }): {
  category: Category | null;
  query: string;
} {
  return {
    category: isCategory(params.category) ? params.category : null,
    query: typeof params.q === "string" ? params.q.slice(0, QUERY_MAX) : "",
  };
}

/** A category or a query in the address bar starts a search on open. */
export function searchesOnOpen(category: Category | null, query: string): boolean {
  return Boolean(category || query);
}

export function searchBody(input: SearchInput): CatalogSearchParams {
  return {
    query: input.query,
    limit: PAGE_SIZE,
    ...(input.category ? { category: input.category } : {}),
    ...(input.cursor ? { cursor: input.cursor } : {}),
  };
}

/** A first page replaces the list; a later page adds to it, skipping products already shown. */
export function mergePage(current: Results | null, page: Results, cursor?: string | null): Results {
  if (!cursor || !current) return { products: page.products, nextCursor: page.nextCursor };
  const seen = new Set(current.products.map((product) => product.id));
  return {
    products: [...current.products, ...page.products.filter((product) => !seen.has(product.id))],
    nextCursor: page.nextCursor,
  };
}

/** The address for a search, so a reload or a shared link shows the same one. */
export function browseUrl(category: Category | null, query: string): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `${BASE}/browse?${search}` : `${BASE}/browse`;
}

/** Tapping the chosen category again clears it. */
export function toggleCategory(current: Category | null, next: Category): Category | null {
  return current === next ? null : next;
}

/**
 * A category tap searches with the words in the box now, not the last search
 * sent, so typing then tapping a category finds what the buyer sees. With no
 * category left and an empty box, the list clears instead.
 */
export function categoryTap(
  current: Category | null,
  next: Category,
  text: string,
): { category: Category | null; query: string; search: boolean } {
  const category = toggleCategory(current, next);
  const query = text.trim();
  return { category, query, search: Boolean(category || query) };
}

/** What Search does with the box: search for the trimmed text, or ask for something to search. */
export function submitSearch(text: string, category: Category | null): { kind: "hint" } | { kind: "search"; query: string } {
  const query = text.trim();
  if (!query && !category) return { kind: "hint" };
  return { kind: "search", query };
}

/** "Ask Pica about this": a new decision about this product, in the buyer's voice. */
export function askInput(product: CatalogProduct, category: Category | null): StartInput {
  return {
    text: `I'm looking at ${product.title} from ${product.seller.name}. Is it worth it for me?`,
    source: "browse",
    category,
    product,
  };
}

export interface BrowseView {
  /** Nothing searched yet. */
  prompt: boolean;
  /** First page loading. */
  skeleton: boolean;
  /** The search found nothing, and there are no more pages. */
  noMatch: boolean;
  /** The results list, which may be an empty page with more to load. */
  list: boolean;
}

export function browseView(state: { results: Results | null; loading: boolean; error: ApiError | null }): BrowseView {
  const { results, loading, error } = state;
  const count = results?.products.length ?? 0;
  return {
    prompt: !results && !loading && !error,
    skeleton: loading && count === 0,
    noMatch: Boolean(results && count === 0 && !results.nextCursor && !loading && !error),
    list: Boolean(results && (count > 0 || results.nextCursor)),
  };
}
