import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/pica/lib/types";
import { CATEGORY_WORDS } from "./categories";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("CATEGORY_WORDS", () => {
  it("has one and many words for every category", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_WORDS[category].one).toMatch(/^[A-Z]/);
      expect(CATEGORY_WORDS[category].many).toMatch(/^[A-Z]/);
    }
    expect(CATEGORY_WORDS.backpack).toEqual({ one: "Backpack", many: "Backpacks" });
  });

  it("is the only place the screens spell out category words", () => {
    const own = join("src", "pica", "features", "shared", "categories.ts");
    const others = sources(join("src", "pica", "features")).filter((path) => path !== own);
    for (const path of others) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/backpack:\s*"/);
    }
  });
});
