/**
 * The options' rules, without React: which cards show, the price and stock
 * lines, and the keys that make a view count once.
 */
import { BASE } from "@/pica/lib/base";
import type { CatalogProduct, DecisionSession, Money, Shortlist, ShortlistEntry } from "@/pica/lib/types";
import { stockState, type StockState } from "@/pica/features/shared/format";

export interface OptionRow {
  entry: ShortlistEntry;
  product: CatalogProduct;
}

/** Shortlist entries with their catalog record, in Pica's order. Entries with no record are left out. */
export function optionRows(session: Pick<DecisionSession, "shortlist" | "products">): OptionRow[] {
  return (session.shortlist?.entries ?? [])
    .map((entry) => ({ entry, product: session.products[entry.productId] }))
    .filter((row): row is OptionRow => Boolean(row.product));
}

/** "4 options", "1 option". */
export function optionsText(count: number): string {
  return `${count} ${count === 1 ? "option" : "options"}`;
}

/**
 * The price a card shows: the matched version's price, plain. `range` is the
 * catalog's range for the second line, set only when other versions cost
 * something else. A list price is never used: no struck-through prices.
 */
export interface PriceLine {
  price: Money;
  range: { min: Money; max: Money } | null;
}

export function priceLine(product: CatalogProduct): PriceLine {
  const { min, max } = product.priceRange;
  const price = product.variants[0]?.price ?? min;
  // A "from–to" line needs two different ends, whatever the matched version costs.
  const single = min.amount === max.amount && min.currency === max.currency;
  return { price, range: single ? null : { min, max } };
}

/**
 * Stock for the version the search matched. A null (the catalog does not say)
 * is "unknown": never guess "in stock".
 */
export function versionStock(product: CatalogProduct): StockState {
  return stockState(product.variants[0]?.available);
}

/** What a card says about the matched version's stock. */
export const VERSION_STOCK_TEXT: Record<StockState, string> = {
  in_stock: "In stock",
  sold_out: "This version is sold out. Other sizes or colours may be in stock.",
  unknown: "Stock not confirmed",
};

/** One `recommendation_viewed` per shortlist per page load. */
export function shortlistViewKey(sessionId: string, shortlist: Shortlist): string {
  return `${sessionId}:${shortlist.createdAt}`;
}

/** The Decide page for one option. */
export function decideHref(sessionId: string, productId: string): string {
  return `${BASE}/d/${sessionId}/decide?product=${encodeURIComponent(productId)}`;
}

/** What "None of these fit" sends to Pica. */
export const NONE_FIT_MESSAGE = "None of these fit me.";
