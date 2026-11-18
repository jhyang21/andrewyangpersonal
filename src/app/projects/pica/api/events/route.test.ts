import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanProps } from "@/pica/lib/analytics/schema";
import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const good = {
  name: "checkout_initiated",
  sessionId: "0f8b6a1e-1111-4222-8333-444455556666",
  at: 1_700_000_000_000,
  props: { productId: "gid://shopify/p/abc", mode: "direct", count: 3, stale: false, reason: null },
};

afterEach(() => vi.restoreAllMocks());

describe("POST /api/events", () => {
  it("logs one JSON line and answers 204", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await post(good);
    expect(response.status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(log.mock.calls[0][0]));
    expect(line).toMatchObject({ type: "analytics", name: "checkout_initiated", props: good.props });
  });

  it("rejects an unknown event name", async () => {
    const response = await post({ ...good, name: "add_to_cart" });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
  });

  it("rejects free text, links and emails in props", async () => {
    for (const value of ["I want a bag", "https://shop.example/checkout?x=1", "a@b.co", "www.shop.example"]) {
      const response = await post({ ...good, props: { note: value } });
      expect(response.status, value).toBe(400);
    }
  });

  it("rejects bad JSON, an empty body and nested props", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post("")).status).toBe(400);
    expect((await post({ ...good, props: { nested: { a: 1 } } })).status).toBe(400);
  });

  it("accepts a null session ID", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect((await post({ ...good, sessionId: null })).status).toBe(204);
  });
});

describe("cleanProps", () => {
  it("drops unsafe props and keeps IDs, counts and enums", () => {
    expect(
      cleanProps({
        productId: "gid://shopify/p/abc",
        count: 2,
        ok: true,
        text: "free text here",
        url: "https://x.example",
        nan: Number.NaN,
        missing: undefined,
        object: {},
      }),
    ).toEqual({ productId: "gid://shopify/p/abc", count: 2, ok: true });
  });
});
