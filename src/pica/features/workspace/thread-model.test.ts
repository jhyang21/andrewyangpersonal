import { describe, expect, it } from "vitest";
import { EMPTY_CANVAS, type Canvas, type CanvasItem, type PicaQuestion } from "@/pica/lib/types";
import type { ChatMessageLike, ChatPart } from "./chat-model";
import { NO_RESULTS_MESSAGE } from "./chat-model";
import { dockLine, newestReplyStart, questionLive, threadRows } from "./thread-model";
import { SKIP_MESSAGE } from "./useChatActions";

const user = (id: string, text: string): ChatMessageLike => ({ id, role: "user", parts: [{ type: "text", text }] });
const pica = (id: string, ...parts: ChatPart[]): ChatMessageLike => ({ id, role: "assistant", parts });
const text = (value: string): ChatPart => ({ type: "text", text: value });
const tool = (name: string, toolCallId: string, output: unknown): ChatPart => ({
  type: `tool-${name}`,
  state: "output-available",
  toolCallId,
  output,
});

const need = (id: string, words: string, source: CanvasItem["source"] = "inferred"): CanvasItem => ({
  id,
  kind: "must_have",
  text: words,
  source,
});
const canvasWith = (...items: CanvasItem[]): Canvas => ({ ...EMPTY_CANVAS, items });
const question = (words: string): PicaQuestion => ({ question: words, why: "It changes the size.", options: ["Yes", "No"] });

describe("threadRows", () => {
  it("turns text into bubbles, with Pica's markdown dropped", () => {
    const rows = threadRows([user("u1", "A bag"), pica("a1", text("**Sure.** Tell me more."))]);
    expect(rows.map((row) => [row.kind, "text" in row ? row.text : null])).toEqual([
      ["user", "A bag"],
      ["pica", "Sure. Tell me more."],
    ]);
  });

  it("adds a confirm card for a canvas update's guesses, with no note", () => {
    const canvas = canvasWith(need("n1", "Fits a laptop"), need("n2", "Light", "stated"));
    const rows = threadRows([user("u1", "A bag"), pica("a1", tool("update_canvas", "c1", { canvas }))]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ kind: "confirm", key: "a1-0-confirm" });
    expect(rows[1].kind === "confirm" && rows[1].update.guesses.map((item) => item.id)).toEqual(["n1"]);
  });

  it("asks nothing about needs the buyer added by hand", () => {
    const canvas = canvasWith(need("mine", "Black", "stated"));
    const rows = threadRows([pica("a1", tool("update_canvas", "c1", { canvas }))], { byHand: ["mine"] });
    expect(rows).toEqual([]);
  });

  it("shows no note for searches that found products", () => {
    const products = (...ids: string[]) => ({ products: ids.map((id) => ({ id })) });
    const rows = threadRows([
      pica("a1", tool("search_catalog", "s1", products("p1", "p2")), tool("search_catalog", "s2", products("p2", "p3"))),
    ]);
    expect(rows).toEqual([]);
  });

  it("shows a search problem, or no results, as Pica's own line, word for word", () => {
    const down = "We couldn't reach the Shopify catalog. Try again in a minute.";
    const rows = threadRows([
      pica("a1", tool("search_catalog", "s1", { products: [], problem: { code: "catalog_unavailable", message: down } })),
      pica("a2", tool("search_catalog", "s2", { products: [] })),
    ]);
    expect(rows).toEqual([
      { kind: "problem", key: "a1-0", text: down },
      { kind: "problem", key: "a2-0", text: NO_RESULTS_MESSAGE },
    ]);
  });

  it("notes a comparison with a link to it, and a new shortlist not at all", () => {
    const rows = threadRows([
      pica(
        "a1",
        tool("present_shortlist", "l1", { shortlist: { entries: [{}, {}, {}, {}] } }),
        tool("compare_products", "k1", { comparison: { productIds: ["p1", "p2"] } }),
      ),
    ]);
    expect(rows).toEqual([{ kind: "note", key: "a1-1", text: "Comparing 2 options", target: "compare" }]);
  });

  it("leaves out running and failed tool calls", () => {
    const rows = threadRows([
      pica("a1", { type: "tool-search_catalog", state: "input-available", toolCallId: "s1" }),
      pica("a2", { type: "tool-update_canvas", state: "output-error", toolCallId: "c1" }),
    ]);
    expect(rows).toEqual([]);
  });

  it("numbers questions from the last shortlist and shows each one's answer", () => {
    const rows = threadRows([
      pica("a1", tool("ask_question", "q1", { question: question("Laptop size?") })),
      user("u1", "16 inch"),
      pica("a2", tool("ask_question", "q2", { question: question("Rain?") })),
      user("u2", SKIP_MESSAGE),
      pica("a3", tool("present_shortlist", "l1", { shortlist: { entries: [{}] } })),
      pica("a4", tool("ask_question", "q3", { question: question("Colour?") })),
    ]);
    const questions = rows.filter((row) => row.kind === "question");
    expect(questions.map((row) => [row.number, row.state])).toEqual([
      [1, { kind: "answered", answer: "16 inch" }],
      [2, { kind: "skipped" }],
      [1, { kind: "open" }],
    ]);
  });
});

describe("newestReplyStart", () => {
  it("is the first row after the buyer's last message", () => {
    const rows = threadRows([user("u1", "A"), pica("a1", text("B")), user("u2", "C"), pica("a2", text("D"), text("E"))]);
    expect(newestReplyStart(rows)).toBe(3);
  });

  it("falls back to the reply before while the last message has none", () => {
    const rows = threadRows([pica("a0", text("Hi")), user("u1", "A"), pica("a1", text("B"), text("C")), user("u2", "D")]);
    expect(newestReplyStart(rows)).toBe(2);
  });

  it("is -1 when Pica has said nothing", () => {
    expect(newestReplyStart([])).toBe(-1);
    expect(newestReplyStart(threadRows([user("u1", "A")]))).toBe(-1);
  });
});

describe("dockLine", () => {
  const quiet = { busy: false, banner: false, canvas: EMPTY_CANVAS };

  it("shows the start of Pica's newest reply, never the buyer's words", () => {
    const rows = threadRows([user("u1", "A bag"), pica("a1", text("Here is what I found."), text("More."))]);
    expect(dockLine(rows, quiet)).toEqual({ kind: "reply", text: "Here is what I found." });
  });

  it("counts Pica's problem lines from the server as its reply", () => {
    const rows = threadRows([user("u1", "A bag"), pica("a1", tool("search_catalog", "s1", { products: [] }))]);
    expect(dockLine(rows, quiet)).toEqual({ kind: "reply", text: NO_RESULTS_MESSAGE });
  });

  it("falls back to a note when the reply has no words", () => {
    const rows = threadRows([
      user("u1", "A"),
      pica("a1", tool("compare_products", "k1", { comparison: { productIds: ["p1", "p2"] } })),
    ]);
    expect(dockLine(rows, quiet)).toEqual({ kind: "reply", text: "Comparing 2 options" });
  });

  it("names an open question in one plain line", () => {
    const rows = threadRows([
      user("u1", "A bag"),
      pica("a1", text("One thing first."), tool("ask_question", "q1", { question: question("Size?") })),
    ]);
    expect(dockLine(rows, quiet)).toEqual({ kind: "card", text: "Pica asked a question" });
  });

  it("names guesses while one still waits, and drops the line once all are confirmed", () => {
    const guessed = canvasWith(need("n1", "Fits a laptop"));
    const rows = threadRows([user("u1", "A bag"), pica("a1", tool("update_canvas", "c1", { canvas: guessed }), text("Noted."))]);
    expect(dockLine(rows, { ...quiet, canvas: guessed })).toEqual({ kind: "card", text: "Pica has guesses to confirm" });
    const confirmed = canvasWith(need("n1", "Fits a laptop", "stated"));
    expect(dockLine(rows, { ...quiet, canvas: confirmed })).toEqual({ kind: "reply", text: "Noted." });
  });

  it("shows the thinking row while Pica works, and gives way to a banner", () => {
    const rows = threadRows([user("u1", "A bag"), pica("a1", text("Sure."))]);
    expect(dockLine(rows, { ...quiet, busy: true })).toEqual({ kind: "thinking" });
    expect(dockLine(rows, { ...quiet, banner: true })).toEqual({ kind: "banner" });
  });

  it("shows nothing before Pica has said anything", () => {
    expect(dockLine(threadRows([user("u1", "A bag")]), quiet)).toEqual({ kind: "none" });
  });
});

describe("questionLive", () => {
  const messages = [user("u1", "A bag"), pica("a1", tool("ask_question", "q1", { question: question("Size?") }))];

  it("takes answers for the open question once Pica has finished", () => {
    expect(questionLive(messages, false, "q1")).toBe(true);
  });

  it("waits while Pica replies, and never for an older question", () => {
    expect(questionLive(messages, true, "q1")).toBe(false);
    expect(questionLive(messages, false, "q0")).toBe(false);
  });
});
