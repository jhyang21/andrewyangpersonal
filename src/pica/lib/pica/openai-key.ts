/**
 * The visitor's OpenAI key, read per request. Server-only: never import it
 * from a client component.
 *
 * Each visitor keeps their own key in their browser tab, and the browser sends
 * it with every chat request in the `OPENAI_KEY_HEADER` header. The server uses
 * it for that request only: it never stores, logs or sends it back. Pica never
 * reads `OPENAI_API_KEY` from the env, so a key set there is never used.
 */
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { OPENAI_KEY_HEADER, OPENAI_KEY_SHAPE } from "./constants";
import { createRateLimiter } from "./rate-limit";

/** The key in this request's header, trimmed, or null when it is missing or not shaped like a key. */
export function keyFromRequest(request: Request): string | null {
  const key = request.headers.get(OPENAI_KEY_HEADER)?.trim();
  return key && OPENAI_KEY_SHAPE.test(key) ? key : null;
}

/** An OpenAI provider for this key, or null when there is none. */
export function picaProvider(apiKey: string | null): OpenAIProvider | null {
  return apiKey ? createOpenAI({ apiKey }) : null;
}

/** Key checks one client (by IP) may send to `POST /api/setup` in one window. */
export const SETUP_RATE_LIMIT = {
  requests: 10,
  windowMs: 5 * 60 * 1000,
  maxTrackedClients: 1_000,
} as const;

/** The limiter `POST /api/setup` uses. One per server process. */
export const setupRateLimiter = createRateLimiter(SETUP_RATE_LIMIT);
