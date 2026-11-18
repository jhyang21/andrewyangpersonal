import { describe, expect, it } from "vitest";
import { createSession } from "@/pica/lib/session";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import { decisionFacts, NO_FACTS } from "./saved-card-model";

describe("decisionFacts", () => {
  it("gives the path's counts, leaving out empty stages", () => {
    expect(decisionFacts(seedDecision(1))).toBe("4 needs · 4 options · Comparing 3");
  });

  it("says so when there is nothing yet", () => {
    expect(decisionFacts(createSession({ id: "a", at: 1, title: "A bag" }))).toBe(NO_FACTS);
    expect(NO_FACTS).toBe("No needs yet");
  });
});
