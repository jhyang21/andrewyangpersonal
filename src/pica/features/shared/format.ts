import type { CatalogProduct, CatalogVariant } from "@/pica/lib/types";

/** The time now. Call it from event handlers and effects, never during render. */
export function now(): number {
  return Date.now();
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type StockState = "in_stock" | "sold_out" | "unknown";

export function stockState(available: boolean | null | undefined): StockState {
  if (available === true) return "in_stock";
  if (available === false) return "sold_out";
  return "unknown";
}

/** Stock for a whole product: in stock if any variant says so. */
export function productStock(product: CatalogProduct): StockState {
  const states = product.variants.map((variant) => variant.available);
  if (states.includes(true)) return "in_stock";
  if (states.length > 0 && states.every((state) => state === false)) return "sold_out";
  return "unknown";
}

const POLICY_LABELS: Record<string, string> = {
  refund_policy: "Refund policy",
  return_policy: "Return policy",
  shipping_policy: "Shipping policy",
  privacy_policy: "Privacy policy",
  terms_of_service: "Terms of service",
  subscription_policy: "Subscription policy",
  contact_information: "Contact details",
  legal_notice: "Legal notice",
};

export function policyLabel(type: string): string {
  if (POLICY_LABELS[type]) return POLICY_LABELS[type];
  const words = type.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Store policy";
}

/** Refund and shipping first: they matter most before paying. */
export function sortedPolicyLinks(links: CatalogProduct["seller"]["links"]) {
  const order = ["refund_policy", "return_policy", "shipping_policy", "terms_of_service", "privacy_policy"];
  return [...links]
    .filter((link) => /^https:\/\//.test(link.url))
    .sort((a, b) => {
      const ai = order.indexOf(a.type);
      const bi = order.indexOf(b.type);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** The first photo, or the variant's own. */
export function productImage(product: CatalogProduct, variant?: CatalogVariant) {
  return variant?.image ?? product.images[0] ?? null;
}

/** Search links for independent reviews. We link out; we never fetch these pages. */
export function reviewLinks(product: CatalogProduct) {
  const query = `${product.title} ${product.seller.name} review`;
  const q = encodeURIComponent(query);
  return [
    { site: "web", label: "Search the web", url: `https://www.google.com/search?q=${q}` },
    { site: "reddit", label: "Search Reddit", url: `https://www.reddit.com/search/?q=${q}` },
    { site: "youtube", label: "Search YouTube", url: `https://www.youtube.com/results?search_query=${q}` },
  ] as const;
}

/** Price and stock go stale after 10 minutes (Shopify's rule, see `CatalogProduct.fetchedAt`). */
export const STALE_AFTER_MS = 10 * 60_000;

/** "Checked 2:14 PM", with the date when it was not today. Pure: `today` comes from the caller. */
export function checkedText(fetchedAt: number, today: number): string {
  const at = new Date(fetchedAt);
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (at.toDateString() === new Date(today).toDateString()) return `Checked ${time}`;
  return `Checked ${at.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

/** The merchant's page for this product, when the catalog gives a safe link. */
export function listingUrl(product: CatalogProduct): string | null {
  const url = product.variants.find((variant) => variant.url)?.url ?? product.seller.url;
  return url && /^https:\/\//.test(url) ? url : null;
}

/** A rating on fewer reviews than this gets a "few reviews" note. */
export const FEW_REVIEWS = 20;
