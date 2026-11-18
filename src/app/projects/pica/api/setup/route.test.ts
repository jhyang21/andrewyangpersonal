/**
 * /api/setup with a stubbed fetch: no network, and only obvious fake keys.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeKey, openaiKey, setRuntimeKey, setupRateLimiter, SETUP_RATE_LIMIT } from "@/pica/lib/pica/openai-key";
import { DELETE, GET, POST } from "./route";

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

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  setupRateLimiter.reset();
  clearRuntimeKey();
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  clearRuntimeKey();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/setup", () => {
  it("says whether a key is held, and never sends the key", async () => {
    let response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ hasKey: false, fromEnv: false, canAdd: true });

    setRuntimeKey(FAKE_KEY);
    response = await GET(request("GET"));
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ hasKey: true, fromEnv: false, canAdd: true });
    expect(text).not.toContain(FAKE_KEY);
  });

  it("counts a key from the env", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-env-not-real-1111111111");
    expect(await (await GET(request("GET"))).json()).toEqual({ hasKey: true, fromEnv: true, canAdd: true });
  });
});

describe("POST /api/setup", () => {
  it("checks the key with OpenAI, holds it, and GET then says hasKey", async () => {
    const response = await POST(request("POST", { body: { apiKey: `  ${FAKE_KEY}\n` } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ hasKey: true, fromEnv: false, canAdd: true });
    expect(text).not.toContain(FAKE_KEY);
    expect(openaiKey()).toBe(FAKE_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/models");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${FAKE_KEY}`);

    expect(await (await GET(request("GET"))).json()).toEqual({ hasKey: true, fromEnv: false, canAdd: true });
  });

  it("stores nothing when OpenAI answers 401 or 403", async () => {
    for (const status of [401, 403]) {
      fetchMock.mockResolvedValueOnce(new Response("{}", { status }));
      const response = await POST(request("POST", { body: { apiKey: FAKE_KEY } }));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        error: { code: "bad_key", message: "OpenAI didn't accept that key." },
      });
      expect(openaiKey()).toBeNull();
    }
  });

  it("answers 502 and stores nothing when OpenAI can't be reached", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const response = await POST(request("POST", { body: { apiKey: FAKE_KEY } }));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("model_unavailable");
    expect(openaiKey()).toBeNull();
    // The log never holds the key.
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).not.toContain(FAKE_KEY);
  });

  it("answers 502 and stores nothing when OpenAI fails for another reason", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const response = await POST(request("POST", { body: { apiKey: FAKE_KEY } }));
    expect(response.status).toBe(502);
    expect(openaiKey()).toBeNull();
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
    expect(openaiKey()).toBeNull();
  });

  it("limits how often one client can try", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 401 }));
    for (let i = 0; i < SETUP_RATE_LIMIT.requests; i++) {
      expect((await POST(request("POST", { body: { apiKey: FAKE_KEY } }))).status).toBe(400);
    }
    const limited = await POST(request("POST", { body: { apiKey: FAKE_KEY } }));
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("rate_limited");
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("DELETE /api/setup", () => {
  it("forgets the pasted key", async () => {
    setRuntimeKey(FAKE_KEY);
    const response = await DELETE(request("DELETE"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ hasKey: false, fromEnv: false, canAdd: true });
    expect(openaiKey()).toBeNull();
  });

  it("still says hasKey when the env holds one", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-env-not-real-1111111111");
    setRuntimeKey(FAKE_KEY);
    expect(await (await DELETE(request("DELETE"))).json()).toEqual({ hasKey: true, fromEnv: true, canAdd: true });
  });
});

describe("/projects/pica/api/setup guards", () => {
  const post = (headers: Record<string, string>) => POST(request("POST", { body: { apiKey: FAKE_KEY }, headers }));

  it("allows a same-origin POST from each local address", async () => {
    for (const host of ["localhost:3100", "127.0.0.1:3100", "[::1]:3100"]) {
      clearRuntimeKey();
      const response = await post({ host, origin: `http://${host}` });
      expect(response.status).toBe(200);
    }
  });

  it("answers 403 to POST and DELETE when the Host isn't this computer, and GET says a key can't be added", async () => {
    const headers = { host: "pica.example.com" };
    const got = await GET(request("GET", { headers }));
    expect(got.status).toBe(200);
    expect(await got.json()).toEqual({ hasKey: false, fromEnv: false, canAdd: false });
    const response = await DELETE(request("DELETE", { headers }));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await post(headers)).status).toBe(403);
    expect((await post({ host: "localhost.example.com:3100" })).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 403 to a POST or DELETE from another origin", async () => {
    for (const origin of ["http://evil.example", "http://localhost:4000", "null"]) {
      expect((await post({ origin })).status).toBe(403);
      setRuntimeKey(FAKE_KEY);
      expect((await DELETE(request("DELETE", { headers: { origin } }))).status).toBe(403);
      expect(openaiKey()).toBe(FAKE_KEY);
      clearRuntimeKey();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 403 to POST and DELETE in production, and GET says a key can't be added", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setRuntimeKey(FAKE_KEY);
    const got = await GET(request("GET"));
    const text = await got.text();
    expect(JSON.parse(text)).toEqual({ hasKey: true, fromEnv: false, canAdd: false });
    expect(text).not.toContain(FAKE_KEY);
    clearRuntimeKey();
    expect((await post({})).status).toBe(403);
    setRuntimeKey(FAKE_KEY);
    expect((await DELETE(request("DELETE"))).status).toBe(403);
    expect(openaiKey()).toBe(FAKE_KEY);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
