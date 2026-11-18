import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeKey, openaiKey, picaProvider, setRuntimeKey } from "./openai-key";

const PASTED = "sk-test-not-real-0000000000";
const FROM_ENV = "sk-test-env-not-real-1111111111";

afterEach(() => {
  clearRuntimeKey();
  vi.unstubAllEnvs();
});

describe("openaiKey", () => {
  it("is null with no env key and nothing pasted", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(openaiKey()).toBeNull();
    expect(picaProvider()).toBeNull();
  });

  it("uses a pasted key when the env has none", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    setRuntimeKey(PASTED);
    expect(openaiKey()).toBe(PASTED);
    expect(picaProvider()).not.toBeNull();
  });

  it("prefers the env key over a pasted one", () => {
    vi.stubEnv("OPENAI_API_KEY", FROM_ENV);
    setRuntimeKey(PASTED);
    expect(openaiKey()).toBe(FROM_ENV);
  });

  it("forgets the pasted key on clear, but keeps the env key", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    setRuntimeKey(PASTED);
    clearRuntimeKey();
    expect(openaiKey()).toBeNull();

    vi.stubEnv("OPENAI_API_KEY", FROM_ENV);
    setRuntimeKey(PASTED);
    clearRuntimeKey();
    expect(openaiKey()).toBe(FROM_ENV);
  });

  it("holds the key on globalThis, so every copy of the module sees it", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    setRuntimeKey(PASTED);
    expect((globalThis as Record<symbol, unknown>)[Symbol.for("pica.openaiKey")]).toBe(PASTED);
  });
});
