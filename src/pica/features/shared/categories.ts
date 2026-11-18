/**
 * Each category's words, in one place. Pure.
 */
import type { Category } from "@/pica/lib/types";

/**
 * `many` heads a list or names a filter ("Backpacks"); `one` is a choice in
 * the needs ("Backpack"). Luggage is the same either way.
 */
export const CATEGORY_WORDS: Record<Category, { one: string; many: string }> = {
  bag: { one: "Bag", many: "Bags" },
  backpack: { one: "Backpack", many: "Backpacks" },
  luggage: { one: "Luggage", many: "Luggage" },
};
