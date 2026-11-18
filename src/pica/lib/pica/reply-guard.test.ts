import { simulateReadableStream } from "ai/test";
import type { TextStreamPart, ToolSet } from "ai";
import { describe, expect, it } from "vitest";
import { PICA_MESSAGES } from "./constants";
import { cleanReplyBlock, guardReplyText, type WithheldLinesSent } from "./reply-guard";
import { createKnownPrices } from "./text-guard";
import { makeProduct } from "./test-helpers";

describe("cleanReplyBlock", () => {
  it("passes plain speech as written", () => {
    const text = "That's the best I can tell from the listing. Which is best depends on your commute.";
    expect(cleanReplyBlock(text)).toEqual({ text, labels: [] });
  });

  it("drops only the sentence with a sales claim", () => {
    const out = cleanReplyBlock("The rolltop is the best bag here. It has a padded sleeve.\nWant a comparison?");
    expect(out.text).toBe(`It has a padded sleeve.\nWant a comparison? ${PICA_MESSAGES.replyWithheldPressure}`);
    expect(out.labels).toEqual(['"best"']);
  });

  it("uses the sales line when no sentence is left", () => {
    const out = cleanReplyBlock("It's perfect for you. The best choice by far.");
    expect(out.text).toBe(PICA_MESSAGES.replyWithheldPressure);
  });

  it("drops only the sentence with a catalog fact, and adds the catalog line", () => {
    const out = cleanReplyBlock("It has a padded sleeve. It's rated 4.6 of 5.");
    expect(out.text).toBe(`It has a padded sleeve. ${PICA_MESSAGES.replyWithheld}`);
    expect(out.labels).toEqual(["a rating"]);
  });

  it("sends one withheld line per request, at the first cut", () => {
    const sent: WithheldLinesSent = new Set();
    expect(cleanReplyBlock("It has a padded sleeve. It costs $129.", {}, sent).text).toBe(
      `It has a padded sleeve. ${PICA_MESSAGES.replyWithheld}`,
    );
    // Later hits just drop the sentence.
    expect(cleanReplyBlock("It's in stock. Want a comparison?", {}, sent).text).toBe("Want a comparison?");
    expect(cleanReplyBlock("It's in stock.", {}, sent).text).toBe("");
    expect(cleanReplyBlock("It's the best bag.", {}, sent).text).toBe("");
  });

  it("blocks a bare known price, but not the buyer's own amount", () => {
    const knownPrices = createKnownPrices([makeProduct({ id: "p-1" })]);
    expect(cleanReplyBlock("The slim one is 129. It has a sleeve.", { knownPrices }).text).toBe(
      `It has a sleeve. ${PICA_MESSAGES.replyWithheld}`,
    );
    expect(cleanReplyBlock("I'll look under 129.", { knownPrices, allowedAmounts: [129] }).text).toBe(
      "I'll look under 129.",
    );
  });
});

type Part = TextStreamPart<ToolSet>;

async function runGuard(parts: Part[]): Promise<Part[]> {
  const transform = guardReplyText({ onBlocked: () => {} })({ tools: {} as ToolSet, stopStream: () => {} });
  const stream = simulateReadableStream({ chunks: parts, initialDelayInMs: null, chunkDelayInMs: null });
  const out: Part[] = [];
  const reader = stream.pipeThrough(transform).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

describe("guardReplyText", () => {
  it("checks and sends a block that is still open when the stream ends", async () => {
    const out = await runGuard([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "It has a padded sleeve. It's the best bag." },
    ]);
    expect(out.map((part) => part.type)).toEqual(["text-start", "text-delta", "text-end"]);
    expect(out[1]).toMatchObject({
      type: "text-delta",
      text: `It has a padded sleeve. ${PICA_MESSAGES.replyWithheldPressure}`,
    });
  });

  it("sends an open block before the step's finish part", async () => {
    const finish = { type: "finish", finishReason: "stop", rawFinishReason: undefined } as unknown as Part;
    const out = await runGuard([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "Want a comparison?" },
      finish,
    ]);
    expect(out.map((part) => part.type)).toEqual(["text-start", "text-delta", "text-end", "finish"]);
  });
});

describe("reply guard: fourth review", () => {
  it("adds a withheld line when only a sales sentence is dropped and the rest is kept", () => {
    const out = cleanReplyBlock("No need to buy today. It's the best bag. It has a sleeve.");
    expect(out.text).toBe(`No need to buy today. It has a sleeve. ${PICA_MESSAGES.replyWithheldPressure}`);
  });

  it("sends the first cut's line and no second line in the same request", async () => {
    const out = await runGuard([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "It has a sleeve. It costs $129." },
      { type: "text-end", id: "t1" },
      { type: "text-start", id: "t2" },
      { type: "text-delta", id: "t2", text: "Want a comparison? It's the best bag." },
      { type: "text-end", id: "t2" },
    ]);
    const said = out.flatMap((part) => (part.type === "text-delta" ? [part.text] : [])).join(" ");
    expect(said).toBe(`It has a sleeve. ${PICA_MESSAGES.replyWithheld} Want a comparison?`);
  });

  it("checks text that arrives with no text-start", async () => {
    const finish = { type: "finish", finishReason: "stop", rawFinishReason: undefined } as unknown as Part;
    const out = await runGuard([{ type: "text-delta", id: "t9", text: "It's the best bag. It has a sleeve." }, finish]);
    expect(out.map((part) => part.type)).toEqual(["text-start", "text-delta", "text-end", "finish"]);
    expect(out[1]).toMatchObject({
      type: "text-delta",
      id: "t9",
      text: `It has a sleeve. ${PICA_MESSAGES.replyWithheldPressure}`,
    });
  });

  it("keeps the held text when a block's start comes twice", async () => {
    const out = await runGuard([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "It has a padded sleeve. " },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "Want a comparison?" },
      { type: "text-end", id: "t1" },
    ]);
    expect(out.map((part) => part.type)).toEqual(["text-start", "text-delta", "text-end"]);
    expect(out[1]).toMatchObject({ text: "It has a padded sleeve. Want a comparison?" });
  });

  it("checks and sends an open block before an error or an abort", async () => {
    const ends = [
      { type: "error", error: new Error("model failed") },
      { type: "abort", reason: "buyer left" },
    ] as unknown as Part[];
    for (const end of ends) {
      const out = await runGuard([
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", text: "It has a sleeve. It's rated 4.6 of 5." },
        end,
      ]);
      expect(out.map((part) => part.type), end.type).toEqual(["text-start", "text-delta", "text-end", end.type]);
      expect(out[1]).toMatchObject({ text: `It has a sleeve. ${PICA_MESSAGES.replyWithheld}` });
    }
  });
});

describe("reply guard: second patch", () => {
  it("keeps a sentence whole across max. or min. before a lower-case word", () => {
    for (const text of [
      "I can't see whether the max. load version is in stock.",
      "I can't tell if the min. order one ships in 2 days.",
    ]) {
      expect(cleanReplyBlock(text), text).toEqual({ text, labels: [] });
    }
  });
});

describe("reply guard: after-round-4 patch", () => {
  it("ends the sentence after max. when bold, a quote or a bracket opens the next one", () => {
    for (const reply of [
      "Not over 2 kg max. **It's the best bag here.**",
      'Not over 2 kg max. "Best in class" is fair.',
      "Not over 2 kg max. (Best for commuting.)",
    ]) {
      const text = cleanReplyBlock(reply).text;
      expect(text, reply).toContain("Not over 2 kg max.");
      expect(text, reply).not.toMatch(/best/i);
    }
  });

  it("keeps an honest sentence that ends in max before a sales sentence", () => {
    expect(cleanReplyBlock("Weight is 2 kg max. It's the best bag here.").text).toBe(
      `Weight is 2 kg max. ${PICA_MESSAGES.replyWithheldPressure}`,
    );
    expect(cleanReplyBlock("The answer is no. Buy it today.").text).toBe(
      `The answer is no. ${PICA_MESSAGES.replyWithheldPressure}`,
    );
  });
});
