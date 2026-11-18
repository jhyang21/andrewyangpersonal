import type { Category } from "@/pica/lib/types";

/**
 * Words that already name each category. When the buyer's query has none of
 * them, we add the category word so the catalog stays on topic.
 */
const CATEGORY_WORDS: Record<Category, RegExp> = {
  bag: /\b(bags?|totes?|purses?|handbags?|crossbody|clutch(es)?|satchels?|messengers?|duffels?|duffles?|briefcases?|slings?|hobo)\b/i,
  backpack: /\b(backpacks?|rucksacks?|daypacks?|knapsacks?)\b/i,
  luggage: /\b(luggage|suitcases?|carry[- ]?ons?|roller|spinner|checked)\b/i,
};

const CATEGORY_HINT: Record<Category, string> = {
  bag: "bag",
  backpack: "backpack",
  luggage: "luggage",
};

/**
 * Shopify Standard Product Taxonomy IDs for each category, checked against
 * github.com/Shopify/product-taxonomy (dist/en/categories.txt) on 2026-11-17.
 * Sent as `filters.categories` only when CATEGORY_FILTER_ENABLED is true.
 */
export const CATEGORY_TAXONOMY: Record<Category, string[]> = {
  bag: [
    "gid://shopify/TaxonomyCategory/aa-5-4", // Handbags
    "gid://shopify/TaxonomyCategory/lb-13", // Tote Bags
    "gid://shopify/TaxonomyCategory/lb-11", // Shopping Totes
    "gid://shopify/TaxonomyCategory/lb-10", // Messenger Bags
    "gid://shopify/TaxonomyCategory/lb-2", // Briefcases
    "gid://shopify/TaxonomyCategory/lb-15", // Laptop Bags
    "gid://shopify/TaxonomyCategory/lb-6", // Duffel Bags
  ],
  backpack: [
    "gid://shopify/TaxonomyCategory/lb-1", // Backpacks
    "gid://shopify/TaxonomyCategory/aa-5-4-23", // Backpack Handbags
  ],
  luggage: [
    "gid://shopify/TaxonomyCategory/lb-12", // Suitcases
    "gid://shopify/TaxonomyCategory/lb-6", // Duffel Bags
    "gid://shopify/TaxonomyCategory/lb-8", // Garment Bags
  ],
};

/** Off until a live probe shows the catalog honors the filter without dropping good results. */
export const CATEGORY_FILTER_ENABLED = false;

/** The query we send: the buyer's words, plus the category word when they left it out. */
export function buildQuery(query: string, category?: Category): string {
  const q = query.trim().replace(/\s+/g, " ");
  if (!category) return q;
  if (CATEGORY_WORDS[category].test(q)) return q;
  return q ? `${q} ${CATEGORY_HINT[category]}` : CATEGORY_HINT[category];
}
