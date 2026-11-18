import { describe, expect, it } from "vitest";
import { createSession } from "@/pica/lib/session";
import type { CanvasItem, CatalogProduct, DecisionSession } from "@/pica/lib/types";
import {
  boughtName,
  buildOutcome,
  checkInChanged,
  checkInItems,
  initialMet,
  isMet,
  outcomeEventProps,
  type MetAnswers,
  type Satisfied,
} from "./checkin-model";

const items: CanvasItem[] = [
  { id: "i1", kind: "must_have", text: "Fits a 15-inch laptop", source: "stated" },
  { id: "i2", kind: "must_have", text: "Water resistant", source: "inferred" },
  { id: "i3", kind: "preference", text: "Black", source: "stated" },
  { id: "i4", kind: "must_have", text: "Under 1 kg", source: "stated" },
];

function withItems(): DecisionSession {
  const base = createSession({ id: "s1", at: 1, title: "Bag" });
  return { ...base, canvas: { ...base.canvas, items } };
}

describe("checkInItems", () => {
  it("asks only about must-haves the buyer stated", () => {
    expect(checkInItems(withItems()).map((item) => item.id)).toEqual(["i1", "i4"]);
  });
});

describe("answers", () => {
  it("opens with the earlier answers", () => {
    const answers = initialMet({
      satisfied: "partly",
      requirements: [
        { itemId: "i1", text: "", met: true },
        { itemId: "i4", text: "", met: null },
      ],
      submittedAt: 1,
    });
    expect(answers).toEqual({ i1: true, i4: null });
    expect(isMet(answers, "i4", null)).toBe(true);
  });

  it("an unanswered item shows no answer, not 'Not sure'", () => {
    expect(isMet({}, "i1", null)).toBe(false);
  });
});

describe("buildOutcome", () => {
  const stated = checkInItems(withItems());

  it("needs the overall answer", () => {
    expect(buildOutcome(stated, { i1: true }, null, "", 1)).toBeNull();
  });

  it("saves every stated must-have, unanswered ones as not sure, and trims the note", () => {
    expect(buildOutcome(stated, { i1: false }, "no", "  strap broke  ", 9)).toEqual({
      satisfied: "no",
      requirements: [
        { itemId: "i1", text: "Fits a 15-inch laptop", met: false },
        { itemId: "i4", text: "Under 1 kg", met: null },
      ],
      note: "strap broke",
      submittedAt: 9,
    });
    expect(buildOutcome(stated, {}, "yes", "   ", 9)?.note).toBeUndefined();
  });

  it("sends counts, never the note's words", () => {
    const outcome = buildOutcome(stated, { i1: true }, "partly", "secret words", 9)!;
    expect(outcomeEventProps(outcome)).toEqual({ satisfied: "partly", met: 1, notMet: 0, unsure: 1, hasNote: true });
  });
});

describe("boughtName", () => {
  it("names the product, or says 'your purchase'", () => {
    const pack = { id: "p1", title: "Day pack" } as unknown as CatalogProduct;
    const session = withItems();
    expect(boughtName(session)).toBe("your purchase");
    const decided = { ...session, products: { p1: pack }, decision: { ...session.decision, productId: "p1" } };
    expect(boughtName(decided)).toBe("the Day pack");
  });
});

describe("checkInChanged", () => {
  const stated = checkInItems(withItems());
  const save = (answers: MetAnswers, satisfied: Satisfied, note = "", at = 10) =>
    buildOutcome(stated, answers, satisfied, note, at)!;
  const stored = save({ i1: true, i4: false }, "partly", "Strap is thin");

  it("sends the first check-in", () => {
    expect(checkInChanged(undefined, stored)).toBe(true);
  });

  it("sends nothing when the same answers are saved again, even later", () => {
    expect(checkInChanged(stored, save({ i1: true, i4: false }, "partly", "Strap is thin", 99))).toBe(false);
  });

  it("does not count rewording a note that was already there", () => {
    expect(checkInChanged(stored, save({ i1: true, i4: false }, "partly", "Strap is very thin"))).toBe(false);
  });

  it("sends when a must-have answer, the overall answer, or having a note changes", () => {
    expect(checkInChanged(stored, save({ i1: true, i4: null }, "partly", "Strap is thin"))).toBe(true);
    expect(checkInChanged(stored, save({ i1: true, i4: false }, "yes", "Strap is thin"))).toBe(true);
    expect(checkInChanged(stored, save({ i1: true, i4: false }, "partly", "   "))).toBe(true);
    expect(checkInChanged(save({ i1: true, i4: false }, "partly"), stored)).toBe(true);
  });

  it("sends when the must-haves asked about are not the ones stored", () => {
    const fewer = { ...stored, requirements: stored.requirements.slice(0, 1) };
    expect(checkInChanged(fewer, stored)).toBe(true);
    const renamed = { ...stored, requirements: [stored.requirements[0], { ...stored.requirements[1], itemId: "i9" }] };
    expect(checkInChanged(renamed, stored)).toBe(true);
  });
});
