/**
 * The buyer's choice of size, colour and the like on Decide. Pure.
 *
 * A "choice" here is one value of one product option, as the brief uses the
 * word (section 8): never an option on the shortlist.
 */
import { checkoutTargetOf } from "@/pica/lib/session";
import type { CatalogProduct, CatalogVariant, DecisionSession } from "@/pica/lib/types";
import { stockState, type StockState } from "@/pica/features/shared/format";
import type { Selected } from "./checks";

export type { Selected } from "./checks";

/**
 * The choice Decide opens with: the one taken to checkout, then the one
 * decided on, then the first variant in stock, then the first variant.
 * Undefined when that variant has no options to choose.
 */
export function initialSelection(session: DecisionSession, productId: string): Selected | undefined {
  const stored = session.products[productId];
  // The options the buyer took to checkout come first, so the page they return to shows them.
  const chosen = checkoutTargetOf(session);
  if (chosen.productId === productId && chosen.options && chosen.options.length > 0) return chosen.options;
  const variant =
    (session.decision.productId === productId && session.decision.variantId
      ? stored?.variants.find((candidate) => candidate.id === session.decision.variantId)
      : undefined) ??
    stored?.variants.find((candidate) => candidate.available !== false) ??
    stored?.variants[0];
  return variant && variant.options.length > 0 ? variant.options : undefined;
}

/**
 * The selection after the buyer picks `label` for option `name`. Starts from
 * the shown variant's options, so the other choices stay as shown.
 */
export function nextSelection(
  shown: CatalogVariant,
  selected: Selected | undefined,
  name: string,
  label: string,
): Selected {
  const base = shown.options.length > 0 ? shown.options : (selected ?? []);
  return base.some((option) => option.name === name)
    ? base.map((option) => (option.name === name ? { name, label } : option))
    : [...base, { name, label }];
}

export interface ChoiceValue {
  label: string;
  /** The catalog says this value is sold out. Unknown (null) is not sold out. */
  soldOut: boolean;
  selected: boolean;
}

export interface ChoiceGroup {
  name: string;
  /** The shown variant's value for this option, if it has one. */
  current: string | undefined;
  /** Only one value exists: nothing to choose, show it as a fact. */
  fixed: boolean;
  values: ChoiceValue[];
}

/** One group per product option, marking the shown variant's value and the sold-out ones. */
export function choiceGroups(product: CatalogProduct, shown: CatalogVariant | undefined): ChoiceGroup[] {
  return product.options.map((option) => {
    const current = shown?.options.find((candidate) => candidate.name === option.name)?.label;
    return {
      name: option.name,
      current,
      fixed: option.values.length === 1,
      values: option.values.map((value) => ({
        label: value.label,
        soldOut: value.available === false,
        selected: value.label === current,
      })),
    };
  });
}

/** Stock of the shown variant. No variant, or a null from the catalog, is "unknown": never guess. */
export function shownStock(shown: CatalogVariant | undefined): StockState {
  return stockState(shown?.available);
}
