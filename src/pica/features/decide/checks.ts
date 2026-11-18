import type { CatalogProduct } from "@/pica/lib/types";
import { STALE_AFTER_MS } from "@/pica/features/shared/format";

export type Selected = { name: string; label: string }[];

/**
 * True when the product came back with the options the buyer chose. The
 * product route answers a choice it cannot match with another variant (or
 * none), never with an error, so the screen has to compare.
 */
export function matchesSelection(product: CatalogProduct, selection: Selected | undefined): boolean {
  if (!selection || selection.length === 0) return true;
  const variant = product.variants[0];
  if (!variant) return false;
  return selection.every((chosen) =>
    variant.options.some((option) => option.name === chosen.name && option.label === chosen.label),
  );
}

/** The same choices, in any order. No choice and an empty choice are the same. */
export function sameSelection(a: Selected | undefined, b: Selected | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((chosen) => right.some((option) => option.name === chosen.name && option.label === chosen.label));
}

/**
 * What the decide screen does with a product it just loaded for `selection`.
 * - "matched": show it.
 * - "revert": a new choice has no variant. Keep the last good product and go
 *   back to its choice, and say so.
 * - "gone": the choice that failed is the one already shown (first load, a
 *   recheck, or the page shown again), so there is nothing to go back to. Show
 *   what the catalog returned, take its options as the choice, and say the
 *   earlier choice is gone.
 */
export type AfterLoad =
  | { kind: "matched" }
  | { kind: "revert"; to: Selected | undefined }
  | { kind: "gone"; to: Selected | undefined };

export function afterLoad(
  product: CatalogProduct,
  selection: Selected | undefined,
  lastGood: { selected: Selected | undefined } | null,
): AfterLoad {
  if (matchesSelection(product, selection)) return { kind: "matched" };
  if (lastGood && !sameSelection(lastGood.selected, selection)) return { kind: "revert", to: lastGood.selected };
  const options = product.variants[0]?.options;
  return { kind: "gone", to: options && options.length > 0 ? options : undefined };
}

/** A load newer than this, by the buyer's own clock, is not checked again. */
export const RECHECK_GAP_MS = 60_000;

/** The longest the server may have held a price before this screen loaded it. */
export const SERVER_HOLD_MS = 5 * 60_000;

/**
 * Whether to fetch price and stock again before checkout. `fetchedAt` is the
 * server's time for the record; `loadedAt` is when this screen loaded it, by
 * the buyer's clock. A load under a minute old is never checked again. When
 * the two clocks agree (the gap between them is no more than the server may
 * have held the record), age is counted from `fetchedAt`. When they do not,
 * the buyer's clock is off: age is counted on that clock alone, plus the
 * longest the server may have held the record, so a fast clock cannot loop.
 */
export function needsRecheck(fetchedAt: number, at: number, loadedAt: number | null): boolean {
  if (loadedAt === null || at < loadedAt) return at - fetchedAt > STALE_AFTER_MS;
  if (at - loadedAt < RECHECK_GAP_MS) return false;
  const held = loadedAt - fetchedAt;
  if (held >= 0 && held <= SERVER_HOLD_MS) return at - fetchedAt > STALE_AFTER_MS;
  return at - loadedAt + SERVER_HOLD_MS > STALE_AFTER_MS;
}
