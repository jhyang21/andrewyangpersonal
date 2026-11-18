/**
 * Guard: saved decisions live under one key. Renaming it loses every
 * buyer's decisions, so the rebuild must keep it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, addSession, createSession } from "@/pica/lib/session";
import { resetStoreForTests } from "@/pica/lib/session/store";

const KEY = "shop-companion:sessions:v1";

describe("the storage key", () => {
  let data: Record<string, string>;

  beforeEach(() => {
    data = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => (data[key] = value),
        removeItem: (key: string) => delete data[key],
      },
    });
    resetStoreForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStoreForTests();
  });

  it(`is ${KEY}`, () => {
    expect(STORAGE_KEY).toBe(KEY);
  });

  it("is the only key the store writes", () => {
    addSession(createSession({ id: "s1", at: 1, title: "Bag" }));
    expect(Object.keys(data)).toEqual([KEY]);
    expect(data[KEY]).toContain('"s1"');
  });
});
