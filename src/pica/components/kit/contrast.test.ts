import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, luminance } from "./contrast";

/** The colour tokens as src/pica/styles.css defines them, so the test follows any change there. */
function tokens(): Record<string, string> {
  const css = readFileSync("src/pica/styles.css", "utf8");
  const out: Record<string, string> = {};
  for (const match of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    out[match[1]] = match[2];
  }
  return out;
}

const t = tokens();

describe("contrast formula", () => {
  it("reads hex and gives the known end points", () => {
    expect(hexToRgb("#666362")).toEqual([102, 99, 98]);
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 10);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 10);
  });
});

describe("token pairs the brief relies on", () => {
  it("defines ink-soft as #666362 and keeps the Shop tokens", () => {
    expect(t["ink-soft"]).toBe("#666362");
    expect(t["ink-muted"]).toBe("#787574");
    expect(t["canvas"]).toBe("#f2f4f5");
    expect(t["purple-tint"]).toBe("#eeeaff");
  });

  it("ink-soft on canvas is 5.40:1, over the 4.5:1 AA bar", () => {
    // The sum, step by step:
    //   ink-soft #666362 -> linear r 0.1329, g 0.1248, b 0.1221
    //   L = 0.2126*0.1329 + 0.7152*0.1248 + 0.0722*0.1221 = 0.1263
    //   canvas #F2F4F5  -> linear r 0.8879, g 0.9047, b 0.9131
    //   L = 0.2126*0.8879 + 0.7152*0.9047 + 0.0722*0.9131 = 0.9017
    //   ratio = (0.9017 + 0.05) / (0.1263 + 0.05) = 0.9517 / 0.1763 = 5.40
    expect(luminance(t["ink-soft"])).toBeCloseTo(0.1263, 3);
    expect(luminance(t["canvas"])).toBeCloseTo(0.9017, 3);
    const ratio = contrastRatio(t["ink-soft"], t["canvas"]);
    expect(ratio).toBeCloseTo(5.4, 1);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("ink-soft also passes on white, and ink-muted passes on white only", () => {
    expect(contrastRatio(t["ink-soft"], t["surface"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["ink-muted"], t["surface"])).toBeGreaterThanOrEqual(4.5);
    // Why ink-soft exists: ink-muted on canvas fails AA text.
    expect(contrastRatio(t["ink-muted"], t["canvas"])).toBeLessThan(4.5);
  });

  it("a 1px ink-muted input edge clears 3:1 on white and on canvas; hairline does not", () => {
    expect(contrastRatio(t["ink-muted"], t["surface"])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t["ink-muted"], t["canvas"])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t["hairline"], t["surface"])).toBeLessThan(3);
  });

  it("the purple focus ring clears 3:1 on white and canvas", () => {
    expect(contrastRatio(t["shop-purple"], t["surface"])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t["shop-purple"], t["canvas"])).toBeGreaterThanOrEqual(3);
  });

  it("ink text passes on the tinted fills, where neither muted colour does", () => {
    for (const bg of ["purple-soft", "purple-tint", "caution-bg"]) {
      expect(contrastRatio(t["ink"], t[bg])).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(t["ink-muted"], t["purple-soft"])).toBeLessThan(4.5);
  });

  it("purple-soft fill alone is too faint to mark a selected state on white", () => {
    expect(contrastRatio(t["purple-soft"], t["surface"])).toBeLessThan(3);
  });
});
