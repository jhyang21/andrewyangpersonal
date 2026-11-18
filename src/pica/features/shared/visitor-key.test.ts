/**
 * The tab's key store, with a stubbed sessionStorage (tests run in node, which
 * has none). Only obvious fake keys.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OPENAI_KEY_HEADER } from "@/pica/lib/pica/constants";
import { forgetVisitorKey, readVisitorKey, saveVisitorKey, visitorKeyHeaders } from "./visitor-key";

const FAKE_KEY = "sk-test-not-real-0000000000";

/** A sessionStorage stand-in backed by a Map. */
function memoryStorage(): Storage & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (name) => entries.get(name) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (name) => void entries.delete(name),
    setItem: (name, value) => void entries.set(name, String(value)),
  };
}

/** Storage that throws on every call, as a browser with site data blocked does. */
function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("visitor key", () => {
  it("saves, reads and forgets the key in sessionStorage, under one entry", () => {
    const storage = memoryStorage();
    vi.stubGlobal("sessionStorage", storage);
    const local = memoryStorage();
    vi.stubGlobal("localStorage", local);

    expect(readVisitorKey()).toBeNull();
    expect(saveVisitorKey(FAKE_KEY)).toBe(true);
    expect(readVisitorKey()).toBe(FAKE_KEY);
    expect(storage.entries.size).toBe(1);
    expect([...storage.entries.values()]).toEqual([FAKE_KEY]);
    expect(local.entries.size).toBe(0);

    forgetVisitorKey();
    expect(readVisitorKey()).toBeNull();
    expect(storage.entries.size).toBe(0);
  });

  it("sends the header only when the tab holds a key", () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    expect(visitorKeyHeaders()).toEqual({});
    saveVisitorKey(FAKE_KEY);
    expect(visitorKeyHeaders()).toEqual({ [OPENAI_KEY_HEADER]: FAKE_KEY });
    forgetVisitorKey();
    expect(visitorKeyHeaders()).toEqual({});
  });

  it("finds no key and says the save failed when storage throws", () => {
    vi.stubGlobal("sessionStorage", throwingStorage());
    expect(readVisitorKey()).toBeNull();
    expect(saveVisitorKey(FAKE_KEY)).toBe(false);
    expect(() => forgetVisitorKey()).not.toThrow();
    expect(visitorKeyHeaders()).toEqual({});
  });

  it("finds no key and says the save failed when the storage itself can't be reached", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("Access is denied.", "SecurityError");
      },
    });
    try {
      expect(readVisitorKey()).toBeNull();
      expect(saveVisitorKey(FAKE_KEY)).toBe(false);
      expect(() => forgetVisitorKey()).not.toThrow();
    } finally {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });

  it("finds no key where there is no sessionStorage at all, as on the server", () => {
    expect(typeof sessionStorage).toBe("undefined");
    expect(readVisitorKey()).toBeNull();
    expect(saveVisitorKey(FAKE_KEY)).toBe(false);
    expect(visitorKeyHeaders()).toEqual({});
  });

  it("never touches localStorage or cookies", () => {
    const code = readFileSync("src/pica/features/shared/visitor-key.ts", "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");
    expect(code).not.toMatch(/localStorage|document\.cookie|cookies/);
  });
});
