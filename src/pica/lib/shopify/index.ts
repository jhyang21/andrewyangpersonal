/**
 * Public surface of the Shopify layer. Server-only: it reads secrets from env
 * and calls Shopify directly. Never import it from a client component.
 *
 * - searchCatalog / getProduct: Shopify Global Catalog MCP (keyless, or with a
 *   bearer token when Dev Dashboard credentials are set).
 * - createCheckout: re-checks the variant, then tries the merchant's Checkout
 *   MCP (`create_checkout`), and falls back to the catalog's direct checkout
 *   link. We never call `complete_checkout`: the buyer finishes at the merchant.
 */
import type {
  CatalogProduct,
  CatalogSearchParams,
  CatalogSearchResult,
  CatalogVariant,
  CheckoutRequest,
  CheckoutResponse,
  CheckoutTotals,
  Money,
} from "@/pica/lib/types";
import { getAccessToken, rejectAccessToken } from "./auth";
import { TtlCache } from "./cache";
import { CATEGORY_FILTER_ENABLED, CATEGORY_TAXONOMY, buildQuery } from "./category";
import {
  BUYER_CONTEXT,
  CATALOG_ENDPOINT,
  CATALOG_TIMEOUT_MS,
  CHECKOUT_TIMEOUT_MS,
  CURRENCY,
  PRICE_CACHE_TTL_MS,
  ucpMeta,
} from "./config";
import { MESSAGES, ShopifyError, shopifyError } from "./errors";
import { httpsUrl, normalizeProduct, normalizeProducts, normalizeVariant } from "./normalize";
import { ToolCallError, UnauthorizedError, callTool, isRecord } from "./transport";

export { ShopifyError } from "./errors";

if (typeof window !== "undefined") {
  throw new Error("The Shopify layer is server-only. Call it through /api routes.");
}

const MAX_LIMIT = 10;
const MAX_QUANTITY = 10;
const PRODUCT_ID = /^gid:\/\/shopify\/p\/[A-Za-z0-9]+$/;
const VARIANT_ID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const MYSHOPIFY_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

const searchCache = new TtlCache<CatalogSearchResult>(PRICE_CACHE_TTL_MS);
const productCache = new TtlCache<CatalogProduct>(PRICE_CACHE_TTL_MS);

/** Tests only. */
export function _clearCaches(): void {
  searchCache.clear();
  productCache.clear();
}

/**
 * Call the Global Catalog, with our token when we have one. The catalog also
 * works keyless, so a 401 on our token drops it and retries once without it.
 */
async function callCatalog(tool: string, catalog: Record<string, unknown>) {
  const call = (headers: Record<string, string>) =>
    callTool({
      endpoint: CATALOG_ENDPOINT,
      tool,
      args: { meta: ucpMeta(), catalog },
      timeoutMs: CATALOG_TIMEOUT_MS,
      headers,
    });

  const token = await getAccessToken();
  if (!token) return call({});
  try {
    return await call({ Authorization: `Bearer ${token}` });
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err;
    console.warn(`[shopify] ${tool}: token refused; retrying keyless`);
    rejectAccessToken(token);
    return call({});
  }
}

/* ------------------------------ search ------------------------------ */

/** Build the `catalog` argument for `search_catalog`. Exported for tests. */
export function buildSearchArgs(params: CatalogSearchParams): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    available: true,
    ships_to: { country: BUYER_CONTEXT.address_country },
  };
  const price: Record<string, number> = {};
  if (params.minPriceUsd !== undefined) price.min = Math.round(params.minPriceUsd * 100);
  if (params.maxPriceUsd !== undefined) price.max = Math.round(params.maxPriceUsd * 100);
  if (Object.keys(price).length > 0) filters.price = price;
  if (CATEGORY_FILTER_ENABLED && params.category) {
    filters.categories = CATEGORY_TAXONOMY[params.category];
  }

  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(params.limit ?? MAX_LIMIT)));
  const pagination: Record<string, unknown> = { limit };
  if (params.cursor) pagination.cursor = params.cursor;

  return {
    query: buildQuery(params.query, params.category),
    context: { ...BUYER_CONTEXT },
    filters,
    pagination,
  };
}

/** Search the Global Catalog. Returns USD products that ship to the US. */
export async function searchCatalog(params: CatalogSearchParams): Promise<CatalogSearchResult> {
  const catalog = buildSearchArgs(params);
  if (!catalog.query) throw shopifyError("bad_request", "Tell us what you're looking for, then search again.");

  const key = JSON.stringify(catalog);
  const hit = searchCache.get(key);
  if (hit) return hit;

  let content: Record<string, unknown>;
  try {
    content = await callCatalog("search_catalog", catalog);
  } catch (err) {
    throw err instanceof ToolCallError ? shopifyError("catalog_unavailable") : err;
  }

  const fetchedAt = Date.now();
  const products = normalizeProducts(content.products, fetchedAt).filter((p) =>
    priceInRange(p, params.minPriceUsd, params.maxPriceUsd),
  );
  const pagination = isRecord(content.pagination) ? content.pagination : {};
  const totalCount =
    typeof pagination.total_count === "number" && Number.isFinite(pagination.total_count)
      ? pagination.total_count
      : null;
  const nextCursor =
    pagination.has_next_page === true && typeof pagination.cursor === "string" && pagination.cursor
      ? pagination.cursor
      : null;

  const result: CatalogSearchResult = { products, totalCount, nextCursor };
  searchCache.set(key, result);
  return result;
}

/** The catalog filters on price already; this guards against a stray record outside the range. */
function priceInRange(p: CatalogProduct, minUsd?: number, maxUsd?: number): boolean {
  const variantPrice = p.variants[0]?.price.amount ?? p.priceRange.min.amount;
  if (minUsd !== undefined && variantPrice < Math.round(minUsd * 100)) return false;
  if (maxUsd !== undefined && variantPrice > Math.round(maxUsd * 100)) return false;
  return true;
}

/* ------------------------------ product ------------------------------ */

/**
 * Fetch one product with full option availability. Pass `selected` to get a
 * specific variant, e.g. `[{ name: "Color", label: "Navy Blue" }]`.
 */
export async function getProduct(
  id: string,
  selected?: { name: string; label: string }[],
): Promise<CatalogProduct> {
  if (!PRODUCT_ID.test(id)) throw shopifyError("bad_request");

  const catalog: Record<string, unknown> = { id, context: { ...BUYER_CONTEXT } };
  if (selected && selected.length > 0) catalog.selected = selected;

  const key = JSON.stringify(catalog);
  const hit = productCache.get(key);
  if (hit) return hit;

  let content: Record<string, unknown>;
  try {
    content = await callCatalog("get_product", catalog);
  } catch (err) {
    if (err instanceof ToolCallError) {
      throw /not\s*found|no product|does not exist/i.test(err.text)
        ? shopifyError("not_found")
        : shopifyError("catalog_unavailable");
    }
    throw err;
  }

  const product = normalizeProduct(content.product, Date.now());
  if (!product) throw shopifyError("not_found");
  productCache.set(key, product);
  return product;
}

/* ------------------------------ checkout ------------------------------ */

type FreshVariant =
  | { found: false; reason: "missing" | "not_usd" }
  | {
      found: true;
      variant: CatalogVariant;
      sellerDomain?: string;
      /** The parent product's ID, when the lookup gives one in the usual form. */
      productId?: string;
    };

/** Re-read one variant from the catalog, skipping the cache. */
async function fetchVariant(variantId: string): Promise<FreshVariant> {
  let content: Record<string, unknown>;
  try {
    content = await callCatalog("lookup_catalog", {
      ids: [variantId],
      context: { ...BUYER_CONTEXT },
    });
  } catch (err) {
    if (err instanceof ToolCallError) throw shopifyError("checkout_unavailable", MESSAGES.checkout_unconfirmed);
    if (err instanceof ShopifyError && err.error.code === "rate_limited") throw err;
    throw shopifyError("checkout_unavailable", MESSAGES.checkout_unconfirmed);
  }

  const products = Array.isArray(content.products) ? content.products : [];
  for (const p of products) {
    if (!isRecord(p) || !Array.isArray(p.variants)) continue;
    for (const raw of p.variants) {
      if (!isRecord(raw) || raw.id !== variantId) continue;
      // The ID matched, so a variant that fails to normalize has no USD price.
      const variant = normalizeVariant(raw);
      if (!variant) return { found: false, reason: "not_usd" };
      const seller = isRecord(raw.seller) ? raw.seller : {};
      const domain = typeof seller.domain === "string" ? seller.domain : undefined;
      const productId = typeof p.id === "string" && PRODUCT_ID.test(p.id) ? p.id : undefined;
      return { found: true, variant, sellerDomain: domain, productId };
    }
  }
  return { found: false, reason: "missing" };
}

/** Create a checkout for one variant, or fall back to the direct link. */
export async function createCheckout(
  request: CheckoutRequest,
  buyerIp: string | null,
): Promise<CheckoutResponse> {
  if (
    !PRODUCT_ID.test(request.productId) ||
    !VARIANT_ID.test(request.variantId) ||
    !Number.isInteger(request.quantity) ||
    request.quantity < 1 ||
    request.quantity > MAX_QUANTITY
  ) {
    throw shopifyError("bad_request");
  }

  // 1. Confirm the variant still exists and is in stock. Null availability
  //    means the catalog does not say; the merchant checks at checkout.
  const fresh = await fetchVariant(request.variantId);
  if (!fresh.found) {
    throw shopifyError("variant_unavailable", MESSAGES[fresh.reason === "not_usd" ? "variant_not_usd" : "variant_gone"]);
  }
  // The variant must belong to the product the buyer chose. When the lookup
  // gives no product ID we cannot check, and the variant ID alone decides.
  if (fresh.productId && fresh.productId !== request.productId) throw shopifyError("bad_request");
  if (fresh.variant.available === false) throw shopifyError("variant_unavailable");

  // Only the fresh catalog record names the merchant and the link. The copies
  // in the request (`sellerDomain`, `checkoutUrl`) are never read: a crafted
  // request could point the buyer, or our Shopify token, at a site of its choosing.
  const directUrl = httpsUrl(fresh.variant.checkoutUrl);
  const domain = fresh.sellerDomain;

  // 2. Try a UCP checkout when we have a token, a merchant domain and the buyer's IP.
  const token = await getAccessToken();
  if (token && domain && MYSHOPIFY_DOMAIN.test(domain) && buyerIp) {
    const ucp = await tryUcpCheckout(domain, token, buyerIp, request);
    if (ucp) return ucp;
  }

  // 3. Fall back to the catalog's direct checkout link, byte-for-byte. The
  //    link has quantity 1 built in (`/buy/<variant>:1`), so say 1 here.
  if (directUrl) return { mode: "direct", continueUrl: directUrl, quantity: 1 };
  throw shopifyError("checkout_unavailable");
}

async function tryUcpCheckout(
  domain: string,
  token: string,
  buyerIp: string,
  request: CheckoutRequest,
): Promise<CheckoutResponse | null> {
  try {
    const content = await callTool({
      endpoint: `https://${domain}/api/ucp/mcp`,
      tool: "create_checkout",
      args: {
        meta: ucpMeta(),
        checkout: {
          currency: CURRENCY,
          line_items: [{ quantity: request.quantity, item: { id: request.variantId } }],
        },
      },
      timeoutMs: CHECKOUT_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${token}`, "Shopify-Buyer-IP": buyerIp },
      // Shopify says not to retry inside a checkout lifecycle without an
      // idempotency key, so a 429 here falls back to the direct link.
      retryOn429: false,
    });
    return parseUcpCheckout(content, request.quantity);
  } catch {
    console.warn("[shopify] create_checkout failed; using the direct checkout link");
    return null;
  }
}

/**
 * Map a `create_checkout` result to CheckoutResponse. `quantity` is what we
 * asked the merchant for; the merchant's line item wins when it states one,
 * since the merchant may cap it. Null when the result is unusable. Exported
 * for tests.
 */
export function parseUcpCheckout(
  content: Record<string, unknown>,
  quantity: number,
): CheckoutResponse | null {
  if (content.status === "canceled" || content.status === "completed") return null;
  const continueUrl = httpsUrl(content.continue_url);
  if (!continueUrl) return null;

  const out: CheckoutResponse = { mode: "ucp", continueUrl, quantity: lineItemQuantity(content) ?? quantity };
  const currency = typeof content.currency === "string" ? content.currency : CURRENCY;
  const totals = parseTotals(content.totals, currency);
  if (totals) out.totals = totals;
  if (typeof content.expires_at === "string") out.expiresAt = content.expires_at;
  return out;
}

/** The first line item's quantity, when it is a positive whole number. We send one line item. */
function lineItemQuantity(content: Record<string, unknown>): number | undefined {
  if (!Array.isArray(content.line_items)) return undefined;
  const first: unknown = content.line_items[0];
  if (!isRecord(first)) return undefined;
  const q = first.quantity;
  return typeof q === "number" && Number.isInteger(q) && q > 0 ? q : undefined;
}

function parseTotals(value: unknown, currency: string): CheckoutTotals | undefined {
  if (!Array.isArray(value)) return undefined;
  const byType = new Map<string, Money>();
  for (const t of value) {
    if (!isRecord(t) || typeof t.type !== "string") continue;
    if (typeof t.amount !== "number" || !Number.isInteger(t.amount)) continue;
    byType.set(t.type, { amount: t.amount, currency });
  }
  const subtotal = byType.get("subtotal");
  const total = byType.get("total");
  if (!subtotal || !total) return undefined;
  const totals: CheckoutTotals = { subtotal, total };
  const shipping = byType.get("fulfillment") ?? byType.get("shipping");
  if (shipping) totals.shipping = shipping;
  const tax = byType.get("tax");
  if (tax) totals.tax = tax;
  return totals;
}
