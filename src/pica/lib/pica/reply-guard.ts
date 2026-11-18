/**
 * Checks Pica's own replies before the buyer sees them.
 *
 * Tool input already passes the text guard. Free text did not, so a reply
 * could carry a price, a rating, a stock claim or a sales claim. This stream
 * transform holds each text block until it ends, checks it, and sends a clean
 * version: each sentence that breaks a rule is dropped, the rest is kept.
 *
 * The first time a request drops anything, one line tells the buyer, so a
 * cut is never silent. Later drops in the same request add no line.
 * - A catalog fact (price, rating, stock, sale, delivery, link): the line
 *   says the cards carry those facts.
 * - Only sales claims: the line says Pica cut a sales line.
 *
 * Cost: a text block reaches the buyer whole, not token by token. Replies
 * are two or three short sentences, so the wait is short.
 */
import type { StreamTextTransform, TextStreamPart, ToolSet } from "ai";
import { PICA_MESSAGES } from "./constants";
import { checkReplyText, sentenceParts, type TextGuardOptions } from "./text-guard";

type Part = TextStreamPart<ToolSet>;
type TextStart = Extract<Part, { type: "text-start" }>;

export interface ReplyGuardOptions extends TextGuardOptions {
  /** Called with the rule labels for each changed block. Never gets the text. */
  onBlocked?: (labels: string[]) => void;
}

const STEP_ENDS = new Set<string>(["finish-step", "finish", "abort", "error"]);

/** Whether the buyer has seen a withheld line in this request. */
export type WithheldLinesSent = Set<"withheld">;

function logBlocked(labels: string[]): void {
  console.warn(`[pica] reply text withheld: ${labels.join(", ")}`);
}

function broken(text: string, options: TextGuardOptions): { pressure: boolean; facts: boolean; labels: string[] } {
  const { pressure, facts } = checkReplyText(text, options);
  return { pressure: pressure.length > 0, facts: facts.length > 0, labels: [...pressure, ...facts] };
}

/**
 * The text the buyer should see for one finished block, and the rules it
 * broke. `sent` tracks the withheld lines already shown in this request.
 */
export function cleanReplyBlock(
  text: string,
  options: TextGuardOptions = {},
  sent: WithheldLinesSent = new Set(),
): { text: string; labels: string[] } {
  const whole = broken(text, options);
  if (whole.labels.length === 0) return { text, labels: [] };

  let facts = false;
  let pressure = false;
  const kept = sentenceParts(text)
    .filter((sentence) => {
      const found = broken(sentence, options);
      facts ||= found.facts;
      pressure ||= found.pressure;
      return found.labels.length === 0;
    })
    .join("")
    .trim();
  // A claim that spans sentences can survive the split; then drop it all.
  const left = kept && broken(kept, options).labels.length === 0 ? kept : "";
  if (!left) {
    facts ||= whole.facts;
    pressure ||= whole.pressure;
  }

  let note = "";
  if (!sent.has("withheld") && (facts || pressure)) {
    note = facts ? PICA_MESSAGES.replyWithheld : PICA_MESSAGES.replyWithheldPressure;
    sent.add("withheld");
  }
  return { text: [left, note].filter(Boolean).join(" "), labels: whole.labels };
}

/** Pass to `streamText({ experimental_transform })`. */
export function guardReplyText<TOOLS extends ToolSet>(
  options: ReplyGuardOptions = {},
): StreamTextTransform<TOOLS> {
  const { onBlocked = logBlocked, ...guard } = options;

  return () => {
    const open = new Map<string, { start: TextStart; text: string }>();
    const sent: WithheldLinesSent = new Set();

    type Controller = TransformStreamDefaultController<TextStreamPart<TOOLS>>;
    function release(id: string, controller: Controller, end: TextStreamPart<TOOLS>): void {
      const block = open.get(id);
      if (!block) return;
      open.delete(id);
      // Checked at the block's end, so the latest known prices count.
      const { text, labels } = cleanReplyBlock(block.text, guard, sent);
      if (labels.length > 0) onBlocked(labels);
      // A block with nothing left to show is dropped whole.
      if (!text) return;
      controller.enqueue(block.start);
      controller.enqueue({ type: "text-delta", id, text });
      controller.enqueue(end);
    }

    function releaseAll(controller: Controller): void {
      for (const id of [...open.keys()]) release(id, controller, { type: "text-end", id });
    }

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === "text-start") {
          // A repeated start keeps the text already held.
          if (!open.has(part.id)) open.set(part.id, { start: part, text: "" });
          return;
        }
        if (part.type === "text-delta") {
          // Text with no start still waits to be checked, under a block of its own.
          const block = open.get(part.id) ?? { start: { type: "text-start", id: part.id }, text: "" };
          block.text += part.text;
          open.set(part.id, block);
          return;
        }
        if (part.type === "text-end" && open.has(part.id)) {
          release(part.id, controller, part);
          return;
        }
        // A block the model never closed is checked and sent before the step ends.
        if (STEP_ENDS.has(part.type)) releaseAll(controller);
        controller.enqueue(part);
      },
      // A block still open when the stream ends is checked and sent, not lost.
      flush: releaseAll,
    });
  };
}
