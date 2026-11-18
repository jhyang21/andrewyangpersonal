import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import { CONFIDENCE_STATEMENTS, DONE, doneLinks, donePose, outcomeLine } from "./done-screen-model";

const session = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const commuter = session.products["gid://shopify/p/seed-commuter"];

describe("donePose", () => {
  it("gives bought and not buying the same pose, and rests for saved", () => {
    expect(donePose("bought")).toBe("settled");
    expect(donePose("declined")).toBe(donePose("bought"));
    expect(donePose("saved")).toBe("resting");
    expect(donePose("open")).toBe("idle");
  });
});

describe("outcomeLine", () => {
  it("says what happened in the brief's words", () => {
    expect(outcomeLine("bought", commuter)).toBe("You bought the Commuter Pack 24L");
    expect(outcomeLine("bought", undefined)).toBe("You bought it");
    expect(outcomeLine("declined", commuter)).toBe("You decided not to buy");
    expect(outcomeLine("saved", commuter)).toBe("Saved for later");
    expect(outcomeLine("open", undefined)).toBe("This decision is still open");
  });
});

describe("the confidence check", () => {
  it("asks the three statements in order, with Yes and No", () => {
    expect(CONFIDENCE_STATEMENTS.map((s) => s.text)).toEqual([
      "I know what I need",
      "I can explain the tradeoffs",
      "I'm confident in this choice",
    ]);
    expect(DONE.confidenceNote).toMatch(/^Optional\./);
  });
});

describe("doneLinks", () => {
  it("offers a new decision, this decision and Saved", () => {
    expect(doneLinks("abc")).toEqual([
      { label: "Start a new decision", href: "/projects/pica" },
      { label: "Back to this decision", href: "/projects/pica/d/abc" },
      { label: "Saved", href: "/projects/pica/saved" },
    ]);
  });
});
