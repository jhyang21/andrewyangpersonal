/**
 * Browse's words, and what the hidden status line says. Pure.
 */
import type { BrowseView, Results } from "./browse-model";

export const BROWSE = {
  heading: "Browse",
  intro: "Products from Shopify merchants. Ask Pica about any of them.",
  categories: "Category",
  searchLabel: "Search products",
  searchPlaceholder: "Such as a waterproof laptop backpack",
  search: "Search",
  hint: "Type what you're looking for, or pick a category.",
  promptTitle: "Pick a category or search",
  promptLine: "Bags, backpacks and luggage from Shopify merchants.",
  noMatchTitle: "No products match",
  noMatchLine: "Try another search or category.",
  askInstead: "Ask Pica instead",
  emptyPage: "This page had no products Pica can show. Load more to keep looking.",
  ask: "Ask Pica about this",
  loadMore: "Load more",
  loading: "Loading products",
} as const;

/** "10 products shown", "1 product shown", or a page with none to show. */
export function shownText(count: number): string {
  if (count === 0) return "Nothing on this page";
  return `${count} ${count === 1 ? "product" : "products"} shown`;
}

/**
 * The polite status line. Silent until the buyer acts, so nothing is read
 * out as the page opens. Errors speak through their own alert.
 */
export function browseStatus(state: {
  acted: boolean;
  loading: boolean;
  hasError: boolean;
  results: Results | null;
  view: BrowseView;
}): string {
  const { acted, loading, hasError, results, view } = state;
  if (!acted || hasError) return "";
  if (loading) return BROWSE.loading;
  if (view.noMatch) return BROWSE.noMatchTitle;
  return results ? shownText(results.products.length) : "";
}

/**
 * Where focus goes once "Load more" finishes: the first new product, or the
 * list's heading when the button went away with nothing new. Null leaves
 * focus on the button, which is still there.
 */
export function focusAfterLoadMore(before: number, after: number, hasMore: boolean): number | "heading" | null {
  if (after > before) return before;
  return hasMore ? null : "heading";
}

/** A new search (Search, a category, or the page opening on one), or "Load more". */
export type LoadKind = "search" | "more";

/** The control that spins: Search for a search, "Load more" for more. */
export function busyControl(loading: boolean, kind: LoadKind): LoadKind | null {
  return loading ? kind : null;
}

/** A load the buyer started that should move focus when it ends. */
export interface PendingFocus {
  kind: LoadKind;
  /** Started by "Try again", whose button is gone while it runs. */
  retry: boolean;
  /** Products shown when it started. */
  before: number;
}

/**
 * - a product's index: its heading;
 * - "heading": the results heading;
 * - "box": the search box, when the search found nothing;
 * - "retry": "Try again", back after another failure;
 * - "more": the "Load more" button;
 * - null: leave focus where it is.
 */
export type FocusTarget = number | "heading" | "box" | "retry" | "more" | null;

/**
 * Where focus goes once a load ends. "Load more" moves on to the first new
 * product. "Try again" has left the page body holding focus, so a retry
 * always lands somewhere: the results heading for a search (the box when
 * nothing matched), the first new product for more, or "Try again" if it
 * failed again. A search from the box or a category leaves focus there.
 */
export function focusAfterLoad(
  pending: PendingFocus,
  done: { failed: boolean; after: number; hasMore: boolean; noMatch: boolean },
): FocusTarget {
  if (done.failed) return pending.retry ? "retry" : null;
  if (pending.kind === "more") {
    const target = focusAfterLoadMore(pending.before, done.after, done.hasMore);
    return target === null && pending.retry ? "more" : target;
  }
  if (!pending.retry) return null;
  return done.noMatch ? "box" : "heading";
}
