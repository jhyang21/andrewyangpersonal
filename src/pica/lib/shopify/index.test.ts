import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import searchBackpack from "./__fixtures__/search-backpack.json";
import searchBag from "./__fixtures__/search-bag.json";
import { clearAccessToken } from "./auth";
import { ShopifyError } from "./errors";
import {
  _clearCaches,
  buildSearchArgs,
  createCheckout,
  getProduct,
  parseUcpCheckout,
  searchCatalog,
} from "./index";
import { _setLimiterGap } from "./transport";

type RawVariant = Record<string, unknown>;
const bagProduct = () =>
  JSON.parse(JSON.stringify(searchBag.result.structuredContent.products[0])) as Record<string, unknown> & {
    variants: RawVariant[];
  };

const PRODUCT_ID = "gid://shopify/p/2ANzim7d6iD6ME6QymdBHc";
const VARIANT_ID = "gid://shopify/ProductVariant/32820506656850";
const CATALOG_CHECKOUT_URL = searchBag.result.structuredContent.products[0].variants[0].checkout_url;

function rpc(structuredContent: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { structuredContent } }), {
    headers: { "content-type": "application/json" },
  });
}
function toolError(text: string) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text }], isError: true } }),
    { headers: { "content-type": "application/json" } },
  );
}

interface Call {
  url: string;
  tool?: string;
  args?: Record<string, unknown>;
  headers: Record<string, string>;
}

/** Fake fetch that routes by URL and tool name and records each call. */
function fakeFetch(handlers: {
  token?: () => Response;
  catalog?: (tool: string, args: Record<string, unknown>, headers: Record<string, string>) => Response;
  merchant?: (tool: string, args: Record<string, unknown>) => Response;
}) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const tool = body?.params?.name as string | undefined;
    const args = body?.params?.arguments as Record<string, unknown> | undefined;
    calls.push({ url, tool, args, headers });
    if (url === "https://api.shopify.com/auth/access_token") {
      return handlers.token?.() ?? new Response("", { status: 401 });
    }
    if (url === "https://catalog.shopify.com/api/ucp/mcp") {
      return handlers.catalog?.(tool!, args!, headers) ?? new Response("", { status: 500 });
    }
    return handlers.merchant?.(tool!, args!) ?? new Response("", { status: 500 });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

const lookupWith = (variantPatch: RawVariant = {}) => {
  const p = bagProduct();
  Object.assign(p.variants[0], variantPatch);
  return rpc({ products: [p] });
};

beforeEach(() => {
  _setLimiterGap(0);
  _clearCaches();
  clearAccessToken();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function errorOf(p: Promise<unknown>) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(ShopifyError);
  return (err as ShopifyError).error;
}

describe("buildSearchArgs", () => {
  it("adds the category word, prices in cents, US shipping, availability and a capped limit", () => {
    const args = buildSearchArgs({
      query: "something for a 16 inch laptop",
      category: "backpack",
      minPriceUsd: 50,
      maxPriceUsd: 199.99,
      limit: 50,
      cursor: "abc",
    });
    expect(args).toEqual({
      query: "something for a 16 inch laptop backpack",
      context: { address_country: "US", currency: "USD", language: "en" },
      filters: { available: true, ships_to: { country: "US" }, price: { min: 5000, max: 19999 } },
      pagination: { limit: 10, cursor: "abc" },
    });
  });

  it("leaves the query alone when it already names the category", () => {
    expect(buildSearchArgs({ query: "carry-on spinner", category: "luggage" }).query).toBe("carry-on spinner");
    expect(buildSearchArgs({ query: "leather tote", category: "bag" }).query).toBe("leather tote");
    expect(buildSearchArgs({ query: "", category: "bag" }).query).toBe("bag");
  });

  it("sends ships_to as an object, as the schema requires", () => {
    expect(buildSearchArgs({ query: "tote" }).filters).toMatchObject({ ships_to: { country: "US" } });
  });
});

describe("searchCatalog", () => {
  it("normalizes, drops non-USD products, reads pagination and caches", async () => {
    const calls = fakeFetch({ catalog: () => rpc(searchBackpack.result.structuredContent) });
    const result = await searchCatalog({ query: "commuter backpack", category: "backpack" });
    expect(result.products).toHaveLength(8);
    expect(result.totalCount).toBe(804);
    expect(result.nextCursor).toBe(searchBackpack.result.structuredContent.pagination.cursor);
    expect(calls[0].args).toMatchObject({
      meta: { "ucp-agent": { profile: expect.stringMatching(/^https:\/\//) } },
      catalog: { query: "commuter backpack" },
    });
    expect(calls[0].headers.Authorization).toBeUndefined();

    await searchCatalog({ query: "commuter backpack", category: "backpack" });
    expect(calls).toHaveLength(1);
  });

  it("drops a product priced above the buyer's maximum", async () => {
    fakeFetch({ catalog: () => rpc(searchBag.result.structuredContent) });
    const result = await searchCatalog({ query: "tote", maxPriceUsd: 150 });
    expect(result.products.every((p) => p.variants[0].price.amount <= 15000)).toBe(true);
    expect(result.products.length).toBeLessThan(10);
  });

  it("maps a tool error to catalog_unavailable with a buyer-facing message", async () => {
    fakeFetch({ catalog: () => toolError("Invalid arguments: value at `/catalog/filters/ships_to` is not an object") });
    const error = await errorOf(searchCatalog({ query: "tote" }));
    expect(error.code).toBe("catalog_unavailable");
    expect(error.message).not.toMatch(/invalid|ships_to|oops/i);
  });

  it("rejects an empty search without calling Shopify", async () => {
    const calls = fakeFetch({});
    expect((await errorOf(searchCatalog({ query: "  " }))).code).toBe("bad_request");
    expect(calls).toHaveLength(0);
  });

  it("sends a bearer token when credentials are set", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    const calls = fakeFetch({
      token: () => Response.json({ access_token: "tok", token_type: "Bearer" }),
      catalog: () => rpc(searchBag.result.structuredContent),
    });
    await searchCatalog({ query: "tote" });
    await searchCatalog({ query: "tote 2" });
    expect(calls.filter((c) => c.url.includes("access_token"))).toHaveLength(1);
    expect(calls.filter((c) => c.tool).every((c) => c.headers.Authorization === "Bearer tok")).toBe(true);
  });

  it("calls keyless when the token exchange fails", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    const calls = fakeFetch({
      token: () => new Response("", { status: 401 }),
      catalog: () => rpc(searchBag.result.structuredContent),
    });
    const result = await searchCatalog({ query: "tote" });
    expect(result.products.length).toBe(10);
    expect(calls.find((c) => c.tool)?.headers.Authorization).toBeUndefined();
  });

  it("remembers a failed token exchange for 60 seconds and calls keyless meanwhile", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-17T10:00:00Z"));
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    const calls = fakeFetch({
      token: () => new Response("", { status: 500 }),
      catalog: () => rpc(searchBag.result.structuredContent),
    });
    const exchanges = () => calls.filter((c) => c.url.includes("access_token")).length;
    try {
      await searchCatalog({ query: "tote 1" });
      await searchCatalog({ query: "tote 2" });
      expect(exchanges()).toBe(1);
      vi.setSystemTime(Date.parse("2026-11-17T10:01:01Z"));
      await searchCatalog({ query: "tote 3" });
      expect(exchanges()).toBe(2);
      expect(calls.filter((c) => c.tool).every((c) => c.headers.Authorization === undefined)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops a token the catalog refuses and retries once keyless", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    const calls = fakeFetch({
      token: () => Response.json({ access_token: "revoked" }),
      catalog: (_tool, _args, headers) =>
        headers.Authorization ? new Response("", { status: 401 }) : rpc(searchBag.result.structuredContent),
    });

    const result = await searchCatalog({ query: "tote" });
    expect(result.products.length).toBe(10);
    const toolCalls = calls.filter((c) => c.tool);
    expect(toolCalls.map((c) => c.headers.Authorization)).toEqual(["Bearer revoked", undefined]);

    // The next call goes keyless at once, with no new exchange.
    await searchCatalog({ query: "tote 2" });
    expect(calls.filter((c) => c.url.includes("access_token"))).toHaveLength(1);
    expect(calls.filter((c) => c.tool).at(-1)?.headers.Authorization).toBeUndefined();
  });
});

describe("getProduct", () => {
  it("passes `selected` and returns the product", async () => {
    const calls = fakeFetch({ catalog: () => rpc({ product: bagProduct() }) });
    const product = await getProduct(PRODUCT_ID, [{ name: "Color", label: "Black" }]);
    expect(product.id).toBe(PRODUCT_ID);
    expect(calls[0].tool).toBe("get_product");
    expect(calls[0].args?.catalog).toMatchObject({ id: PRODUCT_ID, selected: [{ name: "Color", label: "Black" }] });
  });

  it("maps a missing product to not_found", async () => {
    fakeFetch({ catalog: () => toolError("Product not found") });
    expect((await errorOf(getProduct(PRODUCT_ID))).code).toBe("not_found");
    fakeFetch({ catalog: () => rpc({}) });
    expect((await errorOf(getProduct("gid://shopify/p/other"))).code).toBe("not_found");
  });

  it("rejects an id that is not a catalog product id", async () => {
    expect((await errorOf(getProduct("https://evil.example"))).code).toBe("bad_request");
  });
});

describe("createCheckout", () => {
  const request = { productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 };

  it("re-checks the variant, then hands off with the catalog link when there is no token", async () => {
    const calls = fakeFetch({ catalog: () => lookupWith() });
    const result = await createCheckout(request, "8.8.8.8");
    expect(result).toEqual({ mode: "direct", continueUrl: CATALOG_CHECKOUT_URL, quantity: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].tool).toBe("lookup_catalog");
    expect(calls[0].args?.catalog).toMatchObject({ ids: [VARIANT_ID] });
  });

  it("throws variant_unavailable when the variant sold out", async () => {
    fakeFetch({ catalog: () => lookupWith({ availability: { available: false } }) });
    const error = await errorOf(createCheckout(request, null));
    expect(error.code).toBe("variant_unavailable");
  });

  it("throws variant_unavailable when the catalog no longer has the variant", async () => {
    fakeFetch({ catalog: () => rpc({ products: [] }) });
    expect((await errorOf(createCheckout(request, null))).code).toBe("variant_unavailable");
  });

  it("throws checkout_unavailable when it cannot re-check the variant", async () => {
    fakeFetch({ catalog: () => new Response("", { status: 503 }) });
    expect((await errorOf(createCheckout(request, null))).code).toBe("checkout_unavailable");
  });

  it("creates a UCP checkout when it has a token, a merchant domain and the buyer IP", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    const calls = fakeFetch({
      token: () => Response.json({ access_token: "tok" }),
      catalog: () => lookupWith(),
      merchant: () =>
        rpc({
          id: "chk_1",
          status: "incomplete",
          continue_url: "https://www.portlandleathergoods.com/checkouts/cn/abc",
          currency: "USD",
          totals: [
            { type: "subtotal", amount: 44000, display_text: "Subtotal" },
            { type: "tax", amount: 3520, display_text: "Tax" },
            { type: "total", amount: 47520, display_text: "Total" },
          ],
          expires_at: "2026-11-18T10:00:00Z",
        }),
    });
    const result = await createCheckout({ ...request, quantity: 2 }, "8.8.8.8");
    expect(result).toEqual({
      mode: "ucp",
      continueUrl: "https://www.portlandleathergoods.com/checkouts/cn/abc",
      quantity: 2,
      totals: {
        subtotal: { amount: 44000, currency: "USD" },
        tax: { amount: 3520, currency: "USD" },
        total: { amount: 47520, currency: "USD" },
      },
      expiresAt: "2026-11-18T10:00:00Z",
    });
    const merchantCall = calls.find((c) => c.tool === "create_checkout")!;
    expect(merchantCall.url).toBe("https://forgedleather.myshopify.com/api/ucp/mcp");
    expect(merchantCall.headers).toMatchObject({ Authorization: "Bearer tok", "Shopify-Buyer-IP": "8.8.8.8" });
    expect(merchantCall.args).toMatchObject({
      meta: { "ucp-agent": { profile: expect.any(String) } },
      checkout: { currency: "USD", line_items: [{ quantity: 2, item: { id: VARIANT_ID } }] },
    });
    expect(calls.some((c) => c.tool === "complete_checkout")).toBe(false);
  });

  it("falls back to the direct link when create_checkout fails", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    fakeFetch({
      token: () => Response.json({ access_token: "tok" }),
      catalog: () => lookupWith(),
      merchant: () => toolError("buyer email required"),
    });
    expect(await createCheckout(request, "8.8.8.8")).toEqual({
      mode: "direct",
      continueUrl: CATALOG_CHECKOUT_URL,
      quantity: 1,
    });
  });

  it("falls back when create_checkout returns a non-https link", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    fakeFetch({
      token: () => Response.json({ access_token: "tok" }),
      catalog: () => lookupWith(),
      merchant: () => rpc({ status: "incomplete", continue_url: "http://insecure.example/c" }),
    });
    expect((await createCheckout(request, "8.8.8.8")).mode).toBe("direct");
  });

  it("skips UCP without the buyer IP", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    const calls = fakeFetch({ token: () => Response.json({ access_token: "tok" }), catalog: () => lookupWith() });
    expect((await createCheckout(request, null)).mode).toBe("direct");
    expect(calls.some((c) => c.tool === "create_checkout")).toBe(false);
  });

  it("never sends checkout to a domain the client made up", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    const calls = fakeFetch({
      token: () => Response.json({ access_token: "tok" }),
      catalog: () => {
        const p = bagProduct();
        delete (p.variants[0].seller as Record<string, unknown>).domain;
        return rpc({ products: [p] });
      },
    });
    await createCheckout({ ...request, sellerDomain: "evil.myshopify.com" }, "8.8.8.8");
    expect(calls.some((c) => c.url.includes("evil.myshopify.com"))).toBe(false);
  });

  it("never hands back a checkout link the client sent", async () => {
    fakeFetch({ catalog: () => lookupWith({ checkout_url: undefined }) });
    const error = await errorOf(
      createCheckout({ ...request, checkoutUrl: "https://shop.example/buy/1:1?_gsid=x" }, null),
    );
    expect(error.code).toBe("checkout_unavailable");
    expect(error.message).not.toMatch(/invalid|oops|error/i);
  });

  it("says quantity 1 on the direct path, whatever the request asked, and keeps the link byte for byte", async () => {
    fakeFetch({ catalog: () => lookupWith() });
    const result = await createCheckout({ ...request, quantity: 3 }, null);
    expect(result).toEqual({ mode: "direct", continueUrl: CATALOG_CHECKOUT_URL, quantity: 1 });
    expect(result.continueUrl).toContain(":1?");
  });

  it("explains a variant that is not sold in US dollars", async () => {
    fakeFetch({ catalog: () => lookupWith({ price: { amount: 30000, currency: "CAD" } }) });
    const error = await errorOf(createCheckout(request, null));
    expect(error.code).toBe("variant_unavailable");
    expect(error.message).toMatch(/US dollars/);
    expect(error.message).not.toMatch(/catalog anymore/);
  });

  it("says the variant is gone when the catalog no longer has it", async () => {
    fakeFetch({ catalog: () => rpc({ products: [] }) });
    expect((await errorOf(createCheckout(request, null))).message).toMatch(/catalog anymore/);
  });

  it("rejects a variant that belongs to another product", async () => {
    const calls = fakeFetch({ catalog: () => lookupWith() });
    const error = await errorOf(createCheckout({ ...request, productId: "gid://shopify/p/someOtherProduct1" }, null));
    expect(error.code).toBe("bad_request");
    expect(calls.filter((c) => c.tool === "create_checkout")).toHaveLength(0);
  });

  it("goes on by variant ID when the lookup gives no product ID", async () => {
    fakeFetch({
      catalog: () => {
        const p = bagProduct();
        delete p.id;
        return rpc({ products: [p] });
      },
    });
    const result = await createCheckout({ ...request, productId: "gid://shopify/p/someOtherProduct1" }, null);
    expect(result.mode).toBe("direct");
  });

  it("re-checks keyless and hands off directly when the catalog refuses the token", async () => {
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_ID", "id");
    vi.stubEnv("SHOPIFY_CATALOG_CLIENT_SECRET", "secret");
    const calls = fakeFetch({
      token: () => Response.json({ access_token: "revoked" }),
      catalog: (_tool, _args, headers) => (headers.Authorization ? new Response("", { status: 401 }) : lookupWith()),
      merchant: () => rpc({ status: "incomplete", continue_url: "https://x.example/c" }),
    });
    expect(await createCheckout(request, "8.8.8.8")).toEqual({
      mode: "direct",
      continueUrl: CATALOG_CHECKOUT_URL,
      quantity: 1,
    });
    expect(calls.some((c) => c.tool === "create_checkout")).toBe(false);
  });

  it("rejects a bad request before calling Shopify", async () => {
    const calls = fakeFetch({});
    expect((await errorOf(createCheckout({ ...request, quantity: 0 }, null))).code).toBe("bad_request");
    expect((await errorOf(createCheckout({ ...request, variantId: "42" }, null))).code).toBe("bad_request");
    expect(calls).toHaveLength(0);
  });
});

describe("parseUcpCheckout", () => {
  it("leaves totals out when the merchant gives no subtotal and total", () => {
    expect(
      parseUcpCheckout(
        { status: "incomplete", continue_url: "https://x.example/c", totals: [{ type: "tax", amount: 1 }] },
        3,
      ),
    ).toEqual({ mode: "ucp", continueUrl: "https://x.example/c", quantity: 3 });
  });

  it("ignores a canceled checkout", () => {
    expect(parseUcpCheckout({ status: "canceled", continue_url: "https://x.example/c" }, 1)).toBeNull();
  });

  it("reports the quantity the merchant's line item states", () => {
    const content = {
      status: "incomplete",
      continue_url: "https://x.example/c",
      line_items: [{ item: { id: "gid://shopify/ProductVariant/1" }, quantity: 2 }],
    };
    expect(parseUcpCheckout(content, 5)?.quantity).toBe(2);
  });

  it("falls back to the requested quantity when the line item gives none we can use", () => {
    const base = { status: "incomplete", continue_url: "https://x.example/c" };
    for (const line_items of [undefined, [], [{ quantity: 0 }], [{ quantity: 1.5 }], [{ quantity: "2" }], ["x"]]) {
      expect(parseUcpCheckout({ ...base, line_items }, 3)?.quantity).toBe(3);
    }
  });
});
