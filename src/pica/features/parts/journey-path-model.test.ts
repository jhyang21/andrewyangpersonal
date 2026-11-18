import { describe, expect, it } from "vitest";
import { stageFacts } from "@/pica/components/kit";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import type { DecisionSession, DecisionStatus } from "@/pica/lib/types";
import { journeySteps, type JourneyStage } from "@/pica/features/shared/journey";
import { journeyPath } from "./journey-path-model";

const seed = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const commuterId = seed.shortlist!.entries[0].productId;

function withDecision(status: DecisionStatus, productId?: string): DecisionSession {
  return { ...seed, decision: { status, productId } };
}

const empty: DecisionSession = {
  ...seed,
  canvas: { ...seed.canvas, items: [] },
  shortlist: null,
  comparison: null,
};

const CASES: { name: string; session: DecisionSession; current: JourneyStage | null; chosen?: string }[] = [
  { name: "a new decision", session: empty, current: "needs" },
  { name: "the seed, nothing chosen", session: seed, current: "options" },
  { name: "Decide with an option on screen", session: seed, current: "decide", chosen: commuterId },
  { name: "open, with an option decided on", session: withDecision("open", commuterId), current: "compare" },
  { name: "bought", session: withDecision("bought", commuterId), current: null },
  { name: "not buying", session: withDecision("declined"), current: null },
  { name: "saved", session: withDecision("saved"), current: "needs" },
];

describe("journeyPath", () => {
  it.each(CASES)("gives the kit the same facts, links and stage as journeySteps: $name", ({ session, current, chosen }) => {
    const path = journeyPath(session, current, chosen);
    const steps = journeySteps(session, current, chosen);
    const facts = stageFacts(path.counts);
    for (const step of steps) {
      expect(facts[step.stage]).toBe(step.fact);
      expect(path.hrefs[step.stage]).toBe(step.href);
    }
    expect(path.current).toBe(steps.find((step) => step.current)?.stage);
  });

  it("reads Chosen while an option is chosen and the decision is open; an outcome wins", () => {
    expect(stageFacts(journeyPath(seed, "decide", commuterId).counts).decide).toBe("Chosen");
    expect(journeyPath(seed, "decide", commuterId).hrefs.decide).toContain("/decide?product=");
    expect(stageFacts(journeyPath(withDecision("bought", commuterId), null).counts).decide).toBe("Bought");
    expect(stageFacts(journeyPath(seed, "options").counts).decide).toBe("Nothing chosen");
  });

  it("counts needs only: must-haves and nice-to-haves, not open questions", () => {
    expect(journeyPath(seed, null).counts.needs).toBe(4);
  });
});
