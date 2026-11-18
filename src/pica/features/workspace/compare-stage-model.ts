/**
 * The Compare stage's rules, without React: its words, the ask button's
 * label, and when the table has room.
 */
import type { CatalogProduct, DecisionSession } from "@/pica/lib/types";
import type { ComparisonState, PickLimits } from "./compare-model";

export const COMPARE_STAGE = {
  title: "Compare",
  emptyTitle: "Nothing to compare yet",
  emptyBody: "Once Pica has options, pick two to five here to set side by side.",
  emptyAction: "Go to chat",
  noComparisonTitle: "No comparison yet",
  pickHeading: "Options to compare",
  picksChanged: "This comparison covers different options",
  needsChanged: "This comparison reflects your earlier needs",
  needsChangedBody: "Ask Pica to compare these options again with your needs as they are now.",
  update: "Update comparison",
  tableHeading: "Pica's comparison",
  catalogGroup: "From the catalog",
  picaGroup: "Pica's notes on your needs",
  detail: "Detail",
  price: "Price",
  stock: "Stock",
  rating: "Rating",
  noRating: "No rating yet",
  noCell: "Pica wrote nothing here.",
  seeListing: "See the listing",
  actions: "Next steps",
  takeaway: "The main tradeoff",
} as const;

/** The ask button names the count once there are enough picks: "Compare these 3". */
export function compareButtonText(count: number, min: number): string {
  return count >= min ? `Compare these ${count}` : "Compare these options";
}

/**
 * What the "covers different options" banner tells the buyer to do. It holds
 * no count, so it stays the same as picks change: the banner is a status
 * line, and the picks line above already says the count.
 */
export function picksChangedBody(limits: PickLimits): string {
  return `Pick ${limits.min} to ${limits.max} options above and compare them to replace this one.`;
}

/**
 * The one caution Compare shows over its table, if any. Picks that differ
 * come first: asking again answers them, and a new comparison uses the needs
 * as they are now. The shortlist's own banner stays on Options.
 */
export type CompareCaution = "picks_changed" | "needs_changed" | null;

export function compareCaution(state: ComparisonState): CompareCaution {
  if (state.picksChanged) return "picks_changed";
  if (state.needsChanged) return "needs_changed";
  return null;
}

/**
 * What shows in the table's place when there is no table and no ask from
 * here is running.
 * - `lost`: a comparison exists but fewer than `min` of its products are
 *   still in the list. A plain line says so.
 * - `none`: fewer options than `min`; the picks line already says there is
 *   nothing to compare, so nothing more shows.
 * - `empty`: the "No comparison yet" state and how to get one.
 */
export type ComparisonGap = { kind: "lost"; text: string } | { kind: "none" } | { kind: "empty"; text: string };

export function comparisonGap(input: {
  hasComparison: boolean;
  comparedCount: number;
  candidateCount: number;
  limits: PickLimits;
}): ComparisonGap {
  const { min, max } = input.limits;
  if (input.hasComparison && input.comparedCount < min) {
    return {
      kind: "lost",
      text: `Pica's comparison cannot show: fewer than ${min} of the options it compared are still in your list.`,
    };
  }
  if (input.candidateCount < min) return { kind: "none" };
  return { kind: "empty", text: `Pick ${min} to ${max} options above, then ask Pica to compare them.` };
}

/** The picked products the session holds, in pick order. */
export function pickedProducts(session: Pick<DecisionSession, "products">, picks: readonly string[]): CatalogProduct[] {
  return picks.map((id) => session.products[id]).filter((product): product is CatalogProduct => Boolean(product));
}

/** Width of the table's label column, and the narrowest a product column may be (brief 6.4). */
export const LABEL_COLUMN_PX = 128;
export const MIN_COLUMN_PX = 160;

/** The stage width at which the table fits `count` columns of at least 160px. */
export function tableMinWidth(count: number): number {
  return LABEL_COLUMN_PX + count * MIN_COLUMN_PX;
}

/**
 * Container-query classes that show the table only from `tableMinWidth`,
 * and the stacked cards below it. Written out in full so Tailwind finds
 * them. Counts outside two to five get the stacked cards only.
 */
const TABLE_CLASSES: Record<number, { table: string; stack: string }> = {
  2: { table: "hidden @min-[448px]:block", stack: "@min-[448px]:hidden" },
  3: { table: "hidden @min-[608px]:block", stack: "@min-[608px]:hidden" },
  4: { table: "hidden @min-[768px]:block", stack: "@min-[768px]:hidden" },
  5: { table: "hidden @min-[928px]:block", stack: "@min-[928px]:hidden" },
};

export function layoutClasses(count: number): { table: string; stack: string } {
  return TABLE_CLASSES[count] ?? { table: "hidden", stack: "" };
}
