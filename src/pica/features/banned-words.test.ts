/**
 * The app's own words must not sell or gush. Scans every string literal,
 * template string and JSX text in src/app, src/features and src/components.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/app/projects/pica", "src/pica/features", "src/pica/components"];

const BANNED: RegExp[] = [
  /\bbest\b/i,
  /\bhurry\b/i,
  /\bonly \S+ left\b/i,
  /\bdon'?t miss\b/i,
  /\blimited time\b/i,
  /\bsuccessfully\b/i,
  /\boops\b/i,
  /\bsimply\b/i,
  /\bjust\b/i,
  /\beasy\b/i,
  /\d+\s?%\s?(match|fit)/i,
  /\bperfect match\b/i,
  /\bperfect\b/i,
  /\btop pick\b/i,
  /\brecommended\b/i,
  /\bwinner\b/i,
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Every piece of text a file could show: string literals, template parts and JSX text. */
export function textsIn(fileName: string, code: string): string[] {
  const file = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const texts: string[] = [];
  const visit = (node: ts.Node) => {
    // Import paths and type-only strings are not copy.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isLiteralTypeNode(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) texts.push(node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) texts.push(node.text);
    else if (ts.isJsxText(node)) texts.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return texts.map((text) => text.trim()).filter(Boolean);
}

describe("banned words in the app's copy", () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root));

  it("finds the source files, the kit included", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((path) => path.startsWith(join("src", "pica", "components")))).toBe(true);
  });

  it("catches the words the brief bans", () => {
    for (const text of ["A perfect fit", "Our top pick", "Recommended for you", "The winner"]) {
      expect(BANNED.some((pattern) => pattern.test(text)), text).toBe(true);
    }
    // Whole words only.
    expect(BANNED.some((pattern) => pattern.test("imperfect stitching"))).toBe(false);
  });

  it("the scanner reads strings, templates and JSX text", () => {
    const texts = textsIn("x.tsx", 'const a = "one"; const b = `two ${a} three`; const c = <p>four</p>;');
    expect(texts).toEqual(["one", "two", "three", "four"]);
  });

  it("no file uses a banned word", () => {
    const hits: string[] = [];
    for (const path of files) {
      for (const text of textsIn(path, readFileSync(path, "utf8"))) {
        for (const pattern of BANNED) {
          if (pattern.test(text)) hits.push(`${relative(process.cwd(), path)}: "${text}" matches ${pattern}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
