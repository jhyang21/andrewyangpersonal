import { describe, expect, it } from "vitest";
import { catalogRouteLimiter, checkoutRouteLimiter, clientKey, createRouteLimiter } from "./rate-limit";

function limiter(options: { burst?: number; refillMs?: number; maxTrackedClients?: number } = {}) {
  let time = 0;
  const limit = createRouteLimiter({
    burst: options.burst ?? 3,
    refillMs: options.refillMs ?? 1_000,
    maxTrackedClients: options.maxTrackedClients ?? 100,
    now: () => time,
  });
  return { limit, at: (ms: number) => (time = ms) };
}

function drain(limit: { check(key: string): { ok: boolean } }, key: string, times: number) {
  for (let i = 0; i < times; i++) expect(limit.check(key).ok).toBe(true);
}

describe("createRouteLimiter", () => {
  it("allows a burst, then one call per refill period, and says how long to wait", () => {
    const { limit, at } = limiter({ burst: 3, refillMs: 6_000 });
    drain(limit, "a", 3);
    expect(limit.check("a")).toEqual({ ok: false, retryAfterSeconds: 6 });
    at(4_500);
    expect(limit.check("a")).toEqual({ ok: false, retryAfterSeconds: 2 });
    at(6_000);
    expect(limit.check("a")).toEqual({ ok: true });
    expect(limit.check("a").ok).toBe(false);
  });

  it("never holds more than the burst, however long a client waits", () => {
    const { limit, at } = limiter({ burst: 3 });
    limit.check("a");
    at(3_600_000);
    drain(limit, "a", 3);
    expect(limit.check("a").ok).toBe(false);
  });

  it("counts each client on its own", () => {
    const { limit } = limiter();
    drain(limit, "a", 3);
    expect(limit.check("a").ok).toBe(false);
    expect(limit.check("b").ok).toBe(true);
  });

  it("keeps a blocked client that keeps calling, and drops the client seen longest ago", () => {
    const { limit } = limiter({ burst: 3, maxTrackedClients: 2 });
    limit.check("a");
    limit.check("b");
    drain(limit, "a", 2);
    expect(limit.check("a").ok).toBe(false);
    limit.check("c"); // Full: b was seen longest ago, so b goes, not a.
    expect(limit.size()).toBe(2);
    expect(limit.check("a").ok).toBe(false);
    // b was forgotten, so it starts again with a full burst (it had 2 left).
    drain(limit, "b", 3);
  });

  it("drops idle clients before one that is still limited", () => {
    const { limit, at } = limiter({ burst: 3, refillMs: 10_000, maxTrackedClients: 2 });
    drain(limit, "b", 3);
    expect(limit.check("b").ok).toBe(false);
    limit.check("a");
    at(10_000); // a is full again (idle); b has one call back.
    limit.check("c");
    expect(limit.size()).toBe(2);
    expect(limit.check("b").ok).toBe(true);
    expect(limit.check("b").ok).toBe(false);
  });

  it("stays within its client limit: 10 clients on a limit of 2 leave the first with a full burst", () => {
    const { limit } = limiter({ burst: 3, maxTrackedClients: 2 });
    drain(limit, "first", 2);
    for (let i = 0; i < 9; i++) limit.check(`other-${i}`);
    expect(limit.size()).toBe(2);
    drain(limit, "first", 3);
  });

  it("refuses a call while polling but serves it the moment it is due", () => {
    const { limit, at } = limiter({ burst: 10, refillMs: 1_000 });
    drain(limit, "a", 10);
    for (let t = 100; t < 1_000; t += 100) {
      at(t);
      expect(limit.check("a").ok).toBe(false);
    }
    at(1_000);
    expect(limit.check("a").ok).toBe(true);
  });

  it("survives a clock that steps back: the wait is at most one refill period", () => {
    const { limit, at } = limiter({ burst: 3, refillMs: 6_000 });
    at(3_600_000);
    drain(limit, "a", 3);
    at(0); // The clock steps back an hour.
    const refused = limit.check("a");
    expect(refused).toEqual({ ok: false, retryAfterSeconds: 6 });
    at(6_000);
    expect(limit.check("a").ok).toBe(true);
    // A client that never ran dry is not hurt.
    expect(limit.check("b").ok).toBe(true);
  });

  it("starts over after reset", () => {
    const { limit } = limiter();
    drain(limit, "a", 3);
    limit.reset();
    expect(limit.check("a").ok).toBe(true);
  });
});

describe("the route limiters", () => {
  it("serve 10 catalog calls at once and 3 checkouts at once per client", () => {
    catalogRouteLimiter.reset();
    checkoutRouteLimiter.reset();
    drain(catalogRouteLimiter, "x", 10);
    expect(catalogRouteLimiter.check("x").ok).toBe(false);
    drain(checkoutRouteLimiter, "x", 3);
    expect(checkoutRouteLimiter.check("x").ok).toBe(false);
    catalogRouteLimiter.reset();
    checkoutRouteLimiter.reset();
  });
});

describe("clientKey", () => {
  const key = (value: string) => clientKey(new Headers({ "x-forwarded-for": value }));

  it("uses the first forwarded address, then x-real-ip, then one shared key", () => {
    expect(key("8.8.8.8, 10.0.0.1")).toBe("8.8.8.8");
    expect(clientKey(new Headers({ "x-real-ip": "8.8.4.4" }))).toBe("8.8.4.4");
    expect(clientKey(new Headers())).toBe("unknown");
  });

  it("keys IPv6 addresses on their /64, so one network shares one budget", () => {
    const a = key("2606:4700:10:20::1");
    const b = key("2606:4700:10:20:abcd:ef01:2345:6789");
    const other = key("2606:4700:10:21::1");
    expect(a).toBe("2606:4700:10:20::/64");
    expect(b).toBe(a);
    expect(other).not.toBe(a);

    const { limit } = limiter({ burst: 3 });
    drain(limit, a, 3);
    expect(limit.check(b).ok).toBe(false);
    expect(limit.check(other).ok).toBe(true);
  });

  it("keys IPv6 forms that carry IPv4 on that IPv4 address, so each buyer has their own budget", () => {
    expect(key("::ffff:8.8.8.8")).toBe("8.8.8.8");
    expect(key("::ffff:808:404")).toBe("8.8.4.4");
    expect(key("::ffff:0:1.1.1.1")).toBe("1.1.1.1");
    expect(key("::9.9.9.9")).toBe("9.9.9.9");
    expect(key("64:ff9b::1.0.0.1")).toBe("1.0.0.1");
    expect(key("::ffff:8.8.8.8")).not.toBe(key("::ffff:1.1.1.1"));
    expect(key("64:ff9b::8.8.8.8")).not.toBe(key("64:ff9b::1.1.1.1"));
  });

  it("drops a port from IPv4, and puts anything that is not an address under one key", () => {
    expect(key("8.8.8.8:51234")).toBe("8.8.8.8");
    for (const value of ["not-an-ip", "x".repeat(5_000), "[2606:4700::1]:443", "8.8.8.8:", "010.0.0.1"]) {
      expect(key(value)).toBe("invalid");
    }
  });
});
