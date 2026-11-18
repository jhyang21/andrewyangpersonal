/**
 * The kit's own words, and the /kit page's, must not sell, gush or crown a
 * product. Same rules as src/pica/features/banned-words.test.ts, plus the four
 * the brief adds (section 8) and "we" (the interface never says it).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/pica/components/kit", "src/app/projects/pica/kit"];

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
  /\bperfect\b/i,
  /\btop pick\b/i,
  /\brecommended\b/i,
  /\bwinner\b/i,
  /\bwe\b/i,
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    // src/app/projects/pica/kit/seed belongs to another part of the rebuild.
    if (statSync(path).isDirectory()) {
      if (path.replace(/\\/g, "/") !== "src/app/projects/pica/kit/seed") out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Text a file could show: string literals, template parts and JSX text. Comments are skipped. */
function textsIn(fileName: string, code: string): string[] {
  const kind = fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, kind);
  const texts: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isLiteralTypeNode(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) texts.push(node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) texts.push(node.text);
    else if (ts.isJsxText(node)) texts.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return texts.map((text) => text.trim()).filter(Boolean);
}

describe("kit copy", () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root));

  it("finds the kit's files", () => {
    expect(files.some((f) => f.endsWith("Button.tsx"))).toBe(true);
  });

  it("no kit string uses a banned word", () => {
    const hits: string[] = [];
    for (const path of files) {
      for (const text of textsIn(path, readFileSync(path, "utf8"))) {
        for (const pattern of BANNED) {
          if (pattern.test(text)) hits.push(`${path}: "${text}" matches ${pattern}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
