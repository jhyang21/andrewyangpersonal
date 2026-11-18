/**
 * /api/setup: checks an OpenAI key pasted on Home. It stores nothing.
 *
 * POST `{ apiKey }` asks OpenAI whether it takes the key and answers
 * `{ ok: true }` when it does. The browser then keeps the key in its own tab
 * and sends it with each chat request (see `@/pica/lib/pica/openai-key`). The
 * key is never stored, logged or sent back.
 *
 * A POST whose Origin header names another site answers 403, so another page
 * can't use this route to test keys.
 */
import { z } from "zod";
import type { ApiError } from "@/pica/lib/types";
import { readBodyText } from "@/pica/lib/pica/chat-request";
import { OPENAI_KEY_SHAPE } from "@/pica/lib/pica/constants";
import { setupRateLimiter } from "@/pica/lib/pica/openai-key";
import { clientKey } from "@/pica/lib/pica/rate-limit";

const BODY_BYTES = 1_024;
const CHECK_TIMEOUT_MS = 10_000;

const MESSAGES = {
  otherSite: "You can only add a key from Pica's own page. Open Pica and try again.",
  badShape: "That doesn't look like an OpenAI key. Keys start with sk- and have no spaces.",
  badKey: "OpenAI didn't accept that key.",
  unreachable: "Couldn't reach OpenAI to check the key. Check your connection, then try again.",
  notChecked: "OpenAI couldn't check the key right now. Try again in a moment.",
  rateLimited: "That's a lot of tries in a short time. Wait a few minutes, then try again.",
} as const;

const bodySchema = z.object({
  apiKey: z.string().trim().regex(OPENAI_KEY_SHAPE),
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function fail(status: number, error: ApiError): Response {
  const headers: Record<string, string> = error.retryAfterSeconds
    ? { "retry-after": String(error.retryAfterSeconds) }
    : {};
  return json({ error }, status, headers);
}

function hostOf(value: string): string | null {
  try {
    return new URL(`http://${value}`).host;
  } catch {
    return null;
  }
}

/** The Host header (or the URL's host when there is none), lowercased. */
function requestHost(request: Request): string | null {
  const header = request.headers.get("host");
  if (header) return hostOf(header.trim().toLowerCase());
  try {
    return new URL(request.url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the request names an Origin whose host is not this request's host. */
function fromOtherSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  let originHost: string | null;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    originHost = null;
  }
  return originHost === null || originHost !== requestHost(request);
}

type KeyCheck = "ok" | "rejected" | "unreachable" | "not_checked";

/** Ask OpenAI whether it takes the key. One request; the key goes only to OpenAI. */
async function checkKey(apiKey: string): Promise<KeyCheck> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
  } catch (error) {
    // The name only: a message could carry request details.
    console.error("[pica] key check failed:", error instanceof Error ? error.name : typeof error);
    return "unreachable";
  }
  await response.body?.cancel().catch(() => {});
  if (response.ok) return "ok";
  if (response.status === 401 || response.status === 403) return "rejected";
  console.error("[pica] key check answered", response.status);
  return "not_checked";
}

export async function POST(request: Request): Promise<Response> {
  if (fromOtherSite(request)) return fail(403, { code: "bad_request", message: MESSAGES.otherSite });

  const limit = setupRateLimiter.check(clientKey(request));
  if (!limit.ok) {
    return fail(429, {
      code: "rate_limited",
      message: MESSAGES.rateLimited,
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  if (Number(request.headers.get("content-length")) > BODY_BYTES) {
    return fail(400, { code: "bad_request", message: MESSAGES.badShape });
  }
  const read = await readBodyText(request, BODY_BYTES);
  if (!read.ok) return fail(400, { code: "bad_request", message: MESSAGES.badShape });
  let raw: unknown;
  try {
    raw = JSON.parse(read.text);
  } catch {
    return fail(400, { code: "bad_request", message: MESSAGES.badShape });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail(400, { code: "bad_request", message: MESSAGES.badShape });

  switch (await checkKey(parsed.data.apiKey)) {
    case "ok":
      return json({ ok: true });
    case "rejected":
      return fail(400, { code: "bad_key", message: MESSAGES.badKey });
    case "unreachable":
      return fail(502, { code: "model_unavailable", message: MESSAGES.unreachable });
    case "not_checked":
      return fail(502, { code: "model_unavailable", message: MESSAGES.notChecked });
  }
}
