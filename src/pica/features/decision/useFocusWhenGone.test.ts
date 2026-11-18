import { describe, expect, it } from "vitest";
import { shouldRefocus } from "./useFocusWhenGone";

describe("shouldRefocus", () => {
  it("moves focus only when a shown card went and focus fell to the page body", () => {
    expect(shouldRefocus(true, false, true)).toBe(true);
  });

  it("leaves focus alone otherwise", () => {
    expect(shouldRefocus(true, false, false)).toBe(false); // the buyer is elsewhere on the page
    expect(shouldRefocus(false, false, true)).toBe(false); // there was no card
    expect(shouldRefocus(true, true, true)).toBe(false); // the card is still there
    expect(shouldRefocus(false, true, true)).toBe(false); // a card just came
  });
});
