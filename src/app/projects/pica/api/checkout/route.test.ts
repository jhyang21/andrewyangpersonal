import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import searchBag from "@/pica/lib/shopify/__fixtures__/search-bag.json";
import { _clearCaches } from "@/pica/lib/shopify";
import { clearAccessToken } from "@/pica/lib/shopify/auth";
import { _resetRouteLimits } from "@/pica/lib/shopify/rate-limit";
import { _setLimiterGap } from "@/pica/lib/shopify/transport";
import { POST as searchPOST } from "../catalog/search/route";
import { POST } from "./route";

const product = searchBag.result.structuredContent.products[0];
const body = {
  productId: product.id,
  variantId: product.variants[0].id,
  quantity: 1,
};

function post(payload: unknown, ip = "8.8.8.8") {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(payload),
  });
}

function lookup(available: boolean) {
  const p = JSON.parse(JSON.stringify(product));
  p.variants[0].availability = { available };
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { structuredContent: { products: [p] } } }), {
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  _setLimiterGap(0);
  _clearCaches();
  _resetRouteLimits();
  clearAccessToken();
  vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/checkout", () => {
  it("hands off with the catalog link when there is no token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => lookup(true)));
    const res = await POST(post(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: "direct", continueUrl: product.variants[0].checkout_url, quantity: 1 });
  });

  it("answers quantity 1 on the direct path even when the buyer asked for more", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => lookup(true)));
    const res = await POST(post({ ...body, quantity: 3 }));
    expect(res.status).toBe(200);
    expect((await res.json()).quantity).toBe(1);
  });

  it("ignores the checkout link the client sends", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => lookup(true));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(post({ ...body, checkoutUrl: "https://evil.example/buy/1:1" }));
    expect((await res.json()).continueUrl).toBe(product.variants[0].checkout_url);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("evil"))).toBe(true);
  });

  it("with a token, starts checkout at the catalog's merchant, not the domain the client sends", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    const merchantUrl = "https://forgedleather.myshopify.com/cart/c/abc";
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("/auth/access_token")) return Response.json({ access_token: "tok" });
      if (url.startsWith("https://catalog.shopify.com/")) return lookup(true);
      return Response.json({ jsonrpc: "2.0", id: 1, result: { structuredContent: { status: "incomplete", continue_url: merchantUrl } } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      post({ ...body, sellerDomain: "evil.myshopify.com", checkoutUrl: "https://evil.example/buy/1:1" }),
    );
    expect(await res.json()).toMatchObject({ mode: "ucp", continueUrl: merchantUrl });
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toContain("https://forgedleather.myshopify.com/api/ucp/mcp");
    expect(urls.every((url) => !url.includes("evil"))).toBe(true);
  });

  it("answers 400 when the variant belongs to another product", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => lookup(true)));
    const res = await POST(post({ ...body, productId: "gid://shopify/p/someOtherProduct1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_request");
  });

  it("answers 409 when the variant sold out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => lookup(false)));
    const res = await POST(post(body));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("variant_unavailable");
  });

  it("answers the 4th checkout in one instant with 429 and the real wait; other buyers and the catalog are still served", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const fetchMock = vi.fn<typeof fetch>(async () => lookup(true));
      vi.stubGlobal("fetch", fetchMock);
      for (let i = 0; i < 3; i++) expect((await POST(post(body))).status).toBe(200);
      const calls = fetchMock.mock.calls.length;
      const res = await POST(post(body));
      expect(res.status).toBe(429);
      expect((await res.json()).error).toEqual({
        code: "rate_limited",
        message: "You're going a little fast. Try again in 6 seconds.",
        retryAfterSeconds: 6,
      });
      expect(res.headers.get("retry-after")).toBe("6");
      expect(fetchMock.mock.calls.length).toBe(calls);

      // Another buyer can still check out.
      expect((await POST(post(body, "8.8.4.4"))).status).toBe(200);

      // Checkout and catalog budgets are separate, both ways.
      const search = (query: string, ip: string) =>
        new Request("http://localhost/api/catalog/search", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ query, category: "bag" }),
        });
      fetchMock.mockImplementation(async () =>
        Response.json(searchBag, { headers: { "content-type": "application/json" } }),
      );
      // 8.8.8.8 is out of checkouts, not searches.
      expect((await searchPOST(search("tote", "8.8.8.8"))).status).toBe(200);
      // 1.1.1.1 is out of searches, not checkouts.
      for (let i = 0; i < 10; i++) await searchPOST(search(`bag ${i}`, "1.1.1.1"));
      expect((await searchPOST(search("bag 10", "1.1.1.1"))).status).toBe(429);
      fetchMock.mockImplementation(async () => lookup(true));
      expect((await POST(post(body, "1.1.1.1"))).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers 400 for a bad body", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await POST(post({ ...body, quantity: "two" }));
    expect(res.status).toBe(400);
  });
});
