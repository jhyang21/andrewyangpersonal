import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rate-limit";

function limiter(maxTrackedClients = 100) {
  let time = 0;
  const limit = createRateLimiter({ requests: 3, windowMs: 60_000, maxTrackedClients, now: () => time });
  return { limit, advance: (ms: number) => (time += ms) };
}

describe("createRateLimiter", () => {
  it("allows the set number of requests per window, then says how long to wait", () => {
    const { limit, advance } = limiter();
    for (let i = 0; i < 3; i++) expect(limit.check("a")).toEqual({ ok: true });
    advance(15_500);
    expect(limit.check("a")).toEqual({ ok: false, retryAfterSeconds: 45 });
    expect(limit.check("b")).toEqual({ ok: true });
    advance(44_500);
    expect(limit.check("a")).toEqual({ ok: true });
  });

  it("keeps memory bounded", () => {
    const { limit, advance } = limiter(2);
    limit.check("a");
    limit.check("b");
    limit.check("c");
    expect(limit.size()).toBeLessThanOrEqual(2);
    advance(60_000);
    limit.check("d");
    expect(limit.size()).toBe(1);
  });

  it("evicts the oldest window, not a client whose window just restarted", () => {
    const { limit, advance } = limiter(2);
    limit.check("a"); // a's first window starts at 0
    advance(59_990);
    limit.check("b"); // b's window starts at 59_990
    advance(20);
    limit.check("a"); // a's window ended, so a new one starts at 60_010
    advance(5);
    limit.check("c"); // full, nothing ended: b's window is the oldest, so b goes
    // b starts over with a full allowance. Had a gone instead, b's third call here would be its fourth.
    for (let i = 0; i < 3; i++) expect(limit.check("b")).toEqual({ ok: true });
  });

  it("forgets every client on reset", () => {
    const { limit } = limiter();
    limit.check("a");
    limit.reset();
    expect(limit.size()).toBe(0);
  });
});

describe("clientKey", () => {
  it("reads the first forwarded IP, then x-real-ip", () => {
    const req = (headers: Record<string, string>) => new Request("http://localhost/", { headers });
    expect(clientKey(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientKey(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientKey(req({}))).toBe("unknown");
  });
});
