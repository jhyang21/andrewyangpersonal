import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import { PICA_MESSAGES } from "@/pica/lib/pica/constants";
import type { CanvasItem, PicaQuestion } from "@/pica/lib/types";
import { CanvasPanel } from "./CanvasPanel";
import { CANVAS, needRowId } from "./canvas-panel-model";
import { ChatPanel } from "./ChatPanel";
import { ChatThread } from "./ChatThread";
import { CONFIRM_CARD, ConfirmGuessCard } from "./ConfirmGuessCard";
import { WorkspaceLoading } from "./Workspace";
import { QUESTION_CARD, QuestionCard } from "./QuestionCard";
import type { ThreadRow } from "./thread-model";
import type { WorkspaceState } from "./useWorkspace";
import type { WorkspaceView } from "./views";

const noop = () => undefined;
const yes = () => true;
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const seed = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const canvas = seed.canvas;
const guess: CanvasItem = canvas.items.find((item) => item.source === "inferred")!;

/** No `role` on a button or a link: a status sits beside the control, never on it. */
function expectNoRoleOnControls(out: string) {
  expect(out).not.toMatch(/<(button|a)\b[^>]*\brole=/);
}

const question: PicaQuestion = {
  question: "How do you get to work?",
  why: "A bike commute needs a bag that sits close.",
  options: ["Bike", "Train", "Walk"],
};

describe("QuestionCard", () => {
  const props = { id: "call-1", question, number: 2, live: true, onAnswer: noop, onSkip: noop, onOpenNeeds: noop };

  it("shows the count, the question, why it matters, the answers and Skip while open", () => {
    const out = html(<QuestionCard {...props} state={{ kind: "open" }} />);
    expect(out).toContain("Question 2 of up to 4");
    expect(out).toMatch(/<h3 id="question-call-1"[^>]*>How do you get to work\?<\/h3>/);
    // The card is named by its question.
    expect(out).toMatch(/^<article aria-labelledby="question-call-1"/);
    expect(out).toContain(QUESTION_CARD.why);
    for (const option of question.options) expect(out).toContain(`>${option}</button>`);
    expect(out).toContain(QUESTION_CARD.skip);
    expect(out).not.toContain('disabled=""');
    expectNoRoleOnControls(out);
  });

  it("turns the answers off when the question is not live", () => {
    const out = html(<QuestionCard {...props} live={false} state={{ kind: "open" }} />);
    expect(out.match(/disabled=""/g)?.length).toBe(question.options.length + 1);
  });

  it("shows the answer and a way to change it once answered", () => {
    const out = html(<QuestionCard {...props} state={{ kind: "answered", answer: "Bike" }} />);
    expect(out).toContain(QUESTION_CARD.answerLead);
    expect(out).toContain("Bike");
    expect(out).toContain(QUESTION_CARD.change);
    expect(out).not.toContain(QUESTION_CARD.skip);
  });

  it("lets the answered line take focus by script, with no tab stop", () => {
    const answered = html(<QuestionCard {...props} state={{ kind: "answered", answer: "Bike" }} />);
    expect(answered).toMatch(/<p tabindex="-1"[^>]*><span[^>]*>Your answer: <\/span>Bike<\/p>/);
    const skipped = html(<QuestionCard {...props} state={{ kind: "skipped" }} />);
    expect(skipped).toMatch(/<p tabindex="-1"[^>]*>You skipped this question\.<\/p>/);
  });

  it("says a skipped question was skipped", () => {
    const out = html(<QuestionCard {...props} state={{ kind: "skipped" }} />);
    expect(out).toContain(QUESTION_CARD.skipped);
    expect(out).toContain(QUESTION_CARD.change);
  });
});

describe("ConfirmGuessCard", () => {
  const card = { toolCallId: "u-1", rows: [{ item: guess, state: "open" as const }], more: 0 };

  it("names each guess on its Confirm and Edit buttons, with the guess tag", () => {
    const out = html(<ConfirmGuessCard card={card} locked={false} onConfirm={yes} onEdit={noop} onSeeAll={noop} />);
    expect(out).toContain(CONFIRM_CARD.title);
    expect(out).toContain(`aria-label="Confirm “${guess.text}”"`);
    expect(out).toContain(`aria-label="Edit “${guess.text}”"`);
    expect(out).toContain("Pica&#x27;s guess");
    expect(out).toMatch(/<p id="[^"]+" tabindex="-1"/);
    expect(out).not.toContain(CONFIRM_CARD.seeAll);
    expectNoRoleOnControls(out);
  });

  it("turns the buttons off while Pica replies", () => {
    const out = html(<ConfirmGuessCard card={card} locked onConfirm={yes} onEdit={noop} onSeeAll={noop} />);
    expect(out.match(/disabled=""/g)?.length).toBe(2);
  });

  it("says where each guess stands once settled, and links to the rest", () => {
    const settled = {
      toolCallId: "u-1",
      rows: [
        { item: guess, state: "confirmed" as const },
        { item: { ...guess, id: "other" }, state: "changed" as const },
      ],
      more: 2,
    };
    const out = html(<ConfirmGuessCard card={settled} locked={false} onConfirm={yes} onEdit={noop} onSeeAll={noop} />);
    expect(out).toContain(CONFIRM_CARD.confirmed);
    expect(out).toContain(CONFIRM_CARD.changed);
    expect(out).not.toContain(`aria-label="Confirm`);
    expect(out).toContain(CONFIRM_CARD.seeAll);
  });
});

describe("CanvasPanel", () => {
  const props = { canvas, locked: false, onEdit: yes, scope: "rail" };

  it("shows the heading, the groups in order and the add buttons", () => {
    const out = html(<CanvasPanel {...props} />);
    expect(out).toMatch(/<h2 id="rail-needs-title" tabindex="-1"[^>]*>Your needs<\/h2>/);
    expect(out).toContain(CANVAS.line);
    const order = ["Your goal", "Budget", "Must-haves", "Nice to have", "Still open"].map((title) =>
      out.indexOf(`>${title}</h3>`),
    );
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(out).toContain("Add a must-have");
    expect(out).toContain("Add a nice-to-have");
    expect(out).not.toContain(CANVAS.locked);
    expectNoRoleOnControls(out);
  });

  it("keeps ids apart by scope and gives each need a row id", () => {
    const sheet = html(<CanvasPanel {...props} scope="sheet" showHeading={false} />);
    expect(sheet).not.toContain("rail-");
    expect(sheet).not.toContain("<h2");
    expect(sheet).toContain(`aria-label="${CANVAS.title}"`);
    for (const item of canvas.items) expect(sheet).toContain(`id="${needRowId("sheet", item.id)}"`);
  });

  it("marks the category chosen", () => {
    const out = html(<CanvasPanel {...props} />);
    expect(out).toMatch(/aria-pressed="true"[^>]*>[\s\S]*?Backpack/);
  });

  it("says why it is locked while Pica replies, in plain text, and turns every control off", () => {
    const out = html(<CanvasPanel {...props} locked />);
    expect(out).toContain(CANVAS.locked);
    expect(out).toContain('<fieldset disabled=""');
    expect(out).not.toMatch(new RegExp(`role="status"[^>]*>${CANVAS.locked}`));
  });

  it("opens the need asked for with its form showing", () => {
    const item = canvas.items[0];
    const out = html(<CanvasPanel {...props} openItem={{ id: item.id, n: 1 }} />);
    expect(out).toMatch(new RegExp(`id="${needRowId("rail", item.id)}"[\\s\\S]*?<form`));
  });
});

describe("ChatThread", () => {
  const base = {
    sessionId: seed.id,
    canvas,
    busy: false,
    isLive: () => true,
    onAnswer: noop,
    onSkip: noop,
    onConfirm: yes,
    onOpenNeeds: noop,
  };
  const rows: ThreadRow[] = [
    { kind: "user", key: "m1-0", text: "A backpack for my commute" },
    { kind: "pica", key: "m2-0", text: "I can help with that." },
    { kind: "confirm", key: "m2-1-confirm", update: { toolCallId: "u-1", added: [guess], guesses: [guess] } },
    { kind: "note", key: "m2-2", text: "Comparing 2 options", target: "compare" },
    { kind: "question", key: "m2-3", toolCallId: "q-1", question, number: 1, state: { kind: "open" } },
  ];

  it("labels who said what, and keeps the status off the note's link", () => {
    const out = html(<ChatThread {...base} rows={rows} />);
    expect(out).toContain("You said: </span>A backpack for my commute");
    expect(out).toContain("Pica said: </span>I can help with that.");
    expect(out).toContain('role="status"');
    expect(out).toContain(`href="/projects/pica/d/${seed.id}?view=compare"`);
    expect(out).toContain(CONFIRM_CARD.title);
    expect(out).toContain(question.question);
    expectNoRoleOnControls(out);
  });

  it("gives only the row Open chat focuses an id and tabindex -1", () => {
    const out = html(<ChatThread {...base} rows={rows} focusIndex={1} focusId="newest" />);
    expect(out.match(/<li[^>]*tabindex="-1"/g)?.length).toBe(1);
    expect(out).toMatch(/<li id="newest" tabindex="-1"[^>]*>[\s\S]*?I can help with that\./);
    expect(out).toContain('<li id="newest" tabindex="-1" class="scroll-mt-20">');
    expect(html(<ChatThread {...base} rows={rows} />)).not.toContain('id="newest"');
  });

  it("drops a confirm card once its update has no guesses", () => {
    const quiet: ThreadRow[] = [
      { kind: "confirm", key: "c", update: { toolCallId: "u-2", added: [guess], guesses: [] } },
    ];
    expect(html(<ChatThread {...base} rows={quiet} />)).not.toContain(CONFIRM_CARD.title);
  });
});

describe("WorkspaceLoading", () => {
  it("has one h1 and announces nothing", () => {
    const out = html(<WorkspaceLoading />);
    expect(out.match(/<h1/g)?.length).toBe(1);
    expect(out).toContain('aria-busy="true"');
    expect(out).not.toContain('role="status"');
  });
});

describe("ChatPanel", () => {
  // Only what the panel reads; the rest of the workspace is not needed to render.
  function panel(view: WorkspaceView, error: WorkspaceState["error"] = null) {
    const ws = {
      session: seed,
      messages: [],
      status: "ready",
      busy: false,
      error,
      view,
      addedByHand: [],
      dropRefused: noop,
      editCanvas: noop,
      send: yes,
      retry: noop,
      sendAgain: noop,
    } as unknown as WorkspaceState;
    const bar = { label: "Views", items: [], current: view };
    return html(<ChatPanel ws={ws} onOpenNeeds={noop} blurOnSubmit={false} bar={bar} />);
  }

  it("puts the Views bar after the chat's section, not inside it, in every view", () => {
    const notSetUp = { code: "missing_key", message: PICA_MESSAGES.missingKey } as WorkspaceState["error"];
    for (const out of [panel("chat"), panel("options"), panel("compare"), panel("chat", notSetUp), panel("options", notSetUp)]) {
      const section = out.slice(out.indexOf("<section"), out.indexOf("</section>"));
      expect(section).toMatch(/^<section aria-labelledby="[^"]+-title"/);
      expect(section).not.toContain('aria-label="Views"');
      expect(out.indexOf('<nav aria-label="Views"')).toBeGreaterThan(out.indexOf("</section>"));
      expect(out.match(/<section/g)).toHaveLength(1);
    }
  });

  it("fills the workspace's height on desktop Chat and Options and scrolls inside, never lengthening the page", () => {
    for (const view of ["chat", "options"] as const) {
      const frame = panel(view).match(/^<div class="([^"]*)"/)?.[1] ?? "";
      expect(frame).toContain("lg:self-stretch");
      expect(frame).toContain("lg:min-h-0");
      expect(frame).not.toMatch(/(^| )lg:(sticky|max-h-)/);
      expect(panel(view)).toMatch(/class="[^"]*lg:relative[^"]*lg:overflow-y-auto/);
    }
  });

  it("keeps the composer inside the section", () => {
    for (const out of [panel("chat"), panel("options"), panel("compare")]) {
      const section = out.slice(out.indexOf("<section"), out.indexOf("</section>"));
      expect(section).toContain("<textarea");
    }
  });

  it("on Chat, sticks the composer on the bar by its measured height", () => {
    const out = panel("chat");
    expect(out).toContain("sticky bottom-[var(--chat-bar-h,calc(46px+1rem))]");
    expect(out).toMatch(/<div class="sticky bottom-0 z-20 -mx-4 lg:hidden"><nav aria-label="Views"/);
  });
});
