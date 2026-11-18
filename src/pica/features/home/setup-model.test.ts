import { describe, expect, it } from "vitest";
import { SETUP, keyProblem, setupStatusFrom } from "./setup-model";

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

describe("setupStatusFrom", () => {
  it("asks for a choice only when the server says it has no key", () => {
    expect(setupStatusFrom({ ok: true, data: { hasKey: false } })).toBe("needed");
    expect(setupStatusFrom({ ok: true, data: { hasKey: true } })).toBe("ready");
  });

  it("leaves Home as it was when the route refuses or answers oddly", () => {
    expect(setupStatusFrom({ ok: false })).toBe("ready");
    expect(setupStatusFrom({ ok: true, data: null })).toBe("ready");
  });
});
