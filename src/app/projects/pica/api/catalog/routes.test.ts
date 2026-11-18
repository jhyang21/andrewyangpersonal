import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import getProductFixture from "@/pica/lib/shopify/__fixtures__/get-product.json";
import searchBag from "@/pica/lib/shopify/__fixtures__/search-bag.json";
import { _clearCaches } from "@/pica/lib/shopify";
import { _resetRouteLimits } from "@/pica/lib/shopify/rate-limit";
import { _setLimiterGap } from "@/pica/lib/shopify/transport";
import { GET } from "./product/route";
import { POST } from "./search/route";

function rpc(fixture: { result: unknown }) {
  return new Response(JSON.stringify(fixture), { headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  _setLimiterGap(0);
  _clearCaches();
  _resetRouteLimits();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function post(body: string, ip?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ip) headers["x-forwarded-for"] = ip;
  return new Request("http://localhost/api/catalog/search", { method: "POST", headers, body });
}

describe("POST /api/catalog/search", () => {
  it("returns a CatalogSearchResult", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => rpc(searchBag)));
    const res = await POST(post(JSON.stringify({ query: "leather tote", category: "bag" })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products).toHaveLength(10);
    expect(body.totalCount).toBe(836);
    expect(typeof body.nextCursor).toBe("string");
  });

  it("answers 400 { error } for a body it cannot read", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const body of ["not json", JSON.stringify({ query: 5 }), JSON.stringify({ query: "x", limit: 99 })]) {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("bad_request");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 503 when the catalog is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 502 })));
    const res = await POST(post(JSON.stringify({ query: "tote" })));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("catalog_unavailable");
  });
});

describe("GET /api/catalog/product", () => {
  const id = "gid://shopify/p/5fx7YuEO6xfRQSEPL91Kzd";

  it("returns { product } and passes `selected` through", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      rpc(getProductFixture),
    );
    vi.stubGlobal("fetch", fetchMock);
    const selected = encodeURIComponent(JSON.stringify([{ name: "Color", label: "Jet Black" }]));
    const res = await GET(new NextRequest(`http://localhost/api/catalog/product?id=${encodeURIComponent(id)}&selected=${selected}`));
    expect(res.status).toBe(200);
    expect((await res.json()).product.id).toBe(id);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.params.arguments.catalog.selected).toEqual([{ name: "Color", label: "Jet Black" }]);
  });

  it("answers 400 for a missing id or unreadable `selected`", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await GET(new NextRequest("http://localhost/api/catalog/product"))).status).toBe(400);
    const res = await GET(new NextRequest(`http://localhost/api/catalog/product?id=${encodeURIComponent(id)}&selected=%7Bnope`));
    expect(res.status).toBe(400);
  });
});

describe("per-client limit on the catalog routes", () => {
  const search = (query: string) => JSON.stringify({ query, category: "bag" });
  const productRequest = (ip: string, id = "abc") =>
    new NextRequest(`http://localhost/api/catalog/product?id=${encodeURIComponent(`gid://shopify/p/${id}`)}`, {
      headers: { "x-forwarded-for": ip },
    });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("lets a buyer make 60 uncached catalog calls in a minute, one a second", async () => {
    const fetchMock = vi.fn(async () => rpc(searchBag));
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 30; i++) {
      vi.setSystemTime(i * 2_000);
      expect((await POST(post(search(`tote ${i}`), "8.8.8.8"))).status).toBe(200);
      vi.setSystemTime(i * 2_000 + 1_000);
      expect((await GET(productRequest("8.8.8.8", `p${i}`))).status).not.toBe(429);
    }
    // Every call reached the catalog, so none was a cache hit.
    expect(fetchMock).toHaveBeenCalledTimes(60);
  });

  it("answers the 11th call in one instant with 429 and the real wait, without calling Shopify", async () => {
    const fetchMock = vi.fn(async () => rpc(searchBag));
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 9; i++) expect((await POST(post(search(`tote ${i}`), "8.8.8.8"))).status).toBe(200);
    expect((await GET(productRequest("8.8.8.8"))).status).not.toBe(429);
    const calls = fetchMock.mock.calls.length;

    for (const res of [await POST(post(search("tote 10"), "8.8.8.8")), await GET(productRequest("8.8.8.8"))]) {
      expect(res.status).toBe(429);
      const { error } = await res.json();
      expect(error).toEqual({
        code: "rate_limited",
        message: "You're going a little fast. Try again in 1 second.",
        retryAfterSeconds: 1,
      });
      expect(res.headers.get("retry-after")).toBe("1");
    }
    expect(fetchMock.mock.calls.length).toBe(calls);

    // A second buyer is still served.
    expect((await POST(post(search("tote 11"), "8.8.4.4"))).status).toBe(200);
  });
});
