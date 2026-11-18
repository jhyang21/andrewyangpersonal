/**
 * /api/setup with a stubbed fetch: no network, and only obvious fake keys.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupRateLimiter, SETUP_RATE_LIMIT } from "@/pica/lib/pica/openai-key";
import * as route from "./route";

const { POST } = route;
const FAKE_KEY = "sk-test-not-real-0000000000";
const URL_BASE = "http://localhost:3100/api/setup";

function request(method: string, init: { body?: unknown; headers?: Record<string, string> } = {}): Request {
  const headers: Record<string, string> = { host: "localhost:3100", ...init.headers };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  return new Request(URL_BASE, {
    method,
    headers,
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
  });
}

const post = (headers: Record<string, string> = {}, apiKey = FAKE_KEY) =>
  POST(request("POST", { body: { apiKey }, headers }));

const fetchMock = vi.fn<typeof fetch>();

/** Everything the route wrote to the console, as one string. */
function logged(): string {
  return (["error", "warn", "log", "info", "debug"] as const)
    .flatMap((level) => vi.mocked(console[level]).mock.calls.flat())
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value) ?? String(value)))
    .join(" ");
}

beforeEach(() => {
  setupRateLimiter.reset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  for (const level of ["error", "warn", "log", "info", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/api/setup", () => {
  it("answers POST only: no GET to read a key, no DELETE to forget one", () => {
    expect(Object.keys(route).sort()).toEqual(["POST"]);
  });
});

describe("POST /api/setup", () => {
  it("checks the key with OpenAI and answers ok, storing nothing and never echoing the key", async () => {
    const response = await post({}, `  ${FAKE_KEY}\n`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ ok: true });
    expect(text).not.toContain(FAKE_KEY);
    for (const [name, value] of response.headers) {
      expect(value, name).not.toContain(FAKE_KEY);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/models");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${FAKE_KEY}`);
    expect(logged()).not.toContain(FAKE_KEY);
  });

  it("keeps no key on the server: no new globals and nothing in the env", async () => {
    const before = new Set(Reflect.ownKeys(globalThis));
    expect((await post()).status).toBe(200);
    expect(Reflect.ownKeys(globalThis).filter((key) => !before.has(key))).toEqual([]);
    expect(Reflect.ownKeys(globalThis)).not.toContain(Symbol.for("pica.openaiKey"));
    expect(Object.values(process.env)).not.toContain(FAKE_KEY);
  });

  it("answers bad_key when OpenAI answers 401 or 403, and logs no key", async () => {
    for (const status of [401, 403]) {
      fetchMock.mockResolvedValueOnce(new Response("{}", { status }));
      const response = await post();
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({
        error: { code: "bad_key", message: "OpenAI didn't accept that key." },
      });
      expect(text).not.toContain(FAKE_KEY);
    }
    expect(logged()).not.toContain(FAKE_KEY);
  });

  it("answers 502 when OpenAI can't be reached, and logs no key", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed for ${FAKE_KEY}`));
    const response = await post();
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("model_unavailable");
    expect(logged()).not.toContain(FAKE_KEY);
  });

  it("answers 502 when OpenAI fails for another reason", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const response = await post();
    expect(response.status).toBe(502);
    expect(logged()).not.toContain(FAKE_KEY);
  });

  it("rejects a body that isn't a key, without calling OpenAI", async () => {
    const bodies: unknown[] = [
      "{nope",
      {},
      { apiKey: 42 },
      { apiKey: "pk-test-not-real-0000000000" },
      { apiKey: "sk-short" },
      { apiKey: "sk-test-not real-0000000000" },
      { apiKey: `sk-${"x".repeat(200)}` },
    ];
    for (const body of bodies) {
      const response = await POST(request("POST", { body }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("bad_request");
    }
    const huge = await POST(request("POST", { body: { apiKey: FAKE_KEY, pad: "x".repeat(5_000) } }));
    expect(huge.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("limits how often one client can try", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 401 }));
    for (let i = 0; i < SETUP_RATE_LIMIT.requests; i++) {
      expect((await post()).status).toBe(400);
    }
    const limited = await post();
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("rate_limited");
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("POST /api/setup: the Origin check", () => {
  it("takes a POST with no Origin, or one from this host, wherever it runs", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const host of ["localhost:3100", "127.0.0.1:3100", "[::1]:3100", "andrewyang.example", "pica.example.com"]) {
      expect((await post({ host, origin: `https://${host}` })).status, host).toBe(200);
      expect((await post({ host })).status, host).toBe(200);
    }
  });

  it("answers 403 to a POST from another origin, without calling OpenAI", async () => {
    for (const origin of ["http://evil.example", "http://localhost:4000", "null", "not a url"]) {
      const response = await post({ origin });
      expect(response.status, origin).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect((await response.json()).error.message).toBe(
        "You can only add a key from Pica's own page. Open Pica and try again.",
      );
    }
    expect((await post({ host: "pica.example.com", origin: "https://localhost:3100" })).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
