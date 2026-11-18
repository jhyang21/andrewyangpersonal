import type { ApiError, ApiErrorCode } from "@/pica/lib/types";

/** Thrown by every function in the Shopify layer. `error.message` is buyer-facing. */
export class ShopifyError extends Error {
  readonly error: ApiError;
  constructor(error: ApiError) {
    super(error.message);
    this.name = "ShopifyError";
    this.error = error;
  }
}

/**
 * Buyer-facing sentences, in Shop's voice: what happened, then what to do.
 * No codes, no "invalid", no "oops" (DESIGN.md section 7).
 */
export const MESSAGES = {
  bad_request: "We couldn't read that request. Refresh the page and try again.",
  not_found: "We couldn't find that product in the catalog. It may have been removed, so try another one.",
  variant_unavailable: "That option has sold out. Pick another option or another product.",
  variant_gone: "That option isn't in the catalog anymore. Pick another option or another product.",
  variant_not_usd: "That option isn't sold in US dollars. Pick another option or another product.",
  rate_limited: "The catalog is busy right now. Try again in a few seconds.",
  catalog_unavailable: "We couldn't reach the Shopify catalog. Try again in a minute.",
  checkout_unavailable:
    "We couldn't start checkout for this item. Try again in a minute, or pick another product.",
  checkout_unconfirmed:
    "We couldn't confirm this item is still in stock. Try again in a minute.",
  // Our fault, so say sorry first (DESIGN.md section 7, "Serious problem").
  unknown: "Sorry, something went wrong on our side. Try again in a minute.",
} as const;

/**
 * For a buyer over their own per-client limit: the catalog is fine, but they send
 * calls faster than we allow. States the real wait.
 */
export function rateLimitedMessage(seconds: number): string {
  return `You're going a little fast. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`;
}

export function shopifyError(
  code: ApiErrorCode,
  message?: string,
  retryAfterSeconds?: number,
): ShopifyError {
  const fallback = code in MESSAGES ? MESSAGES[code as keyof typeof MESSAGES] : MESSAGES.unknown;
  const error: ApiError = { code, message: message ?? fallback };
  if (retryAfterSeconds !== undefined) error.retryAfterSeconds = retryAfterSeconds;
  return new ShopifyError(error);
}

/** HTTP status for each error code, used by the API routes. */
export function statusForCode(code: ApiErrorCode): number {
  switch (code) {
    case "bad_request":
      return 400;
    case "not_found":
      return 404;
    case "variant_unavailable":
      return 409;
    case "rate_limited":
      return 429;
    case "catalog_unavailable":
    case "checkout_unavailable":
    case "model_unavailable":
      return 503;
    case "missing_key":
    case "unknown":
    default:
      return 500;
  }
}

/**
 * Turn any thrown value into a ShopifyError. Unknown errors get a generic
 * message for the buyer and a server log line with the error's name, plus
 * `cause.code` (such as ECONNRESET) when it is a short plain code. Never the
 * message: it can hold a URL, token or request body.
 */
export function toShopifyError(err: unknown): ShopifyError {
  if (err instanceof ShopifyError) return err;
  const name = err instanceof Error ? err.name : typeof err;
  const code = causeCode(err);
  console.error(`[shopify] unexpected error: ${name}${code ? ` (cause ${code})` : ""}`);
  return shopifyError("unknown");
}

function causeCode(err: unknown): string | undefined {
  if (!(err instanceof Error) || typeof err.cause !== "object" || err.cause === null) return undefined;
  const code: unknown = (err.cause as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,40}$/.test(code) ? code : undefined;
}
