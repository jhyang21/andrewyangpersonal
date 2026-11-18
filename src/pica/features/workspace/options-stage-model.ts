/**
 * The Options stage's rules, without React: its words, what an option card
 * shows closed and behind "More", the stock line, when "Choose this one" is
 * off, and the Compare toggle on each card.
 */
import type { CatalogProduct, DecisionStatus, ShortlistEntry } from "@/pica/lib/types";
import { productStock } from "@/pica/features/shared/format";
import { pickBlocked, type PickLimits } from "./compare-model";
import { VERSION_STOCK_TEXT, optionsText, versionStock } from "./shortlist-model";

export const OPTIONS_STAGE = {
  /** Beside one "Pica's read" tag above the cards, in place of a tag on every line. */
  sourceNote: "The reasons on each card are Pica's. Prices, ratings and stock come from the catalog.",
  fits: "Why it fits you",
  whyNot: "Why you might not want it",
  value: "What the price gets you",
  unverified: "What nobody has checked",
  noFit: "Pica gave no reason here.",
  noWhyNot: "Pica listed no drawback. Ask Pica about the tradeoffs.",
  noneUnverified: "Pica listed nothing here. That does not mean every claim was checked.",
  more: "More",
  less: "Less",
  evidence: "See the evidence",
  compare: "Compare",
  choose: "Choose this one",
  noneFit: "None of these fit",
  emptyTitle: "No options yet",
  emptyBody: "Tell Pica what you need, or ask for products now.",
  emptyAction: "Go to chat",
  allSoldOut: "Sold out in every size and colour the catalog lists, so there is nothing to choose yet.",
} as const;

/** "4 options, in no particular order". */
export function optionsHeadline(count: number): string {
  return `${optionsText(count)}, in no particular order`;
}

/**
 * The card's two lines when closed: the first reason it fits and the first
 * drawback. A missing line says so plainly; the drawback line never hides.
 */
export function cardLines(entry: Pick<ShortlistEntry, "whyItFits" | "whyNot">): { fit: string; whyNot: string } {
  return {
    fit: entry.whyItFits[0] ?? OPTIONS_STAGE.noFit,
    whyNot: entry.whyNot[0] ?? OPTIONS_STAGE.noWhyNot,
  };
}

/**
 * What "More" adds: the other reasons and drawbacks, the value note, and
 * what is not verified. Every card has "More", since an empty "not
 * verified" list still says so.
 */
export interface MoreLines {
  fits: string[];
  whyNot: string[];
  value: string | null;
  unverified: string[];
}

export function moreLines(entry: ShortlistEntry): MoreLines {
  return {
    fits: entry.whyItFits.slice(1),
    whyNot: entry.whyNot.slice(1),
    value: entry.valueNote.trim() ? entry.valueNote : null,
    unverified: entry.unverified,
  };
}

/**
 * True only when the catalog leaves no doubt that every version is sold out.
 * Search fetches just the matched version, so its stock alone never settles
 * this. A value's `available` is told against the current selection, not
 * across the product, so it settles it only when the product has one list:
 * then each value is a whole version. With two or more lists (size and
 * colour), "every colour sold out" may hold for one size only.
 */
export function everyVersionSoldOut(product: CatalogProduct): boolean {
  if (productStock(product) !== "sold_out") return false;
  if (product.options.length === 0) return true;
  if (product.options.length > 1) return false;
  const [only] = product.options;
  return only.values.length > 0 && only.values.every((value) => value.available === false);
}

/**
 * The stock words on a card. Stock is about the version the search matched;
 * when every version is sold out, the card says that instead, and "Choose
 * this one" is off (see `canChoose`).
 */
export function cardStockText(product: CatalogProduct): string {
  if (everyVersionSoldOut(product)) return OPTIONS_STAGE.allSoldOut;
  return VERSION_STOCK_TEXT[versionStock(product)];
}

/**
 * "Choose this one" stays on while any version may be in stock, even when
 * the matched one is sold out: Decide is where the buyer picks a version.
 * It is off only when every version is sold out.
 */
export function canChoose(product: CatalogProduct): boolean {
  return !everyVersionSoldOut(product);
}

/** The Compare toggle on one card or thumbnail. */
export interface PickControl {
  pressed: boolean;
  disabled: boolean;
}

/** Off while Pica replies, and for an unpicked option once the picks are full. */
export function pickControl(picks: readonly string[], productId: string, max: number, locked: boolean): PickControl {
  return { pressed: picks.includes(productId), disabled: locked || pickBlocked(picks, productId, max) };
}

/**
 * The limits in words, with how many are picked. It changes only when the
 * picks do, so a screen can read it out as they change. With fewer options
 * than the least Pica compares, it says there is nothing to compare yet.
 */
export function picksText(count: number, limits: PickLimits, available: number): string {
  const { min, max } = limits;
  if (available < min) {
    return available === 0
      ? "There is nothing to compare yet."
      : `Pica has ${optionsText(available)} so far, so there is nothing to compare yet.`;
  }
  if (count === 0) return `Pick ${min} to ${max} options to compare.`;
  if (count < min) return `${count} picked. Pick at least ${min - count} more to compare.`;
  if (count < max) return `${count} picked to compare. You can pick up to ${max}.`;
  return `${count} picked, the most Pica compares at once. Take one out to pick another.`;
}

/** Shown beside the picks while Pica replies. Kept apart from `picksText` so it is not read out on every send. */
export const PICKS_LOCKED = "You can change your picks once Pica has replied.";

/** "End without buying" shows while the decision is open or saved, as in the header menu. */
export function canEnd(status: DecisionStatus): boolean {
  return status === "open" || status === "saved";
}

/** A stable id piece from a product id, for element ids. */
export function domKey(productId: string): string {
  return productId.replace(/[^\w-]/g, "_");
}
