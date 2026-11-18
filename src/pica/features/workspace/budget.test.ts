import { describe, expect, it } from "vitest";
import { parseBudget, parseUsd } from "./budget";

describe("budget input", () => {
  it("reads dollar amounts and blanks", () => {
    expect(parseUsd("$1,200")).toEqual({ ok: true, value: 1200 });
    expect(parseUsd(" 150 ")).toEqual({ ok: true, value: 150 });
    expect(parseUsd("")).toEqual({ ok: true });
  });

  it("refuses words, signs and huge amounts instead of dropping the budget", () => {
    expect(parseUsd("two hundred").ok).toBe(false);
    expect(parseUsd("-50").ok).toBe(false);
    expect(parseUsd("1e3").ok).toBe(false);
    expect(parseUsd("250000").ok).toBe(false);
  });

  it("names the field that is wrong", () => {
    const result = parseBudget("50", "two hundred");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.min).toBeUndefined();
      expect(result.errors.max).toMatch(/amount in dollars/);
    }
    expect(parseBudget("50", "200")).toEqual({ ok: true, minUsd: 50, maxUsd: 200 });
  });
});
