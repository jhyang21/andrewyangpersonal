import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/pica/lib/types";
import { STALE_AFTER_MS } from "@/pica/features/shared/format";
import { afterLoad, matchesSelection, needsRecheck, sameSelection } from "./checks";

const withVariant = (options: { name: string; label: string }[] | null) =>
  ({ id: "p1", variants: options ? [{ id: "v1", options }] : [] }) as unknown as CatalogProduct;

describe("matchesSelection", () => {
  const chosen = [
    { name: "Color", label: "Black" },
    { name: "Size", label: "Large" },
  ];

  it("matches when the returned variant has every chosen option", () => {
    expect(matchesSelection(withVariant(chosen), chosen)).toBe(true);
  });

  it("does not match when the route fell back to another variant", () => {
    expect(matchesSelection(withVariant([{ name: "Color", label: "Grey" }, chosen[1]]), chosen)).toBe(false);
  });

  it("does not match when no variant came back", () => {
    expect(matchesSelection(withVariant(null), chosen)).toBe(false);
  });

  it("anything matches when nothing was chosen", () => {
    expect(matchesSelection(withVariant(null), undefined)).toBe(true);
  });
});

describe("needsRecheck", () => {
  const T0 = 1_700_000_000_000;
  const MIN = 60_000;

  it("rechecks at 11 minutes, not right after, and again 30 minutes later", () => {
    // Loaded at T0; the server stamped the record T0 as well.
    expect(needsRecheck(T0, T0 + STALE_AFTER_MS - 1, T0)).toBe(false);
    expect(needsRecheck(T0, T0 + 11 * MIN, T0)).toBe(true);
    // The recheck lands at T0 + 11 min with a new server time.
    const reloaded = T0 + 11 * MIN;
    expect(needsRecheck(reloaded, reloaded + 5_000, reloaded)).toBe(false);
    // The buyer stays on the page for another 30 minutes.
    expect(needsRecheck(reloaded, reloaded + 30 * MIN, reloaded)).toBe(true);
  });

  it("a clock 20 minutes fast rechecks once, then lets the buyer continue", () => {
    const clock = (serverTime: number) => serverTime + 20 * MIN;
    // First load: the record looks 20 minutes old to this clock.
    expect(needsRecheck(T0, clock(T0) + 1_000, null)).toBe(true);
    // The fresh copy still looks old, but it loaded seconds ago by the same clock.
    expect(needsRecheck(T0 + 2_000, clock(T0 + 3_000), clock(T0 + 2_000))).toBe(false);
    // Two minutes later it still does not loop: age is counted on the buyer's clock alone.
    expect(needsRecheck(T0 + 2_000, clock(T0 + 2_000) + 2 * MIN, clock(T0 + 2_000))).toBe(false);
    // Past the limit it checks again.
    expect(needsRecheck(T0 + 2_000, clock(T0 + 2_000) + 6 * MIN, clock(T0 + 2_000))).toBe(true);
  });
});

describe("afterLoad", () => {
  const black = [{ name: "Color", label: "Black" }];
  const grey = [{ name: "Color", label: "Grey" }];

  it("shows a product that matches the choice", () => {
    expect(afterLoad(withVariant(black), black, null)).toEqual({ kind: "matched" });
  });

  it("goes back to the last good choice when a new choice has no variant", () => {
    expect(afterLoad(withVariant(grey), black, { selected: grey })).toEqual({ kind: "revert", to: grey });
  });

  it("says the choice is gone when the failed choice is the one already shown", () => {
    // A recheck, or the page shown again, for the choice that was fine before.
    expect(afterLoad(withVariant(grey), black, { selected: black })).toEqual({ kind: "gone", to: grey });
  });

  it("says the choice is gone on a first load, with what the catalog returned", () => {
    expect(afterLoad(withVariant(grey), black, null)).toEqual({ kind: "gone", to: grey });
    expect(afterLoad(withVariant(null), black, null)).toEqual({ kind: "gone", to: undefined });
  });
});

describe("sameSelection", () => {
  it("ignores order, and treats no choice as an empty one", () => {
    const a = [
      { name: "Color", label: "Black" },
      { name: "Size", label: "Large" },
    ];
    expect(sameSelection(a, [...a].reverse())).toBe(true);
    expect(sameSelection(undefined, [])).toBe(true);
    expect(sameSelection(a, a.slice(0, 1))).toBe(false);
  });
});
