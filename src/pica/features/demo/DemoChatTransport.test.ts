import type { UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";
import type { PicaUIMessage } from "@/pica/lib/pica/client";
import { userMessage } from "@/pica/lib/session";
import { EMPTY_CANVAS } from "@/pica/lib/types";
import { DEMO, DEMO_STEPS } from "./demo-script";
import { DemoChatTransport, NO_PACE, paced, replyChunks } from "./DemoChatTransport";

async function readAll(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const out: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

function send(transport: DemoChatTransport, text: string) {
  return transport.sendMessages({
    trigger: "submit-message",
    chatId: "demo",
    messageId: undefined,
    messages: [userMessage("u0", text)] as PicaUIMessage[],
    abortSignal: undefined,
  });
}

function textOf(chunks: UIMessageChunk[]): string {
  return chunks.flatMap((chunk) => (chunk.type === "text-delta" ? [chunk.delta] : [])).join("");
}

describe("replyChunks", () => {
  it("streams start, each part in order, then finish", () => {
    const chunks = replyChunks("demo-1", [
      { kind: "text", text: "One two three four five" },
      {
        kind: "tool",
        tool: "ask_question",
        input: {},
        output: { question: { question: "Q?", why: "W", options: ["a", "b"] } },
      },
    ]);
    expect(chunks.map((chunk) => chunk.type)).toEqual([
      "start",
      "text-start",
      "text-delta",
      "text-delta",
      "text-end",
      "tool-input-available",
      "tool-output-available",
      "finish",
    ]);
    expect(textOf(chunks)).toBe("One two three four five");
    const output = chunks.find((chunk) => chunk.type === "tool-output-available");
    expect(output?.type === "tool-output-available" ? output.toolCallId : null).toBe("demo-1-ask_question");
  });
});

describe("DemoChatTransport", () => {
  const transport = new DemoChatTransport(() => ({ canvas: EMPTY_CANVAS, products: {} }), NO_PACE, () => 1);

  it("replies to the first scripted turn with Pica's canvas and question", async () => {
    const chunks = await readAll(await send(transport, DEMO_STEPS[0].buyer));
    const tools = chunks.flatMap((chunk) => (chunk.type === "tool-input-available" ? [chunk.toolName] : []));
    expect(tools).toEqual(["update_canvas", "ask_question"]);
    expect(chunks.at(-1)?.type).toBe("finish");
  });

  it("answers off-script text with the fixed line", async () => {
    expect(textOf(await readAll(await send(transport, "What about a tote?")))).toBe(DEMO.offScript);
  });

  it("has no stream to reconnect to", async () => {
    expect(await transport.reconnectToStream()).toBeNull();
  });
});

describe("paced", () => {
  it("sends nothing once the signal has aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const chunks = await readAll(paced(replyChunks("x", [{ kind: "text", text: "Hi" }]), NO_PACE, controller.signal));
    expect(chunks).toEqual([]);
  });
});
