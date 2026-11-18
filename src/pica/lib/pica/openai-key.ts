/**
 * The OpenAI key Pica uses. Server-only: never import it from a client component.
 *
 * `OPENAI_API_KEY` in the server's env wins. Without it, a key pasted on Home
 * (through `/api/setup`) is held in this process's memory only: it is never
 * written to disk and is gone when the server stops.
 *
 * The pasted key lives on `globalThis`, not in a module variable, because each
 * route bundle and each hot reload gets its own copy of this module.
 */
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { createRateLimiter } from "./rate-limit";

const KEY_SLOT = Symbol.for("pica.openaiKey");

type KeyHolder = { [KEY_SLOT]?: string };

function holder(): KeyHolder {
  return globalThis as KeyHolder;
}

/** Hold a pasted key in memory. The caller checks it first. */
export function setRuntimeKey(key: string): void {
  holder()[KEY_SLOT] = key;
}

/** Forget the pasted key. An env key, if set, stays in use. */
export function clearRuntimeKey(): void {
  delete holder()[KEY_SLOT];
}

/** The key to use: the env key, else the pasted key, else null. */
export function openaiKey(): string | null {
  const fromEnv = process.env.OPENAI_API_KEY;
  if (fromEnv) return fromEnv;
  return holder()[KEY_SLOT] || null;
}

/** What `/api/setup` may tell the browser: whether a key is in use, and whether it is the env's (which Home can't forget). */
export function keyStatus(): { hasKey: boolean; fromEnv: boolean } {
  const fromEnv = Boolean(process.env.OPENAI_API_KEY);
  return { hasKey: openaiKey() !== null, fromEnv };
}

/** An OpenAI provider for the current key, or null when there is none. */
export function picaProvider(): OpenAIProvider | null {
  const apiKey = openaiKey();
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
