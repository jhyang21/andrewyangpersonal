import { afterEach, describe, expect, it, vi } from "vitest";
import { buyerIpFrom, checkoutRequestSchema, errorResponse, searchParamsSchema } from "./api";
import { MESSAGES, rateLimitedMessage, shopifyError, statusForCode, toShopifyError } from "./errors";

describe("errorResponse", () => {
  it("answers { error } with a fitting status and Retry-After", async () => {
    const res = errorResponse(shopifyError("rate_limited", undefined, 7));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
    expect(await res.json()).toEqual({ error: { code: "rate_limited", message: MESSAGES.rate_limited, retryAfterSeconds: 7 } });
  });

  it("hides unknown errors behind a plain message", async () => {
    const res = errorResponse(new Error("socket hang up at 10.0.0.1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("unknown");
    expect(body.error.message).not.toContain("socket");
  });

  it("maps codes to statuses", () => {
    expect(statusForCode("bad_request")).toBe(400);
    expect(statusForCode("not_found")).toBe(404);
    expect(statusForCode("variant_unavailable")).toBe(409);
    expect(statusForCode("catalog_unavailable")).toBe(503);
    expect(statusForCode("checkout_unavailable")).toBe(503);
  });
});

describe("unknown errors", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs only the error's name on the server, and tells the buyer sorry", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new TypeError("fetch failed for https://shop.example/c?token=abc with Bearer sk_1"));
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toBe(MESSAGES.unknown);
    expect(log.mock.calls).toEqual([["[shopify] unexpected error: TypeError"]]);
  });

  it("adds a short cause code, and nothing else from the cause", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    toShopifyError(new TypeError("fetch failed", { cause: { code: "ECONNRESET", message: "at https://x.example" } }));
    toShopifyError(new TypeError("fetch failed", { cause: { code: "https://evil.example/?token=1" } }));
    toShopifyError(new TypeError("fetch failed", { cause: { code: "A".repeat(41) } }));
    toShopifyError(new TypeError("fetch failed", { cause: { code: 42 } }));
    toShopifyError(new TypeError("fetch failed", { cause: "ECONNRESET" }));
    expect(log.mock.calls).toEqual([
      ["[shopify] unexpected error: TypeError (cause ECONNRESET)"],
      ["[shopify] unexpected error: TypeError"],
      ["[shopify] unexpected error: TypeError"],
      ["[shopify] unexpected error: TypeError"],
      ["[shopify] unexpected error: TypeError"],
    ]);
  });

  it("logs a non-Error by its type only", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    toShopifyError({ body: "secret request body" });
    expect(log.mock.calls).toEqual([["[shopify] unexpected error: object"]]);
  });

  it("does not log known Shopify errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    toShopifyError(shopifyError("rate_limited"));
    expect(log).not.toHaveBeenCalled();
  });
});

describe("buyer-facing messages", () => {
  it("use plain words: no codes, no 'invalid', no 'oops'", () => {
    for (const message of Object.values(MESSAGES)) {
      expect(message).not.toMatch(/invalid|oops|forbidden|error|successfully|simply|just|_/i);
      expect(message.endsWith(".")).toBe(true);
    }
  });

  it("tell a buyer over their own limit the real wait", () => {
    expect(rateLimitedMessage(1)).toBe("You're going a little fast. Try again in 1 second.");
    expect(rateLimitedMessage(6)).toBe("You're going a little fast. Try again in 6 seconds.");
    expect(rateLimitedMessage(6)).not.toMatch(/invalid|oops|error|just|_/i);
  });
});

describe("schemas", () => {
  it("accepts a normal search and rejects an empty one", () => {
    expect(searchParamsSchema.safeParse({ query: "tote", category: "bag", maxPriceUsd: 200 }).success).toBe(true);
    expect(searchParamsSchema.safeParse({ query: "", category: "luggage" }).success).toBe(true);
    expect(searchParamsSchema.safeParse({ query: "" }).success).toBe(false);
    expect(searchParamsSchema.safeParse({ query: "x", category: "shoes" }).success).toBe(false);
    expect(searchParamsSchema.safeParse({ query: "x", minPriceUsd: 300, maxPriceUsd: 100 }).success).toBe(false);
    expect(searchParamsSchema.safeParse({ query: "x", limit: 11 }).success).toBe(false);
  });

  it("checks checkout ids and quantity", () => {
    const ok = {
      productId: "gid://shopify/p/abc123",
      variantId: "gid://shopify/ProductVariant/123",
      quantity: 1,
    };
    expect(checkoutRequestSchema.safeParse(ok).success).toBe(true);
    expect(checkoutRequestSchema.safeParse({ ...ok, quantity: 1.5 }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...ok, variantId: "gid://shopify/Product/1" }).success).toBe(false);
  });
});

describe("buyerIpFrom", () => {
  it("takes the first x-forwarded-for entry when it looks like an IP", () => {
    expect(buyerIpFrom(new Headers({ "x-forwarded-for": "8.8.8.8, 10.0.0.1" }))).toBe("8.8.8.8");
    expect(buyerIpFrom(new Headers({ "x-forwarded-for": "2606:4700::1111" }))).toBe("2606:4700::1111");
    expect(buyerIpFrom(new Headers({ "x-forwarded-for": "not-an-ip" }))).toBeNull();
    expect(buyerIpFrom(new Headers())).toBeNull();
  });

  const ip = (value: string) => buyerIpFrom(new Headers({ "x-forwarded-for": value }));

  it("keeps public addresses", () => {
    for (const value of ["8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700::1111", "2001:4860:4860:0:0:0:0:8888", "2002:808:808::1", "192.0.1.1", "198.20.0.1", "2a00:1450::1", "3ffe::1", "2001:200::1"]) {
      expect(ip(value)).toBe(value);
    }
  });

  it("sends IPv6 forms that carry a public IPv4 address as that address, dotted", () => {
    expect(ip("::ffff:8.8.8.8")).toBe("8.8.8.8");
    expect(ip("::ffff:808:808")).toBe("8.8.8.8");
    expect(ip("::ffff:0:8.8.8.8")).toBe("8.8.8.8");
    expect(ip("::8.8.8.8")).toBe("8.8.8.8");
    expect(ip("64:ff9b::808:808")).toBe("8.8.8.8");
  });

  it("allows only global unicast IPv6 (2000::/3), less documentation and protocol space", () => {
    for (const value of ["1000::1", "4000::1", "2001:db8:1::1", "2001::1", "2001:1ff::1", "3fff::1", "3fff:fff::1", "64:ff9b:1::808:808", "2002:c058:6301::1"]) {
      expect(ip(value)).toBeNull();
    }
  });

  it("drops loopback, link-local and private IPv4 addresses", () => {
    for (const value of ["127.0.0.1", "127.8.9.10", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.10.1", "0.0.0.0", "100.64.0.1"]) {
      expect(ip(value)).toBeNull();
    }
  });

  it("drops loopback, link-local and private IPv6 addresses, mapped IPv4 included", () => {
    for (const value of ["::1", "::", "0:0:0:0:0:0:0:1", "fe80::1", "FEBF::abcd", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:c0a8:101"]) {
      expect(ip(value)).toBeNull();
    }
  });

  it("drops other reserved IPv4 ranges and parts with a leading zero", () => {
    for (const value of ["192.88.99.1", "192.0.0.8", "198.18.0.1", "198.19.255.255", "192.0.2.1", "198.51.100.7", "203.0.113.5", "224.0.0.1", "255.255.255.255", "010.0.0.1", "8.8.8.08", "08.8.8.8"]) {
      expect(ip(value)).toBeNull();
    }
  });

  it("drops IPv6 forms that carry a non-public IPv4 address, and other reserved IPv6 ranges", () => {
    for (const value of [
      "::10.0.0.1",
      "::127.0.0.1",
      "::ffff:0:10.0.0.1",
      "::ffff:0:7f00:1",
      "64:ff9b::10.0.0.1",
      "64:ff9b::c0a8:101",
      "2002:a00:1::1",
      "2002:c0a8:101::1",
      "fec0::1",
      "feff::1",
      "100::1",
      "100:0:0:0:ffff::1",
      "2001:db8::1",
      "ff02::1",
      "::ffff:010.0.0.1",
    ]) {
      expect(ip(value)).toBeNull();
    }
  });

  it("drops text that only looks like IPv6", () => {
    for (const value of [":::", "1::2::3", "12345::1", "1:2:3:4:5:6:7:8:9", "fe80::1%eth0", "::ffff:999.0.0.1"]) {
      expect(ip(value)).toBeNull();
    }
  });
});
