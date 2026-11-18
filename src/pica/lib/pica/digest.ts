/**
 * The compact view of a catalog product that the model reads.
 *
 * The client gets full `CatalogProduct` records. The model gets this digest:
 * enough to judge fit, with no URLs, images or checkout links, and with
 * Shopify's generated summary marked as such.
 */
import type { CatalogProduct, Money } from "@/pica/lib/types";
import { DIGEST_DESCRIPTION_CHARS } from "./constants";
import { stripLinks } from "./text-guard";

export type ProductDigest = {
  id: string;
  title: string;
  seller: string;
  /** Whole or decimal dollars, e.g. "$129" or "$129–$149". For reasoning only. */
  price: string;
  options: { name: string; values: string[] }[];
  rating: string | null;
  merchantDescription: string;
  shopifySummary: {
    note: string;
    sellingPoints: string[];
    features: string[];
    specs: string[];
  };
};

export const SHOPIFY_SUMMARY_NOTE =
  "Shopify generated this from the listing. It is not merchant text.";

function dollars(money: Money): string {
  const value = money.amount / 100;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return money.currency === "USD" ? `$${text}` : `${text} ${money.currency}`;
}

function priceText(product: CatalogProduct): string {
  const { min, max } = product.priceRange;
  if (min.amount === max.amount) return dollars(min);
  return `${dollars(min)}–${dollars(max)}`;
}

function trimText(text: string, limit: number): string {
  const clean = stripLinks(text);
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Longest Shopify summary line the model sees. */
const SUMMARY_LINE_CHARS = 200;

function cleanList(items: string[] | undefined): string[] {
  return (items ?? []).map((item) => trimText(item, SUMMARY_LINE_CHARS)).filter((item) => item.length > 0);
}

export function digestProduct(product: CatalogProduct): ProductDigest {
  return {
    id: product.id,
    title: product.title,
    seller: product.seller?.name ?? "Unknown seller",
    price: priceText(product),
    options: (product.options ?? []).map((option) => ({
      name: option.name,
      values: option.values.map((value) => value.label),
    })),
    rating: product.rating
      ? `${product.rating.value} of ${product.rating.scaleMax} from ${product.rating.count} reviews`
      : null,
    merchantDescription: trimText(product.descriptionText ?? "", DIGEST_DESCRIPTION_CHARS),
    shopifySummary: {
      note: SHOPIFY_SUMMARY_NOTE,
      sellingPoints: cleanList(product.summarized?.sellingPoints),
      features: cleanList(product.summarized?.features),
      specs: cleanList(product.summarized?.specs),
    },
  };
}

/**
 * Merchant text made safe for one line of the prompt: no line breaks or other
 * control characters, no hidden format characters, no angle brackets (so it
 * can't close a data block), and no more than `max` characters.
 */
export function listingText(text: string, max: number): string {
  // Control and format characters, line and paragraph separators, angle brackets and the column bar.
  const flat = text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>|]+/gu, " ").replace(/\s{2,}/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Longest title and seller name in a prompt line. */
const LINE_TITLE_CHARS = 120;
const LINE_SELLER_CHARS = 60;

/** One-line view for the system prompt's list of known products. */
export function productLine(product: CatalogProduct): string {
  return [
    listingText(product.id, LINE_TITLE_CHARS),
    listingText(product.title, LINE_TITLE_CHARS),
    listingText(product.seller?.name ?? "Unknown seller", LINE_SELLER_CHARS),
    priceText(product),
  ].join(" | ");
}
