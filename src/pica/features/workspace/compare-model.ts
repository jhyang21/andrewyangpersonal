/**
 * The comparison's rules, without React: picks, limits, when to ask, whether
 * the table is out of date, and what each cell's evidence tag is.
 */
import { COMPARE_MAX, COMPARE_MIN } from "@/pica/lib/pica/constants";
import type { CatalogProduct, Comparison, ComparisonCell, DecisionSession, EvidenceBasis, Shortlist } from "@/pica/lib/types";
import { listingUrl } from "@/pica/features/shared/format";

/** Two to five options: the server's own limits. */
export const COMPARE_LIMITS = { min: COMPARE_MIN, max: COMPARE_MAX } as const;

export interface PickLimits {
  min: number;
  max: number;
}

/** Compare picks that are still on the current shortlist, in pick order. */
export function livePicks(picks: readonly string[], shortlist: Shortlist | null): string[] {
  if (!shortlist) return [];
  const onList = new Set(shortlist.entries.map((entry) => entry.productId));
  const seen = new Set<string>();
  return picks.filter((id) => {
    if (!onList.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Add or remove one pick. Products off the shortlist drop out first, so they never fill a slot. */
export function togglePick(picks: readonly string[], productId: string, shortlist: Shortlist | null, max: number): string[] {
  const live = livePicks(picks, shortlist);
  if (live.includes(productId)) return live.filter((id) => id !== productId);
  if (live.length >= max || livePicks([productId], shortlist).length === 0) return live;
  return [...live, productId];
}

/**
 * `togglePick`, except that locked picks stay as they are. Picks lock while
 * Pica replies, as the canvas does: a comparison that lands resets the picks
 * to its products, so a change made during the reply would be undone.
 */
export function togglePickUnlessLocked(
  picks: readonly string[],
  productId: string,
  shortlist: Shortlist | null,
  max: number,
  locked: boolean,
): readonly string[] {
  return locked ? picks : togglePick(picks, productId, shortlist, max);
}

/** True when this product can't be picked: it isn't picked and the picks are full. */
export function pickBlocked(picks: readonly string[], productId: string, max: number): boolean {
  return !picks.includes(productId) && picks.length >= max;
}

/** The ask button works with two to the most picks, and not while Pica replies. */
export function canAskCompare(pickCount: number, busy: boolean, limits: PickLimits): boolean {
  return pickCount >= limits.min && pickCount <= limits.max && !busy;
}

/** The message the ask button sends. */
export function compareRequestText(products: readonly CatalogProduct[]): string {
  const names = products.map((product) => `${product.title} (${product.seller.name})`);
  return `Compare these for me: ${names.join("; ")}.`;
}

/** The comparison's products that the session holds, in the comparison's order. */
export function comparedProducts(session: Pick<DecisionSession, "comparison" | "products">): CatalogProduct[] {
  if (!session.comparison) return [];
  return session.comparison.productIds
    .map((id) => session.products[id])
    .filter((product): product is CatalogProduct => Boolean(product));
}

/** Shortlist products the buyer can pick from, in Pica's order. */
export function pickCandidates(session: Pick<DecisionSession, "shortlist" | "products">): CatalogProduct[] {
  return (session.shortlist?.entries ?? [])
    .map((entry) => session.products[entry.productId])
    .filter((product): product is CatalogProduct => Boolean(product));
}

/**
 * Why a comparison may no longer match.
 * - `needsChanged`: the buyer changed the needs after it was made.
 * - `picksChanged`: the picks now differ from the products it covers.
 */
export interface ComparisonState {
  needsChanged: boolean;
  picksChanged: boolean;
}

export function comparisonState(comparison: Comparison, picks: readonly string[]): ComparisonState {
  const covered = new Set(comparison.productIds);
  const same = picks.length === covered.size && picks.every((id) => covered.has(id));
  return { needsChanged: comparison.stale, picksChanged: picks.length > 0 && !same };
}

/**
 * Which ask Compare offers (brief 6.6: one ask at a time).
 * - `stage`: "Compare these N". No table is on screen, or the picks differ
 *   from it.
 * - `banner`: the picks match an out-of-date table, so its banner's
 *   "Update comparison" is the ask.
 * - `null`: the picks match a current table; a press would ask for the
 *   table already on screen.
 * No picks at all count as matching, as in `comparisonState`.
 */
export type CompareAsk = "stage" | "banner" | null;

export function compareAsk(comparison: Comparison | null, tableShown: boolean, picks: readonly string[]): CompareAsk {
  if (!comparison || !tableShown) return "stage";
  const state = comparisonState(comparison, picks);
  if (state.picksChanged) return "stage";
  return state.needsChanged ? "banner" : null;
}

/** A table needs at least the fewest products a comparison may hold. */
export function canShowTable(comparison: Comparison | null, comparedCount: number, min: number): boolean {
  return comparison !== null && comparedCount >= min;
}

/**
 * The tag a cell shows, and its quote. "Merchant says" and "From the listing"
 * hold only with a checked quote; without one, the note is Pica's read,
 * whatever the basis says.
 */
export function cellEvidence(
  cell: ComparisonCell,
  product: CatalogProduct,
): { tag: EvidenceBasis; quote: string | null; url: string | null } {
  const quoted = Boolean(cell.quote) && (cell.basis === "merchant" || cell.basis === "catalog_summary");
  if (quoted) return { tag: cell.basis, quote: cell.quote ?? null, url: listingUrl(product) };
  return { tag: cell.basis === "missing" ? "missing" : "inference", quote: null, url: null };
}

/** A row's cell for one product, if Pica wrote one. */
export function cellFor(cells: readonly ComparisonCell[], productId: string): ComparisonCell | null {
  return cells.find((cell) => cell.productId === productId) ?? null;
}

/** One `comparison_viewed` per comparison per page load. */
export function comparisonViewKey(sessionId: string, comparison: Comparison): string {
  return `${sessionId}:${comparison.createdAt}`;
}
