import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/pica/lib/types";
import { createTries } from "./freshness";
import { STALE_AFTER_MS } from "./format";

const T0 = 1_700_000_000_000;
const product = (id: string, fetchedAt: number) => ({ id, fetchedAt }) as unknown as CatalogProduct;

describe("createTries", () => {
  it("tries each stale product once, even when the clock runs fast", () => {
    // The client clock is 20 minutes ahead, so even a copy fetched just now looks old.
    const fastNow = T0 + 2 * STALE_AFTER_MS;
    const tries = createTries();
    expect(tries.takeDue([product("p1", T0 - STALE_AFTER_MS), product("p2", T0)], fastNow).map((p) => p.id)).toEqual([
      "p1",
      "p2",
    ]);
    // The fresh copy comes back with the server's time: still "old" to this clock.
    expect(tries.takeDue([product("p1", T0 + 1), product("p2", T0 + 1)], fastNow)).toEqual([]);
  });

  it("tries again after the panel was hidden and shown", () => {
    const tries = createTries();
    const at = T0 + STALE_AFTER_MS + 1;
    expect(tries.takeDue([product("p1", T0)], at).map((p) => p.id)).toEqual(["p1"]);
    expect(tries.takeDue([product("p1", T0)], at)).toEqual([]);
    tries.hidden();
    expect(tries.takeDue([product("p1", T0)], at).map((p) => p.id)).toEqual(["p1"]);
  });

  it("leaves fresh records alone", () => {
    expect(createTries().takeDue([product("p1", T0)], T0 + 1000)).toEqual([]);
  });
});
