/**
 * The evidence sheet's content, without React: its sections in order, and the
 * four tags that say where a claim comes from. The same words and icons show
 * everywhere in the app.
 */
import type { CatalogProduct, EvidenceBasis, ShortlistEntry } from "@/pica/lib/types";
import { FEW_REVIEWS, listingUrl, reviewLinks } from "./format";

/** Lucide icon names. The kit maps each name to its icon. */
export type EvidenceIcon = "Store" | "FileText" | "Feather" | "CircleDashed";

export const EVIDENCE_TAGS: Record<EvidenceBasis, { label: string; icon: EvidenceIcon }> = {
  merchant: { label: "Merchant says", icon: "Store" },
  catalog_summary: { label: "From the listing", icon: "FileText" },
  inference: { label: "Pica's read", icon: "Feather" },
  missing: { label: "Not verified", icon: "CircleDashed" },
};

/** Catalog facts (price, stock, rating) carry this note and no tag. */
export const CATALOG_NOTE = "From the catalog";

export const EVIDENCE_TITLE = "Where this comes from";

/**
 * True when the catalog's rating rests on some reviews, but fewer than the
 * threshold. No rating, or one on no reviews, is not "few": nothing shows.
 */
export function hasFewReviews(rating: CatalogProduct["rating"] | null): boolean {
  return rating != null && rating.count > 0 && rating.count < FEW_REVIEWS;
}

/** The rating to show: none when the catalog has none or it rests on no reviews. */
function shownRating(rating: CatalogProduct["rating"] | null): CatalogProduct["rating"] | null {
  return rating != null && rating.count > 0 ? rating : null;
}

export interface EvidenceSheetModel {
  title: string;
  description: string;
  merchant: {
    tag: "merchant";
    /** The merchant's own description, or null when there is none. */
    text: string | null;
    empty: string;
    link: { url: string; label: string } | null;
  };
  summary: { tag: "catalog_summary"; heading: string; items: string[]; empty: string };
  rating: {
    rating: CatalogProduct["rating"] | null;
    note: string | null;
    empty: string;
    catalogNote: string;
  };
  /** Pica's read on this option. Null when the product is not on the shortlist. */
  picaRead: { tag: "inference"; whyItFits: string[]; whyNot: string[]; valueNote: string } | null;
  unverified: { tag: "missing"; items: string[]; empty: string };
  reviews: {
    heading: string;
    note: string;
    links: ReturnType<typeof reviewLinks>;
  };
}

/** The sheet for one product, in the brief's order. */
export function evidenceSheet(product: CatalogProduct, entry: ShortlistEntry | null): EvidenceSheetModel {
  const url = listingUrl(product);
  const { sellingPoints, features, specs } = product.summarized;
  const rating = shownRating(product.rating ?? null);
  return {
    title: EVIDENCE_TITLE,
    description: `${product.title} from ${product.seller.name}`,
    merchant: {
      tag: "merchant",
      text: product.descriptionText.trim() ? product.descriptionText : null,
      empty: "The merchant gives no description.",
      link: url ? { url, label: `See it on ${product.seller.name}` } : null,
    },
    summary: {
      tag: "catalog_summary",
      heading: "From the listing, summarized by Shopify",
      items: [...sellingPoints, ...features, ...specs],
      empty: "Shopify has no summary for this listing.",
    },
    rating: {
      rating,
      note: hasFewReviews(rating) ? "Few reviews so far" : null,
      empty: "The catalog has no rating for this product.",
      catalogNote: CATALOG_NOTE,
    },
    picaRead: entry
      ? { tag: "inference", whyItFits: entry.whyItFits, whyNot: entry.whyNot, valueNote: entry.valueNote }
      : null,
    unverified: {
      tag: "missing",
      items: entry?.unverified ?? [],
      empty: "Pica listed nothing here. That does not mean every claim was checked.",
    },
    reviews: {
      heading: "Look for independent reviews",
      note: "These links open other sites. Pica does not check what they say.",
      links: reviewLinks(product),
    },
  };
}
