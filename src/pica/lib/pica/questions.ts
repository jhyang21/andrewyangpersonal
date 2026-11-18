/**
 * Count the questions Pica has asked since its last shortlist, from the
 * message history the client sends. The server keeps no state, so the
 * history is the record.
 *
 * The count starts again after each shortlist Pica showed, so a buyer who
 * edits the canvas later can get a new question (PRD FR-02: generally 2 to 4
 * questions before presenting options).
 */
import { PICA_TOOLS } from "@/pica/lib/types";
import { MAX_QUESTIONS } from "./constants";

const ASK_PART = `tool-${PICA_TOOLS.askQuestion}`;
const SHORTLIST_PART = `tool-${PICA_TOOLS.presentShortlist}`;
const NOT_SHOWN = new Set(["output-error", "output-denied"]);

interface MessageLike {
  role: string;
  parts?: { type: string; state?: string }[];
}

export function countQuestionsAsked(messages: readonly MessageLike[]): number {
  let count = 0;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts ?? []) {
      if (part.type === SHORTLIST_PART && part.state === "output-available") count = 0;
      else if (part.type === ASK_PART && !NOT_SHOWN.has(part.state ?? "")) count++;
    }
  }
  return count;
}

export function questionsLeft(asked: number): number {
  return Math.max(0, MAX_QUESTIONS - asked);
}
