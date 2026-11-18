"use client";

import { BASE } from "@/pica/lib/base";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatTransport } from "ai";
import { DemoChatTransport } from "@/pica/features/demo/DemoChatTransport";
import { visitorKeyHeaders } from "@/pica/features/shared/visitor-key";
import { useEffect, useState } from "react";
import type { PicaUIMessage } from "@/pica/lib/pica/client";
import { CHAT_LIMITS } from "@/pica/lib/pica/constants";
import {
  buildChatContext,
  createSession,
  dispatch,
  getSession,
  hydrateMessages,
  recentTurns,
  setCanvasLocked,
  takePendingSend,
  type SentRequest,
  type ToolOutput,
} from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { chatErrorFrom } from "./chat-model";
import { finishAnnouncement } from "./frame-model";

function toolOutputOf(part: PicaUIMessage["parts"][number]): (ToolOutput & { toolCallId: string }) | null {
  if (!part.type.startsWith("tool-")) return null;
  const tool = part as { type: string; toolCallId: string; state: string; output?: unknown };
  if (tool.state !== "output-available" || tool.output == null) return null;
  const name = tool.type.slice("tool-".length);
  switch (name) {
    case "update_canvas":
    case "ask_question":
    case "search_catalog":
    case "present_shortlist":
    case "compare_products":
      return { tool: name, output: tool.output, toolCallId: tool.toolCallId } as ToolOutput & {
        toolCallId: string;
      };
    default:
      return null;
  }
}

/**
 * The last request sent for each session: when, and the canvas it carried.
 * The reducer uses it to keep buyer edits made after the request went out.
 */
const sentRequests = new Map<string, SentRequest>();

/** Apply each finished tool output to the session once. Safe to call often. */
function applyToolOutputs(sessionId: string, messages: PicaUIMessage[]) {
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      const output = toolOutputOf(part);
      if (!output) continue;
      const session = getSession(sessionId);
      if (!session || session.appliedToolCallIds.includes(output.toolCallId)) continue;
      const request = sentRequests.get(sessionId);
      dispatch(sessionId, { type: "tool_output_applied", ...output, request, at: Date.now() });
      // A later update_canvas in the same reply builds on this one, not on the canvas sent.
      if (output.tool === "update_canvas" && request) {
        sentRequests.set(sessionId, { ...request, canvas: output.output.canvas });
      }
    }
  }
}

/**
 * The transport for a live decision: posts to `/api/chat` with the tab's key.
 * Exported for tests.
 */
export function liveChatTransport(id: string): DefaultChatTransport<PicaUIMessage> {
  return new DefaultChatTransport<PicaUIMessage>({
    api: `${BASE}/api/chat`,
    // Read the tab's key fresh on every send, and send its header only when there is one.
    headers: visitorKeyHeaders,
    // Read the session fresh on every send: the server keeps no state.
    // Send only the newest turns, so a long chat stays under the server's limit.
    prepareSendMessagesRequest: ({ id: chatId, messages, body, trigger, messageId }) => {
      const current = getSession(id) ?? createSession({ id, at: 0, title: "" });
      sentRequests.set(id, { at: Date.now(), canvas: current.canvas });
      return {
        body: {
          ...body,
          id: chatId,
          messages: recentTurns(messages, CHAT_LIMITS.messages),
          trigger,
          messageId,
          session: buildChatContext(current),
        },
      };
    },
  });
}

export function usePicaChat(session: DecisionSession) {
  const id = session.id;
  const [transport] = useState<ChatTransport<PicaUIMessage>>(() =>
    // A demo decision replies from the script, with no call to the server.
    session.demo
      ? new DemoChatTransport(() => {
          const current = getSession(id) ?? session;
          return { canvas: current.canvas, products: current.products };
        })
      : liveChatTransport(id),
  );
  const [announcement, setAnnouncement] = useState("");

  // Read once, when the workspace opens. useChat owns the list after that.
  // The stored history holds product IDs only; put the records back.
  const [initialMessages] = useState(() => hydrateMessages(session.messages, session.products) as PicaUIMessage[]);
  const chat = useChat<PicaUIMessage>({
    id,
    messages: initialMessages,
    transport,
    // `onFinish` also fires when a reply fails; then the error's alert speaks, not this.
    onFinish: ({ message, isError, isAbort, isDisconnect }) => {
      setAnnouncement(finishAnnouncement(message, { isError, isAbort, isDisconnect }));
    },
  });
  const { messages, status, regenerate } = chat;

  // Send the first message stored by Home or Browse.
  useEffect(() => {
    if (takePendingSend(id)) void regenerate();
  }, [id, regenerate]);

  // Apply tool outputs as they arrive, even mid-stream.
  useEffect(() => {
    applyToolOutputs(id, messages);
  }, [id, messages]);

  // Lock canvas edits while Pica replies. Declared after the effect above, so
  // the reply's own canvas lands before the lock lifts.
  const replying = status === "submitted" || status === "streaming";
  useEffect(() => {
    setCanvasLocked(id, replying);
    return () => setCanvasLocked(id, false);
  }, [id, replying]);

  // Save the history whenever a reply is not mid-stream.
  useEffect(() => {
    if (status === "streaming") return;
    dispatch(id, { type: "messages_set", messages, at: Date.now() });
  }, [id, messages, status]);

  return { ...chat, announcement, chatError: chatErrorFrom(chat.error) };
}
