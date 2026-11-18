import { describe, expect, it } from "vitest";
import { SETUP, keyProblem } from "./setup-model";

describe("keyProblem", () => {
  it("asks for a key when the field is empty", () => {
    expect(keyProblem("")).toBe(SETUP.emptyKey);
    expect(keyProblem("   ")).toBe(SETUP.emptyKey);
  });

  it("refuses what can't be an OpenAI key", () => {
    expect(keyProblem("hello")).toBe(SETUP.badShape);
    expect(keyProblem("sk-short")).toBe(SETUP.badShape);
    expect(keyProblem("sk-test not real 00000000000")).toBe(SETUP.badShape);
    expect(keyProblem(`sk-${"a".repeat(198)}`)).toBe(SETUP.badShape);
  });

  it("passes a key of the right shape, ignoring spaces around it", () => {
    expect(keyProblem("sk-test-not-real-0000000000")).toBeNull();
    expect(keyProblem("  sk-test-not-real-0000000000\n")).toBeNull();
  });
});

describe("the key hint", () => {
  it("says where the key goes, that nothing saves it, and how to limit the risk", () => {
    expect(SETUP.keyHint).toMatch(/stays in this tab/);
    expect(SETUP.keyHint).toMatch(/only to OpenAI, through this site's server/);
    expect(SETUP.keyHint).toMatch(/Nothing saves it/);
    expect(SETUP.keyHint).toMatch(/low spending limit/);
    expect(SETUP.keyHint).toMatch(/revoke it/);
  });
});
