import { describe, expect, it } from "vitest";
import { MAX_QUESTIONS } from "./constants";
import { countQuestionsAsked, questionsLeft } from "./questions";

const ask = (state: string) => ({ type: "tool-ask_question", state });

describe("countQuestionsAsked", () => {
  it("counts ask_question parts in assistant messages", () => {
    const messages = [
      { role: "user", parts: [{ type: "text" }] },
      { role: "assistant", parts: [{ type: "tool-update_canvas", state: "output-available" }, ask("output-available")] },
      { role: "user", parts: [{ type: "text" }] },
      { role: "assistant", parts: [ask("input-available")] },
    ];
    expect(countQuestionsAsked(messages)).toBe(2);
  });

  it("skips failed or denied calls and non-assistant messages", () => {
    const messages = [
      { role: "assistant", parts: [ask("output-error"), ask("output-denied")] },
      { role: "user", parts: [ask("output-available")] },
      { role: "assistant" },
    ];
    expect(countQuestionsAsked(messages)).toBe(0);
  });

  it("counts only the questions since the last shortlist Pica showed", () => {
    const shortlist = (state: string) => ({ type: "tool-present_shortlist", state });
    const messages = [
      { role: "assistant", parts: [ask("output-available")] },
      { role: "assistant", parts: [ask("output-available")] },
      { role: "assistant", parts: [ask("output-available")] },
      { role: "assistant", parts: [ask("output-available")] },
      { role: "assistant", parts: [shortlist("output-available")] },
      { role: "user", parts: [{ type: "text" }] },
      { role: "assistant", parts: [ask("output-available")] },
    ];
    expect(countQuestionsAsked(messages)).toBe(1);
  });

  it("keeps counting past a shortlist that failed, and orders parts within a message", () => {
    const shortlist = (state: string) => ({ type: "tool-present_shortlist", state });
    expect(
      countQuestionsAsked([
        { role: "assistant", parts: [ask("output-available"), shortlist("output-error")] },
        { role: "assistant", parts: [ask("output-available")] },
      ]),
    ).toBe(2);
    expect(
      countQuestionsAsked([
        { role: "assistant", parts: [ask("output-available"), shortlist("output-available"), ask("output-available")] },
      ]),
    ).toBe(1);
  });

  it("reports how many are left, never below zero", () => {
    expect(questionsLeft(1)).toBe(MAX_QUESTIONS - 1);
    expect(questionsLeft(MAX_QUESTIONS + 2)).toBe(0);
  });
});
