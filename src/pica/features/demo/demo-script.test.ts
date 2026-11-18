import { describe, expect, it } from "vitest";
import { createSession, sessionReducer, userMessage, type ToolOutput } from "@/pica/lib/session";
import { AVOID_LIST } from "@/pica/lib/pica/prompt";
import { EMPTY_CANVAS, type DecisionSession } from "@/pica/lib/types";
import { DEMO, DEMO_STEPS, demoProgress, demoReply, stepForReply, type DemoPart } from "./demo-script";

const AT = Date.UTC(2026, 10, 17, 14, 0);

interface Message {
  id: string;
  role: string;
  parts: { type: string; text?: string }[];
}

function pica(id: string, parts: DemoPart[]): Message {
  return {
    id,
    role: "assistant",
    parts: parts.map((part) => (part.kind === "text" ? { type: "text", text: part.text } : { type: `tool-${part.tool}` })),
  };
}

/** Runs every scripted turn through the reducer, as the workspace would. */
function runDemo(): { session: DecisionSession; messages: Message[] } {
  let session = createSession({ id: "demo", at: AT, title: DEMO.title, demo: true });
  const messages: Message[] = [];
  DEMO_STEPS.forEach((step, i) => {
    messages.push(userMessage(`u${i}`, step.buyer));
    const at = AT + (i + 1) * 1000;
    const reply = demoReply(messages, { at, canvas: session.canvas, products: session.products });
    expect(reply.id).toBe(`demo-${i + 1}`);
    for (const part of reply.parts) {
      if (part.kind !== "tool") continue;
      const output = { tool: part.tool, output: part.output } as ToolOutput;
      session = sessionReducer(session, { type: "tool_output_applied", toolCallId: `${reply.id}-${part.tool}`, at, ...output });
    }
    messages.push(pica(`a${i}`, reply.parts));
  });
  return { session, messages };
}

describe("the demo script", () => {
  it("goes goal, question, needs, options, compare", () => {
    expect(DEMO_STEPS.map((step) => step.view)).toEqual(["chat", "chat", "options", "compare"]);
    const first = demoReply([userMessage("u", DEMO_STEPS[0].buyer)], { at: AT, canvas: EMPTY_CANVAS, products: {} });
    expect(first.parts.map((part) => (part.kind === "tool" ? part.tool : "text"))).toEqual([
      "text",
      "update_canvas",
      "ask_question",
    ]);
  });

  it("leaves a full decision through the reducer: goal, needs, budget, four options, three compared", () => {
    const { session } = runDemo();
    expect(session.demo).toBe(true);
    expect(session.canvas.outcome?.text).toBe(DEMO_STEPS[0].buyer);
    expect(session.canvas.category).toBe("backpack");
    expect(session.canvas.budget).toEqual({ maxUsd: 150, source: "stated" });
    expect(session.canvas.items.map((item) => item.text)).toEqual([
      "Comfortable for a 30-minute walk",
      "Holds up in rain",
      "Fits a 16-inch laptop",
    ]);
    expect(Object.keys(session.products)).toHaveLength(4);
    expect(session.shortlist?.entries).toHaveLength(4);
    expect(session.shortlist?.stale).toBe(false);
    expect(session.comparison?.productIds).toHaveLength(3);
    for (const id of session.comparison?.productIds ?? []) expect(session.products[id]).toBeDefined();
  });

  it("keeps guesses the buyer confirmed when a later step adds needs", () => {
    const messages: Message[] = [userMessage("u0", DEMO_STEPS[0].buyer)];
    const first = demoReply(messages, { at: AT, canvas: EMPTY_CANVAS, products: {} });
    const update = first.parts.find((part) => part.kind === "tool" && part.tool === "update_canvas");
    if (update?.kind !== "tool" || update.tool !== "update_canvas") throw new Error("no canvas update");
    const confirmed = {
      ...update.output.canvas,
      items: update.output.canvas.items.map((item) => ({ ...item, source: "stated" as const })),
    };
    messages.push(pica("a0", first.parts), userMessage("u1", DEMO_STEPS[1].buyer));
    const second = demoReply(messages, { at: AT, canvas: confirmed, products: {} });
    const next = second.parts.find((part) => part.kind === "tool");
    if (next?.kind !== "tool" || next.tool !== "update_canvas") throw new Error("no canvas update");
    expect(next.output.canvas.items.filter((item) => item.source === "stated")).toHaveLength(3);
  });

  it("counts only scripted turns, in order, so typed messages don't move the steps", () => {
    const { messages } = runDemo();
    expect(demoProgress(messages)).toBe(DEMO_STEPS.length);
    expect(demoProgress([userMessage("x", "hello"), userMessage("y", DEMO_STEPS[0].buyer)])).toBe(1);
    expect(demoProgress([userMessage("y", DEMO_STEPS[1].buyer)])).toBe(0);
  });

  it("answers anything off the script with one line and no tools", () => {
    const aside = [userMessage("x", "Which is lighter?")];
    expect(stepForReply(aside)).toBeNull();
    expect(demoReply(aside, { at: AT, canvas: EMPTY_CANVAS, products: {} }).parts).toEqual([
      { kind: "text", text: DEMO.offScript },
    ]);
    // A step sent out of order is off the script too.
    expect(stepForReply([userMessage("y", DEMO_STEPS[2].buyer)])).toBeNull();
  });

  it("keeps Pica's words clear of the phrases Pica never uses", () => {
    const { messages } = runDemo();
    const words = [
      DEMO.offScript,
      DEMO.done,
      ...messages.filter((m) => m.role === "assistant").flatMap((m) => m.parts.map((part) => part.text ?? "")),
    ]
      .join(" ")
      .toLowerCase();
    for (const phrase of AVOID_LIST.filter((phrase) => !phrase.includes(" X ") && phrase.length < 20)) {
      expect(words).not.toMatch(new RegExp(`(^|\\W)${phrase.replace(/[#-]/g, "\\$&")}(\\W|$)`));
    }
  });
});
