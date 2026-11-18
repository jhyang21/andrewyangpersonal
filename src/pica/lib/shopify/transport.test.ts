import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import errorFixture from "./__fixtures__/error-invalid-arguments.json";
import searchBag from "./__fixtures__/search-bag.json";
import { ShopifyError } from "./errors";
import {
  ToolCallError,
  UnauthorizedError,
  _setLimiterGap,
  callTool,
  parseRetryAfter,
  parseRpcBody,
  takeSlot,
} from "./transport";

const opts = { endpoint: "https://catalog.example/mcp", tool: "search_catalog", args: {}, timeoutMs: 1000 };

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "resolved";
  } catch (err) {
    if (err instanceof ShopifyError) return err.error.code;
    if (err instanceof ToolCallError) return "tool_error";
    throw err;
  }
}

beforeEach(() => {
  _setLimiterGap(0);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    expect(parseRetryAfter("3")).toBe(3);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
    const now = Date.parse("2026-11-17T10:00:00Z");
    expect(parseRetryAfter("Tue, 17 Nov 2026 10:00:04 GMT", now)).toBe(4);
  });
});

describe("parseRpcBody", () => {
  it("reads the JSON-RPC message from an event stream", () => {
    const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n';
    expect(parseRpcBody(sse, "text/event-stream")).toEqual({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  });
});

describe("callTool", () => {
  it("sends a JSON-RPC tools/call and returns structuredContent", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(searchBag));
    vi.stubGlobal("fetch", fetchMock);
    const out = await callTool({ ...opts, args: { catalog: { query: "tote" } } });
    expect(Array.isArray(out.products)).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "search_catalog", arguments: { catalog: { query: "tote" } } },
    });
    expect((init.headers as Record<string, string>).Accept).toBe("application/json, text/event-stream");
  });

  it("turns a tool error (HTTP 200, isError) into ToolCallError with the text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(errorFixture)));
    const err = await callTool(opts).catch((e) => e);
    expect(err).toBeInstanceOf(ToolCallError);
    expect((err as ToolCallError).text).toContain("ships_to");
  });

  it("maps HTTP 500, network failure, timeouts and bad bodies to catalog_unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect(await codeOf(callTool(opts))).toBe("catalog_unavailable");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await codeOf(callTool(opts))).toBe("catalog_unavailable");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new DOMException("timed out", "TimeoutError"))),
    );
    expect(await codeOf(callTool(opts))).toBe("catalog_unavailable");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
    expect(await codeOf(callTool(opts))).toBe("catalog_unavailable");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "bad" } })),
    );
    expect(await codeOf(callTool(opts))).toBe("catalog_unavailable");
  });

  it("retries once on 429 with a short Retry-After", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(jsonResponse(searchBag));
    vi.stubGlobal("fetch", fetchMock);
    await callTool(opts);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up with rate_limited after a second 429, or when the wait is long", async () => {
    const twice = vi.fn(async () => new Response("", { status: 429, headers: { "retry-after": "0" } }));
    vi.stubGlobal("fetch", twice);
    const err = (await callTool(opts).catch((e) => e)) as ShopifyError;
    expect(err.error.code).toBe("rate_limited");
    expect(twice).toHaveBeenCalledTimes(2);

    const long = vi.fn(async () => new Response("", { status: 429, headers: { "retry-after": "60" } }));
    vi.stubGlobal("fetch", long);
    const err2 = (await callTool(opts).catch((e) => e)) as ShopifyError;
    expect(err2.error).toMatchObject({ code: "rate_limited", retryAfterSeconds: 60 });
    expect(long).toHaveBeenCalledTimes(1);
  });

  it("does not retry when retryOn429 is false", async () => {
    const once = vi.fn(async () => new Response("", { status: 429, headers: { "retry-after": "0" } }));
    vi.stubGlobal("fetch", once);
    expect(await codeOf(callTool({ ...opts, retryOn429: false }))).toBe("rate_limited");
    expect(once).toHaveBeenCalledTimes(1);
  });

  it("throws UnauthorizedError on HTTP 401 so a caller can drop its token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    const err = await callTool(opts).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect((err as ShopifyError).error.code).toBe("catalog_unavailable");
  });

  it("answers rate_limited at once when the queue wait passes the cap", async () => {
    vi.useFakeTimers();
    try {
      _setLimiterGap(2000);
      const first = takeSlot(); // now
      const second = takeSlot(); // waits 2 s: under the 3 s cap
      const third = takeSlot(); // would wait 4 s: over the cap
      const err = await third.catch((e) => e);
      expect(err).toBeInstanceOf(ShopifyError);
      expect((err as ShopifyError).error).toMatchObject({ code: "rate_limited", retryAfterSeconds: 4 });
      await vi.advanceTimersByTimeAsync(2000);
      await expect(Promise.all([first, second])).resolves.toBeDefined();
      // The refused call kept no slot: the next one fits after the second.
      const fourth = takeSlot();
      await vi.advanceTimersByTimeAsync(2000);
      await expect(fourth).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("spaces calls to stay under 5 per second", async () => {
    _setLimiterGap(200);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(searchBag)));
    const start = Date.now();
    await Promise.all([callTool(opts), callTool(opts), callTool(opts)]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(390);
  });
});
