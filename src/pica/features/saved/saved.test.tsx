import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createSession, sessionReducer } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import { CHECK_IN, type Met } from "./checkin-model";
import { CheckInFormView } from "./CheckInSheet";
import { SavedCardMenu } from "./SavedCardMenu";
import { SavedView, type SavedViewProps } from "./SavedScreen";
import { groupSessions } from "./saved-model";
import { GROUPS, SAVED, checkInSavedStatus, savedTitleId } from "./saved-screen-model";

const noop = () => {};

function plain(id: string, updatedAt: number): DecisionSession {
  return { ...createSession({ id, at: 1, title: `Decision ${id}` }), updatedAt };
}

function bought(id: string, withOutcome = false): DecisionSession {
  const started = sessionReducer(plain(id, 50), { type: "checkout_started", productId: "p1", variantId: "v", at: 2 });
  const done = sessionReducer(started, { type: "checkout_answered", bought: true, at: 3 });
  return withOutcome ? { ...done, outcome: { satisfied: "yes", requirements: [], submittedAt: 77 } } : done;
}

function render(sessions: DecisionSession[], props: Partial<SavedViewProps> = {}) {
  return renderToStaticMarkup(
    <SavedView
      ready
      groups={groupSessions(Object.fromEntries(sessions.map((s) => [s.id, s])))}
      askCardId={null}
      renderReturnCheck={(session) => <p>ASK {session.id}</p>}
      onRemove={noop}
      onCheckIn={noop}
      removeSheetId="remove-sheet"
      checkInSheetId="checkin-sheet"
      {...props}
    />,
  );
}

describe("SavedView", () => {
  it("has one h1 that can take focus, and the browser-only line", () => {
    const out = render([plain("a", 1)]);
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1 id="saved-heading" tabindex="-1"[^>]*>Saved decisions<\/h1>/);
    expect(out).toContain(SAVED.line);
  });

  it("has one hidden status line from the start, empty until something is saved", () => {
    const quiet = render([plain("a", 1)]);
    expect(quiet.match(/role="status"/g)).toHaveLength(1);
    expect(quiet).toContain('<p role="status" class="sr-only"></p>');
    expect(render([], { ready: false })).toContain('<p role="status" class="sr-only"></p>');
    const said = render([plain("a", 1)], { status: checkInSavedStatus("Decision a") });
    expect(said).toContain('<p role="status" class="sr-only">Check-in saved for Decision a.</p>');
  });

  it("never puts the status role on a button or link", () => {
    expect(render([bought("b")], { status: "x" })).not.toMatch(/<(button|a)\b[^>]*role="status"/);
  });

  it("shows grey shapes until the store is read", () => {
    const out = render([], { ready: false });
    expect(out).toContain('aria-busy="true"');
    expect(out).not.toContain(SAVED.emptyTitle);
  });

  it("is plain when empty: Pica resting, no decisions yet, and Start a decision", () => {
    const out = render([]);
    expect(out).toContain('data-pose="resting"');
    expect(out).toContain(SAVED.emptyTitle);
    expect(out).toMatch(/href="\/projects\/pica"[^>]*><span[^>]*>Start a decision</);
  });

  it("shows the groups in order with no counts, and Bought's line", () => {
    const declined = sessionReducer(plain("d", 5), { type: "decided", status: "declined", at: 6 });
    const out = render([declined, bought("b"), plain("a", 9)]);
    const order = ["Open", "Bought", "Not buying"].map((title) => out.indexOf(`>${title}</h2>`));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(out).not.toMatch(/<h2[^>]*>[^<]*\(\d+\)/);
    expect(out).toContain(GROUPS.bought.note!.replace(/'/g, "&#x27;"));
    expect(out).not.toContain(">Saved for later</h2>");
  });

  it("gives each card a thumbnail named for its product, title, stage facts, date and one action", () => {
    const out = render([seedDecision(1)]);
    expect(out).toContain('aria-label="Commuter Pack 24L, no photo"');
    expect(out).toMatch(new RegExp(`<h3 id="${savedTitleId("seed-decision")}" tabindex="-1"`));
    expect(out).toContain("4 needs · 4 options · Comparing 3");
    expect(out).toContain("Updated ");
    expect(out).toMatch(/href="\/projects\/pica\/d\/seed-decision"[^>]*><span[^>]*>Resume<span class="sr-only">: /);
    expect(out).not.toContain(SAVED.checkIn);
  });

  it("puts Remove in a menu named for the card, not on the card", () => {
    const out = render([plain("a", 1)]);
    expect(out).toContain('aria-label="More for Decision a"');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toMatch(/<div id="[^"]+" hidden=""/);
  });

  it("opens closed decisions, and gives bought ones Check in or Edit check-in", () => {
    const out = render([bought("b")]);
    expect(out).toMatch(/href="\/projects\/pica\/d\/b"[^>]*><span[^>]*>Open</);
    expect(out).toMatch(/aria-controls="checkin-sheet" aria-haspopup="dialog"[^>]*><span[^>]*>Check in</);
    const edited = render([bought("c", true)]);
    expect(edited).toContain(SAVED.editCheckIn);
    expect(edited).toMatch(/Check-in saved [^<]+\./);
  });

  it("asks Did you buy it on one card only", () => {
    const out = render([plain("a", 2), plain("b", 1)], { askCardId: "b" });
    expect(out.match(/ASK /g)).toHaveLength(1);
    expect(out).toContain("ASK b");
  });

  it("has no purple until the empty state's one action", () => {
    expect(render([seedDecision(1), bought("b")])).not.toMatch(/(?<![:\w-])bg-shop-purple(?![\w-])/);
    expect(render([]).match(/(?<![:\w-])bg-shop-purple(?![\w-])/g)).toHaveLength(1);
  });
});

describe("SavedCardMenu", () => {
  it("opens to Remove, which names its card and points at the sheet", () => {
    const out = renderToStaticMarkup(<SavedCardMenu title="A bag" onRemove={noop} sheetId="remove-sheet" defaultOpen />);
    expect(out).toContain('aria-expanded="true"');
    expect(out).not.toContain('hidden=""');
    expect(out).toMatch(/aria-controls="remove-sheet" aria-haspopup="dialog"[^>]*><span[^>]*>Remove<span class="sr-only">: A bag<\/span>/);
  });
});

describe("CheckInFormView", () => {
  const items = [{ id: "n1", kind: "must_have", source: "stated", text: "Fits a 16-inch laptop" }] as never;

  function form(extra: { missingOverall?: boolean; met?: Met } = {}) {
    return renderToStaticMarkup(
      <CheckInFormView
        items={items}
        isMet={(_, value) => extra.met !== undefined && value === extra.met}
        onAnswer={noop}
        satisfied={null}
        onOverall={noop}
        missingOverall={extra.missingOverall ?? false}
        note=""
        onNote={noop}
        onSave={noop}
      />,
    );
  }

  it("asks about each stated must-have, then overall, then a note", () => {
    const out = form();
    const at = [CHECK_IN.needsHeading, "Fits a 16-inch laptop", CHECK_IN.overallHeading, CHECK_IN.noteLabel].map((t) =>
      out.indexOf(t),
    );
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(at[0]).toBeGreaterThan(-1);
    expect(out).toContain('role="group" aria-labelledby="met-n1"');
  });

  it("says the note stays in this browser, and never says we", () => {
    const out = form();
    expect(out).toContain(CHECK_IN.noteHint);
    expect(out).not.toMatch(/\bwe\b/i);
  });

  it("marks the picked answer as pressed", () => {
    expect(form({ met: false })).toMatch(/aria-pressed="true"[^>]*>[\s\S]*?No</);
  });

  it("asks for the overall answer through an alert only after Save", () => {
    expect(form()).not.toContain('role="alert"');
    expect(form({ missingOverall: true })).toContain(`role="alert" class="text-body text-critical">${CHECK_IN.missingOverall}`);
  });
});
