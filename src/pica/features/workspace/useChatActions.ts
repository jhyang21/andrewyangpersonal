"use client";

import { track } from "@/pica/lib/analytics";
import { isUnanswered, offersProductsNow, openQuestion, questionParts } from "./chat-model";
import type { WorkspaceState } from "./useWorkspace";
import { STALE_MESSAGE } from "./views";

/** What "Show me products now" sends. */
export const PRODUCTS_NOW_MESSAGE = "Show me some products now.";

/** What "Skip" sends for a question. */
export const SKIP_MESSAGE = "Skip this question.";

/**
 * The chat's derived state and buttons, over the workspace. Sends go through
 * the workspace, so the busy rule and the error reset live in one place.
 */
export function useChatActions(ws: WorkspaceState) {
  const { messages, busy, error, session } = ws;
  const questions = questionParts(messages);
  const open = openQuestion(messages, busy);
  // Questions so far, counting the open one: the question's number and the analytics count.
  const questionNumber = questions.length;

  function answer(text: string, optionIndex: number | null) {
    track(
      "question_answered",
      { questionNumber, via: optionIndex === null ? "typed" : "quick_answer", optionIndex },
      session.id,
    );
    return ws.send(text);
  }

  function skip() {
    track("question_skipped", { questionNumber }, session.id);
    return ws.send(SKIP_MESSAGE);
  }

  return {
    openQuestion: open,
    questionNumber,
    unanswered: isUnanswered(messages, busy, error !== null),
    offersProductsNow: offersProductsNow(messages, busy, Boolean(session.shortlist)),
    /** True when the buyer changed the needs after the shortlist. */
    shortlistStale: Boolean(session.shortlist?.stale),
    answer,
    skip,
    retry: ws.retry,
    sendAgain: ws.sendAgain,
    askForProducts: () => ws.send(PRODUCTS_NOW_MESSAGE),
    updateShortlist: () => ws.send(STALE_MESSAGE),
  };
}
