/**
 * Guard: analytics events stay wired to the files that send them.
 *
 * What it checks, by reading the code of src/features and src/app (tests left
 * out):
 * - `SENDERS`: for each event in `EVENTS`, the exact files with a
 *   `track("<event>", ...)` call. Dropping a call, or moving it to another
 *   file, fails until the map is updated.
 * - `ERROR_PLACES`: `error_shown` goes out from `ErrorNotice` and `ErrorState`.
 *   For each file, the `where` value of each use, repeats kept. A screen that
 *   stops showing one of its errors fails here, even when another use with
 *   the same `where` stays.
 * - No `track` call sends a name outside `EVENTS`.
 *
 * What it does not see: a `track` imported under another name, a wrapper
 * around `track`, an event name held in a variable or built at run time, a
 * `where` that is not a string literal, or whether a call runs, and how many
 * times. Those need a test of the code that sends them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { EVENTS, type EventName } from "@/pica/lib/events";

const ROOTS = ["src/pica/features", "src/app/projects/pica"];

/** Each event and the files that must send it, no more and no fewer. */
const SENDERS: Record<EventName, string[]> = {
  goal_stated: ["src/pica/features/shared/startDecision.ts"],
  question_answered: ["src/pica/features/workspace/useChatActions.ts"],
  question_skipped: ["src/pica/features/workspace/useChatActions.ts"],
  requirement_edited: ["src/pica/features/workspace/useCanvasEdit.ts"],
  recommendation_viewed: ["src/pica/features/workspace/OptionsStage.tsx"],
  comparison_viewed: ["src/pica/features/workspace/CompareStage.tsx"],
  evidence_viewed: ["src/pica/features/parts/EvidenceSheet.tsx"],
  review_link_opened: ["src/pica/features/parts/EvidenceSheet.tsx"],
  checkout_initiated: ["src/pica/features/decide/useDecide.ts"],
  purchase_completed: ["src/pica/features/decision/actions.ts"],
  session_saved: ["src/pica/features/decision/actions.ts"],
  session_resumed: ["src/pica/features/workspace/useWorkspace.ts"],
  no_purchase_decided: ["src/pica/features/decision/actions.ts"],
  confidence_submitted: ["src/pica/features/decision/useConfidenceCheck.ts"],
  satisfaction_submitted: ["src/pica/features/saved/useCheckIn.ts"],
  error_shown: [
    "src/pica/features/parts/ErrorNotice.tsx",
    "src/pica/features/shell/useStorageNotice.ts",
  ],
};

/**
 * Each file that shows `ErrorNotice` or `ErrorState`, and the `where` value of
 * each use, sorted, repeats kept: dropping one of several uses fails too.
 */
const ERROR_PLACES: Record<string, string[]> = {
  "src/pica/features/browse/BrowseScreen.tsx": ["browse"],
  // Lost decision. With no option chosen Decide points to Options, never an error.
  "src/pica/features/decide/DecideScreen.tsx": ["decide"],
  // Failed load, choice problem; failed checkout.
  "src/pica/features/decide/DecideView.tsx": ["checkout", "decide", "decide"],
  "src/pica/features/decision/DoneScreen.tsx": ["done"],
  // Pica not set up (the whole chat); a failed reply.
  "src/pica/features/workspace/ChatPanel.tsx": ["chat", "chat"],
  "src/pica/features/workspace/Workspace.tsx": ["workspace"],
};

const ERROR_COMPONENTS = new Set(["ErrorNotice", "ErrorState"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path.replace(/\\/g, "/"));
  }
  return out;
}

function parse(fileName: string, code: string): ts.SourceFile {
  const kind = fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, kind);
}

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function literalText(node: ts.Node | undefined): string | null {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}

/** Names passed as a string literal to a `track(...)` call. */
export function trackedIn(fileName: string, code: string): string[] {
  const names: string[] = [];
  walk(parse(fileName, code), (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "track") {
      const name = literalText(node.arguments[0]);
      if (name !== null) names.push(name);
    }
  });
  return names;
}

/** Literal `where` values passed to `<ErrorNotice>` or `<ErrorState>`, sorted, one per use. */
export function errorPlacesIn(fileName: string, code: string): string[] {
  const places: string[] = [];
  walk(parse(fileName, code), (node) => {
    if (!ts.isJsxSelfClosingElement(node) && !ts.isJsxOpeningElement(node)) return;
    if (!ts.isIdentifier(node.tagName) || !ERROR_COMPONENTS.has(node.tagName.text)) return;
    for (const attribute of node.attributes.properties) {
      if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name) || attribute.name.text !== "where") continue;
      const value = literalText(attribute.initializer);
      if (value !== null) places.push(value);
    }
  });
  return places.sort();
}

describe("analytics coverage", () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root)).map((path) => ({ path, code: readFileSync(path, "utf8") }));

  const sendersFound = new Map<string, Set<string>>();
  for (const { path, code } of files) {
    for (const name of trackedIn(path, code)) {
      if (!sendersFound.has(name)) sendersFound.set(name, new Set());
      sendersFound.get(name)!.add(path);
    }
  }

  it("the scanner finds track calls, split over lines too", () => {
    const code = 'track("a", {}); track(\n  "b",\n  { x: 1 },\n); other("c"); obj.track("d"); track(name);';
    expect(trackedIn("x.ts", code)).toEqual(["a", "b"]);
  });

  it("the scanner finds literal `where` values on the error components only", () => {
    const code =
      '<><ErrorNotice where="chat" error={e} /><ErrorState\n  where="done"\n>x</ErrorState>' +
      '<ErrorNotice where={place} error={e} /><Banner where="nope" /><ErrorNotice where="chat" error={e} /></>';
    expect(errorPlacesIn("x.tsx", code)).toEqual(["chat", "chat", "done"]);
  });

  it("every event is sent from exactly the files pinned for it", () => {
    const found = Object.fromEntries(EVENTS.map((name) => [name, [...(sendersFound.get(name) ?? [])].sort()]));
    const pinned = Object.fromEntries(EVENTS.map((name) => [name, [...SENDERS[name]].sort()]));
    expect(found).toEqual(pinned);
  });

  it("each screen still shows its errors, so each still sends error_shown", () => {
    const found: Record<string, string[]> = {};
    for (const { path, code } of files) {
      const places = errorPlacesIn(path, code);
      if (places.length > 0) found[path] = places;
    }
    expect(found).toEqual(ERROR_PLACES);
  });

  it("nothing sends a name outside EVENTS", () => {
    const known = new Set<string>(EVENTS);
    expect([...sendersFound.keys()].filter((name) => !known.has(name))).toEqual([]);
  });
});
