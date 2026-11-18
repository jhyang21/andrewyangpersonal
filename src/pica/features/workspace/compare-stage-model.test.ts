import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import {
  LABEL_COLUMN_PX,
  MIN_COLUMN_PX,
  compareButtonText,
  compareCaution,
  comparisonGap,
  layoutClasses,
  pickedProducts,
  picksChangedBody,
  tableMinWidth,
} from "./compare-stage-model";

const seed = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const LIMITS = { min: 2, max: 5 };

describe("compareButtonText", () => {
  it("names the count once there are enough picks", () => {
    expect(compareButtonText(3, 2)).toBe("Compare these 3");
    expect(compareButtonText(1, 2)).toBe("Compare these options");
  });

  it("gives the picks-changed banner one fixed line with no count", () => {
    expect(picksChangedBody(LIMITS)).toBe("Pick 2 to 5 options above and compare them to replace this one.");  });
});

describe("compareCaution", () => {
  it("shows at most one banner, picks first", () => {
    expect(compareCaution({ picksChanged: false, needsChanged: false })).toBeNull();
    expect(compareCaution({ picksChanged: true, needsChanged: false })).toBe("picks_changed");
    expect(compareCaution({ picksChanged: false, needsChanged: true })).toBe("needs_changed");
    expect(compareCaution({ picksChanged: true, needsChanged: true })).toBe("picks_changed");
  });
});

describe("comparisonGap", () => {
  const gap = (hasComparison: boolean, comparedCount: number, candidateCount: number) =>
    comparisonGap({ hasComparison, comparedCount, candidateCount, limits: LIMITS });

  it("says how to get a comparison when there are enough options", () => {
    expect(gap(false, 0, 4)).toEqual({ kind: "empty", text: "Pick 2 to 5 options above, then ask Pica to compare them." });
  });

  it("adds nothing with fewer options than the minimum, so the picks line speaks alone", () => {
    expect(gap(false, 0, 1)).toEqual({ kind: "none" });
    expect(gap(false, 0, 0)).toEqual({ kind: "none" });
  });

  it("names a comparison whose products are mostly gone, not 'No comparison yet'", () => {
    const lost = {
      kind: "lost",
      text: "Pica's comparison cannot show: fewer than 2 of the options it compared are still in your list.",
    };
    expect(gap(true, 1, 4)).toEqual(lost);
    expect(gap(true, 0, 1)).toEqual(lost);
    expect(gap(true, 2, 4).kind).toBe("empty");
  });
});

describe("pickedProducts", () => {
  it("keeps pick order and drops ids the session does not hold", () => {
    const [a, b] = seed.shortlist!.entries.map((entry) => entry.productId);
    expect(pickedProducts(seed, [b, "gone", a]).map((product) => product.id)).toEqual([b, a]);
  });
});

describe("layout", () => {
  it("needs a 128px label column and 160px per option", () => {
    expect(LABEL_COLUMN_PX).toBe(128);
    expect(MIN_COLUMN_PX).toBe(160);
    expect(tableMinWidth(4)).toBe(768);
  });

  it("switches to the table at exactly that width, for two to five options", () => {
    for (const count of [2, 3, 4, 5]) {
      const width = tableMinWidth(count);
      expect(layoutClasses(count)).toEqual({
        table: `hidden @min-[${width}px]:block`,
        stack: `@min-[${width}px]:hidden`,
      });
    }
  });

  it("stacks any other count", () => {
    expect(layoutClasses(1)).toEqual({ table: "hidden", stack: "" });
    expect(layoutClasses(6)).toEqual({ table: "hidden", stack: "" });
  });

  it("fits five options at 1024px less the page margins", () => {
    expect(tableMinWidth(5)).toBeLessThanOrEqual(1024 - 32);
  });
});
