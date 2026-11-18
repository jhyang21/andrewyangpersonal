/**
 * Product ID checks for `present_shortlist` and `compare_products`.
 *
 * Pica may only name products that came from the catalog: either the
 * session's known products or what `search_catalog` found in this request.
 */
import type { CatalogProduct } from "@/pica/lib/types";

export type KnownProducts = Map<string, CatalogProduct>;

export function knownProductsFrom(products: CatalogProduct[]): KnownProducts {
  const map: KnownProducts = new Map();
  for (const product of products) {
    if (product && typeof product.id === "string") map.set(product.id, product);
  }
  return map;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sellerKey(product: CatalogProduct): string {
  return (product.seller?.id || product.seller?.name || "").toLowerCase();
}

/**
 * Two listings that would look like one choice to the buyer: same seller and
 * same title once case and punctuation are ignored.
 */
export function nearIdentical(a: CatalogProduct, b: CatalogProduct): boolean {
  const seller = sellerKey(a);
  return seller !== "" && seller === sellerKey(b) && normalizeTitle(a.title) === normalizeTitle(b.title);
}

export interface IdCheckOptions {
  /** Also reject pairs that are the same product in all but ID. */
  rejectNearIdentical: boolean;
}

/**
 * Returns one line per problem, written for the model. Empty means all IDs
 * are known, unique and (when asked) different enough.
 */
export function checkProductIds(
  ids: string[],
  known: KnownProducts,
  options: IdCheckOptions,
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      problems.push(`${id} appears more than once. Use each product once.`);
      continue;
    }
    seen.add(id);
    if (!known.has(id)) {
      problems.push(
        `${id} is not a product from the catalog. Use only IDs that search_catalog returned or that the session lists.`,
      );
    }
  }

  if (options.rejectNearIdentical) {
    const products = [...seen].map((id) => known.get(id)).filter((p): p is CatalogProduct => !!p);
    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        if (nearIdentical(products[i], products[j])) {
          problems.push(
            `${products[i].id} and ${products[j].id} are the same product from the same seller. Keep one and pick a different option.`,
          );
        }
      }
    }
  }

  return problems;
}
