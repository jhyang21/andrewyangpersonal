/**
 * Per-client limits for the catalog and checkout routes, so one client cannot
 * fill the shared outbound queue (5 calls a second to Shopify) and starve
 * every other buyer and Pica's search tool.
 *
 * A token bucket per client, in memory: a client may send a short burst, then
 * one call per refill period. Memory resets when the server restarts and is
 * not shared between server instances: enough for this MVP.
 *
 * The client key comes from the first `x-forwarded-for` entry. Off a trusted
 * platform the client writes that header itself and can change it on every
 * call; this build assumes no trusted proxy.
 */
import { errorResponse, parseIp } from "./api";
import { rateLimitedMessage, shopifyError } from "./errors";

export interface RouteLimitOptions {
  /** Calls a client may make at once. */
  burst: number;
  /** One call comes back every this many ms. */
  refillMs: number;
  /** Most clients tracked at once, so memory stays bounded. */
  maxTrackedClients: number;
  now?: () => number;
}

export type RouteLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RouteLimiter {
  check(key: string): RouteLimitResult;
  /** Tests only. */
  reset(): void;
  /** Clients tracked now. Tests only. */
  size(): number;
}

interface Bucket {
  tokens: number;
  at: number;
}

export function createRouteLimiter(options: RouteLimitOptions): RouteLimiter {
  const now = options.now ?? (() => Date.now());
  // Map order is least recently used first: each check deletes and re-adds.
  const buckets = new Map<string, Bucket>();

  // A clock that steps back adds nothing (and check() moves the bucket's time back).
  function refill(bucket: Bucket, at: number): number {
    return Math.min(options.burst, bucket.tokens + Math.max(0, at - bucket.at) / options.refillMs);
  }

  /**
   * Make room for one more client. Drop idle clients (full buckets) first:
   * forgetting them changes nothing. Only if none is idle, drop the least
   * recently seen client.
   */
  function makeRoom(at: number): void {
    for (const [key, bucket] of buckets) {
      if (refill(bucket, at) >= options.burst) buckets.delete(key);
    }
    if (buckets.size >= options.maxTrackedClients) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
  }

  return {
    check(key) {
      const at = now();
      const old = buckets.get(key);
      if (old) {
        buckets.delete(key);
        if (old.at > at) old.at = at;
      } else if (buckets.size >= options.maxTrackedClients) {
        makeRoom(at);
      }

      const tokens = old ? refill(old, at) : options.burst;
      // Slack for float rounding: a client that waits the stated time must pass.
      if (tokens >= 1 - 1e-9) {
        buckets.set(key, { tokens: tokens - 1, at });
        return { ok: true };
      }
      // Refused: keep the old tokens and time, so polling does not lose
      // part-tokens to rounding. Only the order moves (most recent last).
      buckets.set(key, old ?? { tokens, at });
      const wait = Math.ceil(((1 - tokens) * options.refillMs) / 1000);
      return { ok: false, retryAfterSeconds: Math.min(Math.ceil(options.refillMs / 1000), Math.max(1, wait)) };
    },
    reset() {
      buckets.clear();
    },
    size() {
      return buckets.size;
    },
  };
}

// "1.2.3.4:5678": an IPv4 address with a port.
const IPV4_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;

/**
 * The client's key from proxy headers. An IPv4 address (a port is dropped,
 * and IPv6 forms that carry IPv4 count as that IPv4) keys as itself; an IPv6
 * address keys on its /64, since one home or phone network usually holds a
 * whole /64. Anything that is not an address shares the key "invalid", which
 * also bounds key length. "unknown" when there is no header.
 */
export function clientKey(headers: Headers): string {
  const raw = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  if (!raw) return "unknown";
  const ip = parseIp(raw.replace(IPV4_PORT, "$1"));
  if (!ip) return "invalid";
  if (ip.kind === "v4") return ip.text;
  return `${ip.hextets.slice(0, 4).map((h) => h.toString(16)).join(":")}::/64`;
}

/**
 * Search and product pages share one budget: 10 calls at once, then one a
 * second. A buyer opens a browse page (one search) or a product (one lookup)
 * at a time, so normal browsing stays well inside it.
 */
export const catalogRouteLimiter = createRouteLimiter({
  burst: 10,
  refillMs: 1_000,
  maxTrackedClients: 5_000,
});

/** Checkout is rarer and each call can reach a merchant: 3 at once, then one every 6 seconds. */
export const checkoutRouteLimiter = createRouteLimiter({
  burst: 3,
  refillMs: 6_000,
  maxTrackedClients: 5_000,
});

/** A 429 `rate_limited` response that states the real wait, when this client is over its limit. Else null. */
export function overLimit(limiter: RouteLimiter, headers: Headers): Response | null {
  const result = limiter.check(clientKey(headers));
  if (result.ok) return null;
  const wait = result.retryAfterSeconds;
  return errorResponse(shopifyError("rate_limited", rateLimitedMessage(wait), wait));
}

/** Tests only. */
export function _resetRouteLimits(): void {
  catalogRouteLimiter.reset();
  checkoutRouteLimiter.reset();
}
