import { describe, expect, it } from "vitest";
import { opensCanvas, parseView } from "./views";

describe("parseView", () => {
  it("keeps the three views", () => {
    expect(parseView("chat")).toBe("chat");
    expect(parseView("options")).toBe("options");
    expect(parseView("compare")).toBe("compare");
  });

  it("maps the old names", () => {
    expect(parseView("shortlist")).toBe("options");
    expect(parseView("canvas")).toBe("chat");
  });

  it("forgives case, spaces and repeated values", () => {
    expect(parseView(" Options ")).toBe("options");
    expect(parseView(["compare", "chat"])).toBe("compare");
  });

  it("falls back to chat for anything else", () => {
    for (const bad of [undefined, null, "", "decide", "__proto__", "toString", 3, {}, [], [7]]) {
      expect(parseView(bad)).toBe("chat");
    }
  });
});

describe("opensCanvas", () => {
  it("is true only for the old canvas tab", () => {
    expect(opensCanvas("canvas")).toBe(true);
    expect(opensCanvas(["canvas"])).toBe(true);
    expect(opensCanvas("chat")).toBe(false);
    expect(opensCanvas(undefined)).toBe(false);
  });
});
