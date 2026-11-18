/**
 * A chat transport for demo decisions. It sends nothing over the network: it
 * streams the demo script's reply as the same chunks the server would send,
 * so `useChat` and the workspace treat it as a live reply.
 */
import type { ChatTransport, UIMessageChunk } from "ai";
import type { PicaUIMessage } from "@/pica/lib/pica/client";
import { demoReply, type DemoContext, type DemoPart } from "./demo-script";

/** Pauses between chunks, in ms, so the thinking row and the stream show. */
export interface DemoPace {
  start: number;
  tool: number;
  text: number;
}

const DEMO_PACE: DemoPace = { start: 700, tool: 450, text: 30 };
export const NO_PACE: DemoPace = { start: 0, tool: 0, text: 0 };

/** Words in small groups, so text arrives a few words at a time. */
function pieces(text: string): string[] {
  const words = text.split(/(?<= )/);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += 3) out.push(words.slice(i, i + 3).join(""));
  return out;
}

/** One reply as UI message chunks: start, each part in order, finish. */
export function replyChunks(id: string, parts: readonly DemoPart[]): UIMessageChunk[] {
  const chunks: UIMessageChunk[] = [{ type: "start" }];
  parts.forEach((part, i) => {
    if (part.kind === "text") {
      const textId = `${id}-text-${i}`;
      chunks.push({ type: "text-start", id: textId });
      for (const delta of pieces(part.text)) chunks.push({ type: "text-delta", id: textId, delta });
      chunks.push({ type: "text-end", id: textId });
      return;
    }
    const toolCallId = `${id}-${part.tool}`;
    chunks.push({ type: "tool-input-available", toolCallId, toolName: part.tool, input: part.input });
    chunks.push({ type: "tool-output-available", toolCallId, output: part.output });
  });
  chunks.push({ type: "finish" });
  return chunks;
}

function pauseFor(chunk: UIMessageChunk, pace: DemoPace): number {
  if (chunk.type === "start") return pace.start;
  if (chunk.type.startsWith("tool-")) return pace.tool;
  if (chunk.type === "text-delta") return pace.text;
  return 0;
}

function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** The chunks as a stream, one pause before each. Stops early when the signal aborts. */
export function paced(chunks: readonly UIMessageChunk[], pace: DemoPace, signal?: AbortSignal): ReadableStream<UIMessageChunk> {
  let i = 0;
  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      const chunk = chunks[i];
      if (chunk) await wait(pauseFor(chunk, pace), signal);
      if (!chunk || signal?.aborted) {
        controller.close();
        return;
      }
      i += 1;
      controller.enqueue(chunk);
    },
  });
}

export class DemoChatTransport implements ChatTransport<PicaUIMessage> {
  constructor(
    /** The session as it stands when a message is sent. */
    private readonly context: () => Omit<DemoContext, "at">,
    private readonly pace: DemoPace = DEMO_PACE,
    private readonly now: () => number = Date.now,
  ) {}

  async sendMessages({
    messages,
    abortSignal,
  }: Parameters<ChatTransport<PicaUIMessage>["sendMessages"]>[0]): Promise<ReadableStream<UIMessageChunk>> {
    const reply = demoReply(messages, { ...this.context(), at: this.now() });
    return paced(replyChunks(reply.id, reply.parts), this.pace, abortSignal);
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
