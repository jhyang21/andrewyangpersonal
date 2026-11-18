import { beforeEach, describe, expect, it } from "vitest";
import { firstTime, resetOnceForTests } from "./once";
import { cleanProps, isSafePropString } from "./schema";

describe("isSafePropString", () => {
  it.each([
    "gid://shopify/p/abc123",
    "gid://shopify/ProductVariant/42",
    "3f2b6c1e-8a4d-4c1b-9b7e-2a1d5e6f7a8b",
    "too_expensive",
    "direct",
    "rate_limited",
  ])("keeps the ID or enum %s", (value) => {
    expect(isSafePropString(value)).toBe(true);
  });

  it.each([
    "shop.example/checkout",
    "shop.example",
    "www.shop.example",
    "https://shop.example/checkout",
    "//shop.example/cart",
    "shop.example%2Fcheckout",
    "example.com?cart=1",
    "mailto:me",
    "buyer@example.com",
    "I want a bag",
    "gid://shopify/p/1?checkout=https",
  ])("refuses the link or free text %s", (value) => {
    expect(isSafePropString(value)).toBe(false);
  });

  it("drops a scheme-less link from props and keeps the rest", () => {
    expect(cleanProps({ productId: "gid://shopify/p/1", url: "shop.example/checkout" })).toEqual({
      productId: "gid://shopify/p/1",
    });
  });
});

describe("firstTime", () => {
  beforeEach(() => resetOnceForTests());

  it("says yes once per key per page load", () => {
    expect(firstTime("session_resumed:s1")).toBe(true);
    expect(firstTime("session_resumed:s1")).toBe(false);
    expect(firstTime("session_resumed:s2")).toBe(true);
  });
});
