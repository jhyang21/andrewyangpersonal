import { describe, expect, it } from "vitest";
import { answersFrom, completeCheck, confidenceEventProps } from "./confidence-model";

describe("confidence check", () => {
  it("saves nothing until all three statements have an answer", () => {
    expect(completeCheck({}, 1)).toBeNull();
    expect(completeCheck({ understandNeeds: true }, 1)).toBeNull();
    expect(completeCheck({ understandNeeds: true, canExplainTradeoffs: false }, 1)).toBeNull();
  });

  it("never saves an unanswered statement as No", () => {
    // Two "Not really" answers and one blank: still nothing to save.
    expect(completeCheck({ understandNeeds: false, confidentInChoice: false }, 1)).toBeNull();
  });

  it("saves once all three are answered, No answers included", () => {
    expect(completeCheck({ understandNeeds: true, canExplainTradeoffs: false, confidentInChoice: true }, 42)).toEqual({
      understandNeeds: true,
      canExplainTradeoffs: false,
      confidentInChoice: true,
      submittedAt: 42,
    });
  });

  it("opens with the saved answers, or none", () => {
    expect(answersFrom(undefined)).toEqual({});
    const saved = { understandNeeds: false, canExplainTradeoffs: true, confidentInChoice: true, submittedAt: 5 };
    expect(answersFrom(saved)).toEqual({ understandNeeds: false, canExplainTradeoffs: true, confidentInChoice: true });
  });

  it("sends the three answers, the status and whether it was an edit", () => {
    const check = { understandNeeds: true, canExplainTradeoffs: true, confidentInChoice: false, submittedAt: 9 };
    expect(confidenceEventProps(check, "bought", true)).toEqual({
      understandNeeds: true,
      canExplainTradeoffs: true,
      confidentInChoice: false,
      status: "bought",
      edited: true,
    });
  });
});
