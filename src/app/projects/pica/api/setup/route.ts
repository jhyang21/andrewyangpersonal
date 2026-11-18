/**
 * /api/setup: the OpenAI key pasted on Home, for local runs only.
 *
 * GET → `{ hasKey, fromEnv, canAdd }`. POST `{ apiKey }` checks the key with
 * OpenAI, then holds it in memory. DELETE forgets it. A good POST and a DELETE
 * answer as GET does. The key is never sent back, logged or written to disk
 * (see `@/pica/lib/pica/openai-key`).
 *
 * GET answers everywhere, with `canAdd: false` where a key may not be added,
 * so a hosted copy offers only the demo. POST and DELETE answer 403 in
 * production, when the Host isn't this computer, and when the Origin names
 * another site.
 */
import { z } from "zod";
import type { ApiError } from "@/pica/lib/types";
import { readBodyText } from "@/pica/lib/pica/chat-request";
import { clearRuntimeKey, keyStatus, setRuntimeKey, setupRateLimiter } from "@/pica/lib/pica/openai-key";
import { clientKey } from "@/pica/lib/pica/rate-limit";

const BODY_BYTES = 1_024;
const CHECK_TIMEOUT_MS = 10_000;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const MESSAGES = {
  forbidden: "You can only add a key while Pica runs on your own computer.",
  badShape: "That doesn't look like an OpenAI key. Keys start with sk- and have no spaces.",
  badKey: "OpenAI didn't accept that key.",
  unreachable: "Couldn't reach OpenAI to check the key. Check your connection, then try again.",
  notChecked: "OpenAI couldn't check the key right now. Try again in a moment.",
  rateLimited: "That's a lot of tries in a short time. Wait a few minutes, then try again.",
} as const;

const bodySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20)
    .max(200)
    .startsWith("sk-")
    .regex(/^\S+$/),
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

const forbidden = () => fail(403, { code: "bad_request", message: MESSAGES.forbidden });

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

/** A 403 response when this request may not touch the key, else null. */
function guard(request: Request, checkOrigin: boolean): Response | null {
  if (process.env.NODE_ENV === "production") return forbidden();
  const host = requestHost(request);
  if (!host) return forbidden();
  const hostname = new URL(`http://${host}`).hostname;
  if (!LOCAL_HOSTNAMES.has(hostname)) return forbidden();
  if (checkOrigin) {
    const origin = request.headers.get("origin");
    if (origin !== null) {
      let originHost: string | null;
      try {
        originHost = new URL(origin).host.toLowerCase();
      } catch {
        originHost = null;
      }
      if (originHost !== host) return forbidden();
    }
  }
  return null;
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

export async function GET(request: Request): Promise<Response> {
  // Two booleans and whether this request could add a key; never the key.
  return json({ ...keyStatus(), canAdd: guard(request, false) === null });
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guard(request, true);
  if (blocked) return blocked;

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

  const apiKey = parsed.data.apiKey;
  switch (await checkKey(apiKey)) {
    case "ok":
      setRuntimeKey(apiKey);
      return json({ ...keyStatus(), canAdd: true });
    case "rejected":
      return fail(400, { code: "bad_key", message: MESSAGES.badKey });
    case "unreachable":
      return fail(502, { code: "model_unavailable", message: MESSAGES.unreachable });
    case "not_checked":
      return fail(502, { code: "model_unavailable", message: MESSAGES.notChecked });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const blocked = guard(request, true);
  if (blocked) return blocked;
  clearRuntimeKey();
  return json({ ...keyStatus(), canAdd: true });
}
