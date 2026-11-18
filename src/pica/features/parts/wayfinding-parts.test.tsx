import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import type { CanvasItem, DecisionSession, DecisionStatus } from "@/pica/lib/types";
import { CanvasItemEditor } from "./CanvasItemEditor";
import { placeFocusAfterRemove } from "./canvas-item-focus";
import { editButtonId, editorLabels, editorSave, focusAfterRemove } from "./canvas-item-model";
import { DecisionMenu } from "./DecisionMenu";
import { decisionMenuActions, hasMenu } from "./decision-menu-model";
import { JourneyPath } from "./JourneyPath";

const noop = () => undefined;
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const seed = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const withStatus = (status: DecisionStatus): DecisionSession => ({ ...seed, decision: { status } });
const noNeeds: DecisionSession = {
  ...seed,
  canvas: { ...seed.canvas, items: seed.canvas.items.filter((item) => item.kind === "open_question") },
};

describe("decisionMenuActions", () => {
  it("offers nothing until there is a need, even with an open question", () => {
    expect(decisionMenuActions(noNeeds)).toEqual({ save: false, end: false });
    expect(hasMenu(decisionMenuActions(noNeeds))).toBe(false);
  });

  it("offers both while open, only ending once saved, and nothing once bought or ended", () => {
    expect(decisionMenuActions(seed)).toEqual({ save: true, end: true });
    expect(decisionMenuActions(withStatus("saved"))).toEqual({ save: false, end: true });
    expect(hasMenu(decisionMenuActions(withStatus("bought")))).toBe(false);
    expect(hasMenu(decisionMenuActions(withStatus("declined")))).toBe(false);
  });
});

describe("DecisionMenu", () => {
  it("renders nothing with no needs", () => {
    expect(html(<DecisionMenu session={noNeeds} onSave={noop} onEnd={noop} />)).toBe("");
  });

  it("is a named toggle over a hidden list, with the end sheet closed", () => {
    const out = html(<DecisionMenu session={seed} onSave={noop} onEnd={noop} />);
    expect(out).toContain('aria-label="Save or end this decision"');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toMatch(/aria-controls="([^"]+)"[\s\S]*<div id="\1" hidden=""/);
    expect(out).not.toContain('role="menu"');
    expect(out).not.toContain("End this decision without buying?");
  });

  it("lists both actions when open, ending with a dialog to follow", () => {
    const out = html(<DecisionMenu session={seed} onSave={noop} onEnd={noop} defaultOpen />);
    expect(out).toContain('aria-expanded="true"');
    expect(out).toContain(">Save for later<");
    expect(out).toMatch(/aria-haspopup="dialog"[^>]*>[\s\S]*?End without buying/);
  });

  it("leaves out Save for later once saved", () => {
    const out = html(<DecisionMenu session={withStatus("saved")} onSave={noop} onEnd={noop} defaultOpen />);
    expect(out).not.toContain("Save for later");
    expect(out).toContain("End without buying");
  });
});

describe("editorSave", () => {
  const stated: CanvasItem = { id: "n1", kind: "must_have", text: "Fits a 16-inch laptop", source: "stated" };
  const guess: CanvasItem = { id: "g1", kind: "must_have", text: "Holds up in rain", source: "inferred" };

  it("keeps the form open on blank words", () => {
    expect(editorSave(stated, "   ")).toEqual({ kind: "blank" });
  });

  it("sends nothing when the buyer's own words are unchanged", () => {
    expect(editorSave(stated, " Fits a 16-inch laptop ")).toEqual({ kind: "unchanged" });
  });

  it("sends a change, and makes an unchanged guess the buyer's", () => {
    expect(editorSave(stated, "Fits a 17-inch laptop")).toEqual({
      kind: "edit",
      edit: { kind: "item_changed", id: "n1", text: "Fits a 17-inch laptop" },
    });
    expect(editorSave(guess, "Holds up in rain")).toEqual({
      kind: "edit",
      edit: { kind: "item_changed", id: "g1", text: "Holds up in rain" },
    });
  });

  it("names the need on every button", () => {
    expect(editorLabels(guess).remove).toBe("Remove “Holds up in rain”");
  });
});

describe("focus after Remove", () => {
  it("gives each Edit button an id the list can find", () => {
    expect(editButtonId("needs", "seed-need-1")).toBe("needs-edit-seed-need-1");
    expect(editButtonId("needs", "a b:c")).toBe("needs-edit-a_b_c");
  });

  it("moves to the next row, else the one before, else the heading", () => {
    expect(focusAfterRemove(["a", "b", "c"], "a")).toBe("b");
    expect(focusAfterRemove(["a", "b", "c"], "b")).toBe("c");
    expect(focusAfterRemove(["a", "b", "c"], "c")).toBe("b");
    expect(focusAfterRemove(["a"], "a")).toBeNull();
    expect(focusAfterRemove(["a"], "z")).toBeNull();
  });

  // A page stand-in: the ids on it, and a record of what took focus.
  function page(onPage: string[]) {
    const focused: string[] = [];
    const find = (id: string) => (onPage.includes(id) ? { focus: () => focused.push(id) } : null);
    return { focused, find };
  }
  const list = { scope: "needs", ids: ["a", "b"], headingId: "needs-heading" };

  it("focuses the next row's Edit button when it is on the page", () => {
    const { focused, find } = page(["needs-edit-a", "needs-edit-b", "needs-heading"]);
    placeFocusAfterRemove({ ...list, removedId: "a" }, find);
    expect(focused).toEqual(["needs-edit-b"]);
  });

  it("focuses the heading when the next row is open as a form", () => {
    const { focused, find } = page(["needs-edit-a", "needs-heading"]);
    placeFocusAfterRemove({ ...list, removedId: "a" }, find);
    expect(focused).toEqual(["needs-heading"]);
  });

  it("focuses the heading when no row is left", () => {
    const { focused, find } = page(["needs-edit-a", "needs-heading"]);
    placeFocusAfterRemove({ ...list, ids: ["a"], removedId: "a" }, find);
    expect(focused).toEqual(["needs-heading"]);
  });
});

describe("CanvasItemEditor", () => {
  const [stated, , guess] = seed.canvas.items;

  it("shows a stated need with its tag, Edit and Remove, and no Confirm", () => {
    const out = html(<CanvasItemEditor item={stated} onEdit={() => true} />);
    expect(out).toContain("Fits a 16-inch laptop");
    expect(out).toContain('aria-label="Edit “Fits a 16-inch laptop”"');
    expect(out).toContain('aria-label="Remove “Fits a 16-inch laptop”"');
    expect(out).not.toContain(">Confirm<");
  });

  it("puts the given id on the Edit button", () => {
    const out = html(<CanvasItemEditor item={stated} onEdit={() => true} editButtonId="needs-edit-seed-need-1" />);
    const edit = /<button[^>]*id="needs-edit-seed-need-1"[^>]*>/.exec(out)?.[0] ?? "";
    expect(edit).toContain('aria-label="Edit “Fits a 16-inch laptop”"');
  });

  it("offers Confirm for a guess, and locks every control while Pica replies", () => {
    const out = html(<CanvasItemEditor item={guess} onEdit={() => true} locked />);
    expect(out).toContain(">Confirm<");
    expect(out).toContain('aria-label="Confirm “Holds up in rain”"');
    expect(out.match(/<button[^>]*disabled=""/g)).toHaveLength(3);
  });

  it("opens as a form with the words, Save change and Cancel", () => {
    const out = html(<CanvasItemEditor item={guess} onEdit={() => true} defaultEditing />);
    expect(out).toContain("<form");
    expect(out).toContain('value="Holds up in rain"');
    expect(out).toContain('maxLength="200"');
    expect(out).toContain(">Save change<");
    expect(out).toContain(">Cancel<");
  });
});

describe("JourneyPath", () => {
  it("is the kit's stage path: four links with facts and the current step", () => {
    const out = html(<JourneyPath session={seed} current="compare" />);
    expect(out).toContain('aria-label="Decision stages"');
    expect(out.match(/<a /g)).toHaveLength(4);
    expect(out).toContain('aria-current="step"');
    expect(out).toContain("4 needs");
    expect(out).toContain("Comparing 3");
    expect(out).toContain("Nothing chosen");
    expect(out).not.toMatch(/%/);
  });

  it("renders the same links with a Needs handler, inside a wrapper that takes no room", () => {
    const plain = html(<JourneyPath session={seed} current="options" />);
    const handled = html(<JourneyPath session={seed} current="options" onNeeds={noop} />);
    expect(plain.startsWith("<nav")).toBe(true);
    expect(handled).toBe(`<div class="contents">${plain}</div>`);
    expect(handled).toContain(`href="/projects/pica/d/${seed.id}?view=canvas"`);
  });
});
