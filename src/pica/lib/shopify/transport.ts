/**
 * JSON-RPC over HTTP for Shopify's UCP MCP endpoints, with a timeout on every
 * call, a limiter that keeps us under 5 requests per second, and one bounded
 * retry on 429. Never logs URLs from responses.
 */
import { MAX_QUEUE_WAIT_MS, MAX_RETRY_WAIT_SECONDS } from "./config";
import { MESSAGES, ShopifyError, shopifyError } from "./errors";

/* ---------------------------- rate limiter ---------------------------- */

let minGapMs = 200; // 5 requests per second
let nextSlotAt = 0;

/**
 * Wait for the next free slot. Slots are spaced `minGapMs` apart. When the
 * next slot is more than MAX_QUEUE_WAIT_MS away, throw `rate_limited` at once
 * and keep no slot, so the queue stays short and no request waits long
 * before its own timeout even starts.
 */
export async function takeSlot(): Promise<void> {
  const now = Date.now();
  const start = Math.max(now, nextSlotAt);
  const wait = start - now;
  if (wait > MAX_QUEUE_WAIT_MS) {
    console.warn(`[shopify] queue full (${wait} ms); answering rate_limited`);
    throw shopifyError("rate_limited", MESSAGES.rate_limited, Math.max(1, Math.ceil(wait / 1000)));
  }
  nextSlotAt = start + minGapMs;
  if (wait > 0) await sleep(wait);
}

/** Tests only. */
export function _setLimiterGap(ms: number): void {
  minGapMs = ms;
  nextSlotAt = 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------ helpers ------------------------------ */

/** Seconds from a Retry-After header (delta seconds or HTTP date). Null when absent or unreadable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.ceil(Number(trimmed));
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

/** Read a JSON-RPC message from a JSON body or an SSE stream body. */
export function parseRpcBody(text: string, contentType: string | null): unknown {
  if (contentType?.includes("text/event-stream")) {
    let last: unknown = undefined;
    for (const event of text.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");
      if (!data) continue;
      try {
        const parsed: unknown = JSON.parse(data);
        if (isRecord(parsed) && ("result" in parsed || "error" in parsed)) last = parsed;
      } catch {
        // Skip a non-JSON event.
      }
    }
    if (last === undefined) throw new Error("No JSON-RPC message in event stream");
    return last;
  }
  return JSON.parse(text);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* ---------------------------- tool calls ---------------------------- */

export interface CallToolOptions {
  endpoint: string;
  tool: string;
  args: Record<string, unknown>;
  timeoutMs: number;
  headers?: Record<string, string>;
  /** Retry once on 429 when Retry-After is short. Default true. */
  retryOn429?: boolean;
}

/** A tool answered with `isError: true`. `text` is the tool's own message, for logs only. */
export class ToolCallError extends Error {
  constructor(
    readonly tool: string,
    readonly text: string,
  ) {
    super(`${tool} returned an error`);
    this.name = "ToolCallError";
  }
}

/**
 * The endpoint answered HTTP 401: it refused our token. Callers that sent a
 * token can drop it and retry keyless. Others treat it as any other failure.
 */
export class UnauthorizedError extends ShopifyError {
  constructor() {
    super({ code: "catalog_unavailable", message: MESSAGES.catalog_unavailable });
    this.name = "UnauthorizedError";
  }
}

let rpcId = 0;

/**
 * Call one MCP tool and return `result.structuredContent`.
 * Throws ShopifyError for transport failures and ToolCallError for tool errors.
 */
export async function callTool(opts: CallToolOptions): Promise<Record<string, unknown>> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: ++rpcId,
    method: "tools/call",
    params: { name: opts.tool, arguments: opts.args },
  });
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...opts.headers,
  };
  const retryOn429 = opts.retryOn429 ?? true;

  for (let attempt = 0; ; attempt++) {
    await takeSlot();
    let res: Response;
    try {
      res = await fetch(opts.endpoint, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.name : "unknown";
      console.warn(`[shopify] ${opts.tool}: request failed (${reason})`);
      throw shopifyError("catalog_unavailable");
    }

    if (res.status === 429) {
      const wait = parseRetryAfter(res.headers.get("retry-after"));
      if (retryOn429 && attempt === 0 && wait !== null && wait <= MAX_RETRY_WAIT_SECONDS) {
        console.warn(`[shopify] ${opts.tool}: 429, retrying in ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      console.warn(`[shopify] ${opts.tool}: 429, giving up`);
      throw shopifyError("rate_limited", MESSAGES.rate_limited, wait ?? 5);
    }

    if (res.status === 401) {
      console.warn(`[shopify] ${opts.tool}: HTTP 401`);
      throw new UnauthorizedError();
    }

    if (!res.ok) {
      console.warn(`[shopify] ${opts.tool}: HTTP ${res.status}`);
      throw shopifyError("catalog_unavailable");
    }

    let message: unknown;
    try {
      message = parseRpcBody(await res.text(), res.headers.get("content-type"));
    } catch {
      console.warn(`[shopify] ${opts.tool}: unreadable response body`);
      throw shopifyError("catalog_unavailable");
    }

    if (!isRecord(message)) {
      console.warn(`[shopify] ${opts.tool}: response is not an object`);
      throw shopifyError("catalog_unavailable");
    }
    if (isRecord(message.error)) {
      console.warn(
        `[shopify] ${opts.tool}: JSON-RPC error ${String(message.error.code)}: ${String(message.error.message).slice(0, 200)}`,
      );
      throw shopifyError("catalog_unavailable");
    }
    const result = message.result;
    if (!isRecord(result)) {
      console.warn(`[shopify] ${opts.tool}: response has no result`);
      throw shopifyError("catalog_unavailable");
    }
    if (result.isError === true) {
      const text = Array.isArray(result.content)
        ? result.content
            .map((c) => (isRecord(c) && typeof c.text === "string" ? c.text : ""))
            .join(" ")
            .trim()
        : "";
      // Strip links so a checkout URL never lands in the logs.
      console.warn(
        `[shopify] ${opts.tool}: tool error: ${text.replace(/https?:\/\/\S+/g, "[url]").slice(0, 200)}`,
      );
      throw new ToolCallError(opts.tool, text);
    }
    if (!isRecord(result.structuredContent)) {
      console.warn(`[shopify] ${opts.tool}: result has no structuredContent`);
      throw shopifyError("catalog_unavailable");
    }
    return result.structuredContent;
  }
}
