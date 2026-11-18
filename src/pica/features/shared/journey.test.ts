import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSession } from "@/pica/lib/session";
import type { CanvasItem, CatalogProduct, DecisionSession, ShortlistEntry } from "@/pica/lib/types";
import { JOURNEY_STAGES, doneHref, journeyHref, journeySteps, optionCount, stageForView } from "./journey";

function product(id: string): CatalogProduct {
  return {
    id,
    title: id,
    descriptionText: "",
    images: [],
    seller: { id: "s", name: "Shop", links: [] },
    priceRange: { min: { amount: 1, currency: "USD" }, max: { amount: 1, currency: "USD" } },
    options: [],
    variants: [],
    summarized: { sellingPoints: [], features: [], specs: [] },
    fetchedAt: 1,
  };
}

const entry = (productId: string): ShortlistEntry => ({
  productId,
  angle: "",
  whyItFits: [],
  whyNot: [],
  valueNote: "",
  unverified: [],
});

const item = (id: string, kind: CanvasItem["kind"]): CanvasItem => ({ id, kind, text: id, source: "stated" });

const empty = createSession({ id: "s1", at: 1, title: "Bag" });

const full: DecisionSession = {
  ...empty,
  canvas: { ...empty.canvas, items: [item("a", "must_have"), item("b", "preference"), item("q", "open_question")] },
  products: { p1: product("p1"), p2: product("p2"), p3: product("p3") },
  shortlist: { entries: ["p1", "p2", "p3", "gone"].map(entry), note: "", createdAt: 2, stale: false },
  comparison: { productIds: ["p1", "p2"], rows: [], takeaway: "", createdAt: 3, stale: false },
};

const facts = (session: DecisionSession, chosen?: string) =>
  journeySteps(session, null, chosen).map((step) => step.fact);

describe("doneHref", () => {
  it("is Done's address, and the one place a screen builds it", () => {
    expect(doneHref("s1")).toBe("/projects/pica/d/s1/done");
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return files(path);
        return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
      });
    const own = join("src", "pica", "features", "shared", "journey.ts");
    for (const path of files(join("src", "pica", "features")).filter((p) => p !== own)) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/\$\{[^}]*\}\/done`/);
    }
  });
});

describe("optionCount", () => {
  it("counts the shortlist's entries that still have a product record, for every place that shows it", () => {
    expect(optionCount(empty)).toBe(0);
    expect(optionCount(full)).toBe(3);
  });
});

describe("journey", () => {
  it("has the four stages in order, each with a label", () => {
    const steps = journeySteps(empty, null);
    expect(steps.map((s) => s.stage)).toEqual([...JOURNEY_STAGES]);
    expect(steps.map((s) => s.label)).toEqual(["Needs", "Options", "Compare", "Decide"]);
  });

  it("an empty decision reads as not started, and Decide reads Nothing chosen", () => {
    expect(facts(empty)).toEqual(["None yet", "None yet", "Optional", "Nothing chosen"]);
  });

  it("counts needs (must-haves and nice-to-haves only), options with records, and compared products", () => {
    expect(facts(full)).toEqual(["2 needs", "3 options", "Comparing 2", "Nothing chosen"]);
    const one: DecisionSession = {
      ...full,
      canvas: { ...full.canvas, items: [item("a", "must_have")] },
      shortlist: { ...full.shortlist!, entries: [entry("p1")] },
    };
    expect(facts(one).slice(0, 2)).toEqual(["1 need", "1 option"]);
  });

  it("Decide with nothing chosen links to Options", () => {
    const decide = journeySteps(empty, null).at(-1)!;
    expect(decide.target).toEqual({ kind: "workspace", view: "options", needsOpen: false });
    expect(decide.href).toBe("/projects/pica/d/s1?view=options");
  });

  it("Decide links to the chosen option", () => {
    const decide = journeySteps(full, null, "p2").at(-1)!;
    expect(decide.fact).toBe("Chosen");
    expect(decide.href).toBe("/projects/pica/d/s1/decide?product=p2");
  });

  it("Decide falls back to the checkout target", () => {
    const saved: DecisionSession = { ...full, decision: { status: "saved", productId: "p3" } };
    const decide = journeySteps(saved, null).at(-1)!;
    expect(decide.fact).toBe("Saved");
    expect(decide.target).toEqual({ kind: "decide", productId: "p3" });
  });

  it("names the outcome once decided", () => {
    expect(facts({ ...full, decision: { status: "bought" } }).at(-1)).toBe("Bought");
    expect(facts({ ...full, decision: { status: "declined" } }).at(-1)).toBe("Not buying");
  });

  it("every stage links, and Needs opens chat with the needs showing", () => {
    const steps = journeySteps(empty, "options");
    expect(steps.map((s) => s.href)).toEqual(["/projects/pica/d/s1?view=canvas", "/projects/pica/d/s1?view=options", "/projects/pica/d/s1?view=compare", "/projects/pica/d/s1?view=options"]);
    expect(steps.filter((s) => s.current).map((s) => s.stage)).toEqual(["options"]);
  });

  it("maps a view to its stage", () => {
    expect(stageForView("chat")).toBe("needs");
    expect(stageForView("options")).toBe("options");
    expect(stageForView("compare")).toBe("compare");
  });

  it("encodes product ids in links", () => {
    expect(journeyHref("s1", { kind: "decide", productId: "gid://p/1" })).toBe("/projects/pica/d/s1/decide?product=gid%3A%2F%2Fp%2F1");
  });
});
