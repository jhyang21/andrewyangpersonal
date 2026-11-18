/**
 * Guard: the product is "Pica" everywhere (brief, section 8), never "Shop
 * Companion". Reads the raw source of src/app and src/features, tests left
 * out. The storage key `shop-companion:sessions:v1` and the package name are
 * spelled with a hyphen, so they do not match and stay as they are.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/app/projects/pica", "src/pica/features"];
const OLD_NAME = /shop\s+companion/i;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe("the product's name", () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root));

  it("finds the source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("matches the old name in words, not the storage key", () => {
    expect(OLD_NAME.test("Shop Companion can't see orders")).toBe(true);
    expect(OLD_NAME.test("shop  companion")).toBe(true);
    expect(OLD_NAME.test("shop-companion:sessions:v1")).toBe(false);
  });

  it('no file says "Shop Companion"', () => {
    const hits: string[] = [];
    for (const path of files) {
      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (OLD_NAME.test(line)) hits.push(`${relative(process.cwd(), path)}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
