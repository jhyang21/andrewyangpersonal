import { afterEach, describe, expect, it, vi } from "vitest";
import { OPENAI_KEY_HEADER } from "./constants";
import { keyFromRequest, picaProvider } from "./openai-key";

const FAKE_KEY = "sk-test-not-real-0000000000";
const FROM_ENV = "sk-test-env-not-real-1111111111";

function withHeader(value?: string): Request {
  const headers: Record<string, string> = value === undefined ? {} : { [OPENAI_KEY_HEADER]: value };
  return new Request("http://localhost/api/chat", { method: "POST", headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("keyFromRequest", () => {
  it("reads the key from its header", () => {
    expect(keyFromRequest(withHeader(FAKE_KEY))).toBe(FAKE_KEY);
  });

  it("trims spaces around the key", () => {
    expect(keyFromRequest(withHeader(`  ${FAKE_KEY}\t`))).toBe(FAKE_KEY);
  });

  it("is null without the header, or with an empty one", () => {
    expect(keyFromRequest(withHeader())).toBeNull();
    expect(keyFromRequest(withHeader(""))).toBeNull();
    expect(keyFromRequest(withHeader("   "))).toBeNull();
  });

  it("is null for anything not shaped like a key", () => {
    for (const value of [
      "pk-test-not-real-0000000000",
      "sk-short",
      "sk-test-not real-0000000000",
      `sk-${"x".repeat(198)}`,
      `Bearer ${FAKE_KEY}`,
    ]) {
      expect(keyFromRequest(withHeader(value)), value).toBeNull();
    }
  });

  it("ignores OPENAI_API_KEY in the env", () => {
    vi.stubEnv("OPENAI_API_KEY", FROM_ENV);
    expect(keyFromRequest(withHeader())).toBeNull();
    expect(keyFromRequest(withHeader(FAKE_KEY))).toBe(FAKE_KEY);
  });
});

describe("picaProvider", () => {
  it("is null without a key, even when the env holds one", () => {
    vi.stubEnv("OPENAI_API_KEY", FROM_ENV);
    expect(picaProvider(null)).toBeNull();
  });

  it("builds a provider for the key it is given", () => {
    expect(picaProvider(FAKE_KEY)).not.toBeNull();
  });
});
