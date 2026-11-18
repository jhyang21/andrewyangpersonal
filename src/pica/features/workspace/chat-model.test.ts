import { describe, expect, it } from "vitest";
import { PICA_MESSAGES } from "@/pica/lib/pica/constants";
import type { Canvas, CanvasItem } from "@/pica/lib/types";
import { OFFLINE_MESSAGE } from "@/pica/features/shared/api";
import {
  CONFIRM_CARD_ROWS,
  canvasUpdates,
  chatErrorFrom,
  confirmCard,
  guessState,
  isBusy,
  isUnanswered,
  messageText,
  offersProductsNow,
  openQuestion,
  plainText,
  questionParts,
  replyAnnouncement,
  searchedProductCount,
  toolNoteOf,
  type ChatMessageLike,
  type ChatPart,
} from "./chat-model";

const user = (text: string): ChatMessageLike => ({ role: "user", parts: [{ type: "text", text }] });
const reply = (...parts: ChatPart[]): ChatMessageLike => ({ role: "assistant", parts });
const text = (value: string): ChatPart => ({ type: "text", text: value });
const tool = (name: string, toolCallId: string, output: unknown, state = "output-available"): ChatPart => ({
  type: `tool-${name}`,
  toolCallId,
  state,
  output,
});
const question = (id: string, q = "Laptop size?") =>
  tool("ask_question", id, { question: { question: q, why: "Fit", options: ["13", "16"] } });
const search = (id: string, ...productIds: string[]) =>
  tool("search_catalog", id, { products: productIds.map((pid) => ({ id: pid })), totalCount: 500 });
const item = (id: string, kind: CanvasItem["kind"], value: string, source: CanvasItem["source"] = "inferred"): CanvasItem => ({
  id,
  kind,
  text: value,
  source,
});
const canvasOf = (...items: CanvasItem[]): Canvas => ({ category: null, outcome: null, budget: null, items });
const update = (id: string, canvas: Canvas) => tool("update_canvas", id, { canvas });

describe("reply state", () => {
  it("is busy while the request is out or streaming", () => {
    expect(isBusy("submitted")).toBe(true);
    expect(isBusy("streaming")).toBe(true);
    expect(isBusy("ready")).toBe(false);
    expect(isBusy("error")).toBe(false);
  });

  it("a buyer message with no reply, no error and nothing coming is unanswered", () => {
    expect(isUnanswered([user("hi")], false, false)).toBe(true);
    expect(isUnanswered([user("hi")], true, false)).toBe(false);
    expect(isUnanswered([user("hi")], false, true)).toBe(false);
    expect(isUnanswered([user("hi"), reply(text("Hello"))], false, false)).toBe(false);
    expect(isUnanswered([], false, false)).toBe(false);
  });

  it("offers products now once Pica has replied and no shortlist exists", () => {
    const messages = [user("hi"), reply(text("Hello"))];
    expect(offersProductsNow(messages, false, false)).toBe(true);
    expect(offersProductsNow(messages, true, false)).toBe(false);
    expect(offersProductsNow(messages, false, true)).toBe(false);
    expect(offersProductsNow([user("hi")], false, false)).toBe(false);
  });
});

describe("errors", () => {
  it("shows the server's own words from a JSON body", () => {
    const error = new Error(JSON.stringify({ error: { code: "rate_limited", message: PICA_MESSAGES.rateLimited } }));
    expect(chatErrorFrom(error)).toEqual({ code: "rate_limited", message: PICA_MESSAGES.rateLimited });
  });

  it("keeps Pica's known lines word for word", () => {
    expect(chatErrorFrom(new Error(PICA_MESSAGES.tooLong))).toEqual({
      code: "model_unavailable",
      message: PICA_MESSAGES.tooLong,
    });
  });

  it("reads a dropped connection as offline, and anything else as Pica unable to reply", () => {
    expect(chatErrorFrom(new Error("Failed to fetch"))?.message).toBe(OFFLINE_MESSAGE);
    expect(chatErrorFrom(new Error("boom"))?.message).toBe(PICA_MESSAGES.modelUnavailable);
    expect(chatErrorFrom(undefined)).toBeNull();
  });
});

describe("text", () => {
  it("joins a message's text parts, a tool part leaving an empty line as before", () => {
    expect(messageText(reply(text("One"), text("Two ")))).toBe("One\nTwo");
    expect(messageText(reply(text("One"), search("s1", "a"), text("Two")))).toBe("One\n\nTwo");
    expect(messageText(reply(search("s1", "a")))).toBe("");
  });

  it("announces a reply with its words, or the update when it has none", () => {
    expect(replyAnnouncement(reply(text("Here you go")))).toBe("Pica replied: Here you go");
    expect(replyAnnouncement(reply(search("s1", "a")))).toBe("Pica updated your decision");
    expect(replyAnnouncement(reply(text("x".repeat(500)))).length).toBe("Pica replied: ".length + 400);
  });

  it("drops light markdown", () => {
    expect(plainText("## Tip\n**Bold** and __under__")).toBe("Tip\nBold and under");
  });
});

describe("questions", () => {
  it("lists every finished question, oldest first", () => {
    const messages = [reply(question("q1")), user("16"), reply(question("q2", "Colour?"), tool("ask_question", "q3", null, "input-streaming"))];
    expect(questionParts(messages).map((q) => q.toolCallId)).toEqual(["q1", "q2"]);
  });

  it("the open question is the last one in Pica's last reply, once the reply is done", () => {
    const messages = [reply(question("q1")), user("16"), reply(text("Thanks"), question("q2"))];
    expect(openQuestion(messages, false)?.toolCallId).toBe("q2");
    expect(openQuestion(messages, true)).toBeNull();
    expect(openQuestion([...messages, user("Blue")], false)).toBeNull();
  });
});

describe("tool notes", () => {
  it("has a note for each finished tool and none for failed or running calls", () => {
    expect(toolNoteOf(update("u1", canvasOf()))).toEqual({ kind: "canvas", toolCallId: "u1" });
    expect(toolNoteOf(tool("update_canvas", "u2", null, "output-error"))).toBeNull();
    expect(toolNoteOf(tool("update_canvas", "u3", undefined, "input-available"))).toBeNull();
    expect(toolNoteOf(text("hi"))).toBeNull();
    expect(toolNoteOf(tool("unknown_tool", "x", {}))).toBeNull();
  });

  it("a search note counts what that search returned and carries the server's problem as sent", () => {
    expect(toolNoteOf(search("s1", "a", "b"))).toMatchObject({ kind: "search", count: 2, problem: null });
    const problem = { code: "catalog_unavailable", message: PICA_MESSAGES.catalogUnavailable };
    expect(toolNoteOf(tool("search_catalog", "s2", { products: [], totalCount: null, problem }))).toMatchObject({
      count: 0,
      problem,
    });
  });

  it("shortlist and comparison notes carry their counts", () => {
    const shortlist = { entries: [{ productId: "a" }, { productId: "b" }, { productId: "c" }] };
    expect(toolNoteOf(tool("present_shortlist", "p1", { shortlist }))).toMatchObject({ kind: "shortlist", count: 3 });
    expect(toolNoteOf(tool("compare_products", "c1", { comparison: { productIds: ["a", "b"] } }))).toMatchObject({
      kind: "compare",
      count: 2,
    });
  });

  it("counts distinct products across every search in one reply, not the catalog's estimate", () => {
    const message = reply(search("s1", "a", "b", "c"), text("And more"), search("s2", "b", "c", "d"), search("s3"));
    expect(searchedProductCount(message)).toBe(4);
    expect(searchedProductCount(reply(text("none")))).toBe(0);
  });
});

describe("confirm cards", () => {
  it("one card per update, with only the needs Pica newly guessed", () => {
    const first = canvasOf(item("a", "must_have", "Fits 16-inch"), item("q", "open_question", "Wheels?"));
    const second = canvasOf(
      item("a", "must_have", "Fits 16-inch"),
      item("b", "preference", "Black"),
      item("c", "must_have", "Water resistant", "stated"),
    );
    const updates = canvasUpdates([reply(update("u1", first)), user("Also black"), reply(update("u2", second))]);
    expect(updates.map((u) => u.guesses.map((g) => g.id))).toEqual([["a"], ["b"]]);
    expect(updates.map((u) => u.added.map((g) => g.id))).toEqual([["a"], ["b", "c"]]);
  });

  it("a need the buyer added by hand between two updates does not count as Pica's", () => {
    const first = canvasOf(item("a", "must_have", "Fits 16-inch"));
    // The buyer adds "w" on the canvas; Pica's next update carries it along and adds "b".
    const second = canvasOf(
      item("a", "must_have", "Fits 16-inch"),
      item("w", "must_have", "Waterproof", "stated"),
      item("b", "preference", "Black"),
    );
    const messages = [reply(update("u1", first)), user("Also black"), reply(update("u2", second))];
    expect(canvasUpdates(messages).map((u) => u.added.map((g) => g.id))).toEqual([["a"], ["w", "b"]]);
    const updates = canvasUpdates(messages, { byHand: ["w"] });
    expect(updates.map((u) => u.added.map((g) => g.id))).toEqual([["a"], ["b"]]);
    expect(updates[1].guesses.map((g) => g.id)).toEqual(["b"]);
  });

  it("starts from the given canvas", () => {
    const start = canvasOf(item("a", "must_have", "Fits 16-inch"));
    const [u] = canvasUpdates([reply(update("u1", canvasOf(item("a", "must_have", "Fits 16-inch"))))], { start });
    expect(u.added).toEqual([]);
    expect(u.guesses).toEqual([]);
  });

  it("a reworded guess counts as a new guess", () => {
    const updates = canvasUpdates([
      reply(update("u1", canvasOf(item("a", "must_have", "Fits 15-inch")))),
      reply(update("u2", canvasOf(item("a", "must_have", "Fits 16-inch")))),
    ]);
    expect(updates[1].guesses.map((g) => g.text)).toEqual(["Fits 16-inch"]);
  });

  it("shows up to three rows and counts the rest", () => {
    const guesses = ["a", "b", "c", "d", "e"].map((id) => item(id, "must_have", id));
    const [u] = canvasUpdates([reply(update("u1", canvasOf(...guesses)))]);
    const card = confirmCard(u, canvasOf(...guesses));
    expect(card?.rows).toHaveLength(CONFIRM_CARD_ROWS);
    expect(card?.more).toBe(2);
  });

  it("has no card when the update guessed no needs", () => {
    const [u] = canvasUpdates([reply(update("u1", canvasOf(item("a", "must_have", "x", "stated"))))]);
    expect(confirmCard(u, canvasOf())).toBeNull();
  });

  it("each row follows the canvas: open, confirmed, then changed once edited or removed", () => {
    const guess = item("a", "must_have", "Fits 16-inch");
    expect(guessState(guess, canvasOf(guess))).toBe("open");
    expect(guessState(guess, canvasOf({ ...guess, source: "stated" }))).toBe("confirmed");
    expect(guessState(guess, canvasOf({ ...guess, text: "Fits 15-inch", source: "stated" }))).toBe("changed");
    expect(guessState(guess, canvasOf())).toBe("changed");
    expect(guessState(guess, canvasOf({ ...guess, kind: "preference" }))).toBe("changed");
  });
});
