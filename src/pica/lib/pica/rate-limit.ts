/**
 * A small in-memory rate limit for `/api/chat`, keyed by client IP.
 *
 * Fixed windows per client. Memory resets when the server restarts and is not
 * shared between server instances: enough for this local MVP, not for a
 * fleet. The IP comes from proxy headers, which a client can forge when no
 * trusted proxy sets them.
 */
import { CHAT_RATE_LIMIT } from "./constants";

export interface RateLimitOptions {
  requests: number;
  windowMs: number;
  maxTrackedClients: number;
  now?: () => number;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function createRateLimiter(options: RateLimitOptions) {
  const now = options.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();

  /**
   * Drop ended windows first. If none ended, drop the client whose window
   * started first, so memory stays bounded. The map keeps clients in window
   * start order (a new window is set at the end), so the first key is oldest.
   */
  function prune(at: number): void {
    for (const [key, window] of windows) {
      if (at - window.start >= options.windowMs) windows.delete(key);
    }
    if (windows.size >= options.maxTrackedClients) {
      const oldest = windows.keys().next().value;
      if (oldest !== undefined) windows.delete(oldest);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const at = now();
      let window = windows.get(key);
      if (!window || at - window.start >= options.windowMs) {
        // Delete first so the new window moves to the end of the map.
        windows.delete(key);
        if (windows.size >= options.maxTrackedClients) prune(at);
        window = { start: at, count: 0 };
        windows.set(key, window);
      }
      if (window.count >= options.requests) {
        const retryAfterSeconds = Math.max(1, Math.ceil((window.start + options.windowMs - at) / 1000));
        return { ok: false, retryAfterSeconds };
      }
      window.count++;
      return { ok: true };
    },
    /** Tracked clients, for tests. */
    size: () => windows.size,
    /** Forget every client. For tests. */
    reset: () => windows.clear(),
  };
}

/** The client's IP from proxy headers, or "unknown". */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** The limiter `/api/chat` uses. One per server process. */
export const chatRateLimiter = createRateLimiter(CHAT_RATE_LIMIT);
