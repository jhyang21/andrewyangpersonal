/** Settings for the Shopify layer. Env values are read on each call so tests can change them. */

export const CATALOG_ENDPOINT = "https://catalog.shopify.com/api/ucp/mcp";
export const TOKEN_ENDPOINT = "https://api.shopify.com/auth/access_token";

const DEFAULT_PROFILE_URL =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";

/** Buyer context sent with every catalog call. The app serves US buyers in USD. */
export const BUYER_CONTEXT = {
  address_country: "US",
  currency: "USD",
  language: "en",
} as const;

export const CURRENCY = "USD";

/** Timeouts in ms. */
export const CATALOG_TIMEOUT_MS = 10_000;
export const CHECKOUT_TIMEOUT_MS = 15_000;
export const TOKEN_TIMEOUT_MS = 10_000;

/**
 * Longest a call waits in our own rate-limit queue, in ms. Past this we answer
 * `rate_limited` at once rather than hold the buyer.
 */
export const MAX_QUEUE_WAIT_MS = 3_000;

/** Longest Retry-After we wait out inside one request, in seconds. */
export const MAX_RETRY_WAIT_SECONDS = 5;

/**
 * Cache life for anything that holds price or stock. Shopify allows 15 minutes
 * for price and stock; the app's own rule is 10. We keep 5 to stay well inside.
 */
export const PRICE_CACHE_TTL_MS = 5 * 60_000;

/** Refresh the access token this long before it expires. */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

export function agentProfileUrl(): string {
  const fromEnv = process.env.UCP_AGENT_PROFILE_URL?.trim();
  return fromEnv ? fromEnv : DEFAULT_PROFILE_URL;
}

export function ucpMeta() {
  return { "ucp-agent": { profile: agentProfileUrl() } };
}

export function catalogCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.SHOPIFY_CATALOG_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CATALOG_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
