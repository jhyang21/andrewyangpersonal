import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchCatalog, ShopifyError } from "@/pica/lib/shopify";
import type {
  AskQuestionOutput,
  Canvas,
  CompareProductsOutput,
  PresentShortlistOutput,
  SearchCatalogOutput,
  UpdateCanvasOutput,
} from "@/pica/lib/types";
import { MAX_QUESTIONS, PICA_MESSAGES } from "./constants";
import { createPicaTools, TOOL_FAILED_TEXT, type PicaToolsContext } from "./tools";
import { makeProduct, makeSession } from "./test-helpers";

vi.mock("@/pica/lib/shopify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/pica/lib/shopify")>()),
  searchCatalog: vi.fn(),
}));

const searchMock = vi.mocked(searchCatalog);

// Keep the Decisions helper out of these tests: no key, so it never calls out.
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "");
  searchMock.mockReset();
});

async function run<T>(tools: Record<string, unknown>, name: string, input: unknown): Promise<T> {
  const tool = tools[name] as { execute: (input: unknown, options: unknown) => Promise<T> };
  return tool.execute(input, { toolCallId: "call-1", messages: [] });
}

function setup(overrides: Partial<PicaToolsContext> = {}) {
  let n = 0;
  return createPicaTools({
    session: makeSession(),
    questionsAsked: 0,
    now: () => 1234,
    makeId: () => `item-${++n}`,
    ...overrides,
  });
}

const p1 = makeProduct({ id: "p-1", title: "Slim Commuter Backpack" });
const p2 = makeProduct({ id: "p-2", title: "Rolltop Pack" });
const p3 = makeProduct({
  id: "p-3",
  title: "Everyday Tote",
  descriptionText: "",
  summarized: { sellingPoints: [], features: [], specs: [] },
});

const entry = (productId: string, angle: string) => ({
  productId,
  angle,
  whyItFits: ["Has a padded laptop sleeve"],
  whyNot: ["The straps are thin"],
  valueNote: "Costs more than the others for a lighter build",
  unverified: ["Long-term durability"],
});

describe("update_canvas", () => {
  it("returns the full canvas and keeps it for later calls", async () => {
    const { tools, getCanvas } = setup();
    const first = await run<UpdateCanvasOutput>(tools, "update_canvas", {
      category: "backpack",
      add: [{ kind: "must_have", text: "Fits a 16-inch laptop", source: "stated" }],
    });
    expect(first.canvas.items).toEqual([
      { id: "item-1", kind: "must_have", text: "Fits a 16-inch laptop", source: "stated" },
    ]);
    const second = await run<UpdateCanvasOutput>(tools, "update_canvas", {
      add: [{ kind: "preference", text: "Black", source: "inferred" }],
    });
    expect(second.canvas.category).toBe("backpack");
    expect(second.canvas.items).toHaveLength(2);
    expect(getCanvas()).toEqual(second.canvas);
  });
});

describe("ask_question", () => {
  const question = { question: "Do you carry a laptop?", why: "It decides the size.", options: ["Yes", "No"] };

  it("returns the question", async () => {
    const { tools } = setup();
    const out = await run<AskQuestionOutput>(tools, "ask_question", question);
    expect(out).toEqual({ question });
  });

  it("refuses past the question limit", async () => {
    const { tools } = setup({ questionsAsked: MAX_QUESTIONS });
    await expect(run(tools, "ask_question", question)).rejects.toThrow(/used all 4 questions/);
  });

  it("refuses a second question in the same turn", async () => {
    const { tools } = setup();
    await run(tools, "ask_question", question);
    await expect(run(tools, "ask_question", question)).rejects.toThrow(/one question per turn/);
  });

  it("allows a new question after a shortlist in the same request", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1, p2] }), questionsAsked: MAX_QUESTIONS });
    await expect(run(tools, "ask_question", question)).rejects.toThrow(/used all 4 questions/);
    await run(tools, "present_shortlist", {
      entries: [entry("p-1", "The slimmer option"), entry("p-2", "The roomier option")],
      note: "I found two good fits to weigh.",
    });
    await expect(run(tools, "ask_question", question)).resolves.toEqual({ question });
  });

  it("refuses pressure words", async () => {
    const { tools } = setup();
    await expect(
      run(tools, "ask_question", { ...question, why: "So I can find the best one." }),
    ).rejects.toThrow(/"best"/);
  });
});

describe("search_catalog", () => {
  it("returns full products to the client and a digest to the model", async () => {
    searchMock.mockResolvedValue({ products: [p1, p2], totalCount: 2, nextCursor: null });
    const { tools, known } = setup({
      session: makeSession({ canvas: { ...makeSession().canvas, category: "backpack" } }),
    });
    const out = await run<SearchCatalogOutput>(tools, "search_catalog", { query: "commuter backpack", maxPriceUsd: 200 });

    expect(searchMock).toHaveBeenCalledWith({
      query: "commuter backpack",
      limit: 10,
      category: "backpack",
      maxPriceUsd: 200,
    });
    expect(out.products).toEqual([p1, p2]);
    expect(out.problem).toBeUndefined();
    expect(known.has("p-1")).toBe(true);

    const toModel = await tools.search_catalog.toModelOutput!({ toolCallId: "call-1", input: { query: "x" }, output: out });
    const text = JSON.stringify(toModel);
    expect(text).toContain("p-1");
    expect(text).toContain("Shopify generated this");
    expect(text).not.toMatch(/https?:|cdn\.shopify|checkout/i);
  });

  it("takes the price range from the canvas budget when the model passes none", async () => {
    searchMock.mockResolvedValue({ products: [p1], totalCount: 1, nextCursor: null });
    const canvas: Canvas = { ...makeSession().canvas, budget: { minUsd: 50, maxUsd: 150, source: "stated" } };
    const { tools } = setup({ session: makeSession({ canvas }) });

    await run(tools, "search_catalog", { query: "tote" });
    expect(searchMock).toHaveBeenLastCalledWith({ query: "tote", limit: 10, minPriceUsd: 50, maxPriceUsd: 150 });

    // A field the model passes wins, for a stretch option.
    await run(tools, "search_catalog", { query: "tote", maxPriceUsd: 220 });
    expect(searchMock).toHaveBeenLastCalledWith({ query: "tote", limit: 10, minPriceUsd: 50, maxPriceUsd: 220 });
  });

  it("swaps a reversed price range", async () => {
    searchMock.mockResolvedValue({ products: [p1], totalCount: 1, nextCursor: null });
    const { tools } = setup();
    await run(tools, "search_catalog", { query: "tote", minPriceUsd: 300, maxPriceUsd: 100 });
    expect(searchMock).toHaveBeenLastCalledWith({ query: "tote", limit: 10, minPriceUsd: 100, maxPriceUsd: 300 });

    // A model minimum above the canvas maximum is swapped too.
    const canvas: Canvas = { ...makeSession().canvas, budget: { maxUsd: 80, source: "stated" } };
    const second = setup({ session: makeSession({ canvas }) });
    await run(second.tools, "search_catalog", { query: "tote", minPriceUsd: 120 });
    expect(searchMock).toHaveBeenLastCalledWith({ query: "tote", limit: 10, minPriceUsd: 80, maxPriceUsd: 120 });
  });

  it("returns a problem when the catalog fails", async () => {
    searchMock.mockRejectedValue(
      new ShopifyError({ code: "rate_limited", message: "Shopify is busy. Try again in a minute." }),
    );
    const { tools } = setup();
    const out = await run<SearchCatalogOutput>(tools, "search_catalog", { query: "tote" });
    expect(out).toEqual({
      products: [],
      totalCount: null,
      problem: { code: "rate_limited", message: "Shopify is busy. Try again in a minute." },
    });
  });

  it("returns a buyer-facing problem for an unknown failure", async () => {
    searchMock.mockRejectedValue(new Error("socket hang up"));
    const { tools } = setup();
    const out = await run<SearchCatalogOutput>(tools, "search_catalog", { query: "tote" });
    expect(out.problem).toEqual({ code: "catalog_unavailable", message: PICA_MESSAGES.catalogUnavailable });
  });

  it("returns a problem when nothing matches", async () => {
    searchMock.mockResolvedValue({ products: [], totalCount: 0, nextCursor: null });
    const { tools } = setup();
    const out = await run<SearchCatalogOutput>(tools, "search_catalog", { query: "tote" });
    expect(out.problem).toEqual({ code: "not_found", message: PICA_MESSAGES.noResults });
  });
});

describe("present_shortlist", () => {
  it("accepts products from the session and from this request's search", async () => {
    searchMock.mockResolvedValue({ products: [p2], totalCount: 1, nextCursor: null });
    const { tools } = setup({ session: makeSession({ products: [p1, p3] }) });
    await run(tools, "search_catalog", { query: "pack" });
    const out = await run<PresentShortlistOutput>(tools, "present_shortlist", {
      entries: [entry("p-1", "The slimmer option"), entry("p-2", "The roomier option"), entry("p-3", "The tote")],
      note: "If your current bag still works, waiting is fine too.",
    });
    expect(out.shortlist.entries.map((e) => e.productId)).toEqual(["p-1", "p-2", "p-3"]);
    expect(out.shortlist).toMatchObject({ createdAt: 1234, stale: false });
  });

  it("accepts a product over the canvas budget, as a stretch option", async () => {
    // Every test product costs $129.
    const canvas: Canvas = { ...makeSession().canvas, budget: { maxUsd: 100, source: "stated" } };
    const { tools } = setup({ session: makeSession({ canvas, products: [p1, p2] }) });
    const out = await run<PresentShortlistOutput>(tools, "present_shortlist", {
      entries: [entry("p-1", "The slimmer option"), entry("p-2", "The roomier option")],
      note: "I found only two, and both cost more than you planned. A cheaper bag may do.",
    });
    expect(out.shortlist.entries).toHaveLength(2);
  });

  it("rejects an unknown ID", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1] }) });
    await expect(
      run(tools, "present_shortlist", { entries: [entry("p-1", "A"), entry("ghost", "B")], note: "Two picks." }),
    ).rejects.toThrow(/ghost is not a product from the catalog/);
  });

  it("rejects a duplicate ID", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1] }) });
    await expect(
      run(tools, "present_shortlist", { entries: [entry("p-1", "A"), entry("p-1", "B")], note: "Two picks." }),
    ).rejects.toThrow(/more than once/);
  });

  it("rejects a near-identical pair", async () => {
    const twin = makeProduct({ id: "p-1b", title: "Slim Commuter Backpack" });
    const { tools } = setup({ session: makeSession({ products: [p1, twin] }) });
    await expect(
      run(tools, "present_shortlist", { entries: [entry("p-1", "A"), entry("p-1b", "B")], note: "Two picks." }),
    ).rejects.toThrow(/same product from the same seller/);
  });

  it("rejects prices and pressure in the text", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1, p2] }) });
    await expect(
      run(tools, "present_shortlist", {
        entries: [{ ...entry("p-1", "The best value"), valueNote: "Only $129" }, entry("p-2", "B")],
        note: "Two picks.",
      }),
    ).rejects.toThrow(/entry 1 angle contains "best"[\s\S]*entry 1 valueNote contains a price/);
  });

  it("lets tool text repeat an amount the buyer gave, but no other", async () => {
    const session = makeSession({ products: [p1, p2] });
    const { tools } = setup({ session, allowedAmounts: [200] });
    const out = await run<PresentShortlistOutput>(tools, "present_shortlist", {
      entries: [{ ...entry("p-1", "A"), valueNote: "Under your $200 limit" }, entry("p-2", "B")],
      note: "Two picks.",
    });
    expect(out.shortlist.entries[0].valueNote).toBe("Under your $200 limit");

    const other = setup({ session, allowedAmounts: [200] });
    await expect(
      run(other.tools, "present_shortlist", {
        entries: [{ ...entry("p-1", "A"), valueNote: "Under your $200.00 limit at $149" }, entry("p-2", "B")],
        note: "Two picks.",
      }),
    ).rejects.toThrow(/entry 1 valueNote contains a price/);
  });
});

describe("compare_products", () => {
  it("orders cells by product, fills gaps and downgrades unsupported sources", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1, p3] }) });
    const out = await run<CompareProductsOutput>(tools, "compare_products", {
      productIds: ["p-1", "p-3"],
      rows: [
        {
          priority: "Fits a 16-inch laptop",
          cells: [
            { productId: "p-3", note: "The listing says it holds a laptop", basis: "merchant", quote: "holds a laptop" },
            { productId: "p-1", note: "Padded 16-inch sleeve", basis: "merchant", quote: "a padded 16 inch laptop pocket" },
          ],
        },
        {
          priority: "Weather",
          cells: [{ productId: "p-3", note: "Shopify's summary says nylon", basis: "catalog_summary", quote: "Nylon" }],
        },
      ],
      takeaway: "The backpack protects a laptop; the tote is lighter to carry.",
    });
    expect(out.comparison.rows[0].cells).toEqual([
      {
        productId: "p-1",
        note: "Padded 16-inch sleeve",
        basis: "merchant",
        quote: "Water-repellent nylon with a padded 16 inch laptop pocket.",
      },
      // p-3 has no merchant description, so the claim is Pica's read.
      { productId: "p-3", note: "The listing says it holds a laptop", basis: "inference" },
    ]);
    expect(out.comparison.rows[1].cells).toEqual([
      { productId: "p-1", note: "Not covered.", basis: "missing" },
      { productId: "p-3", note: "Shopify's summary says nylon", basis: "inference" },
    ]);
  });

  it("keeps a source label only when its quote is in the text the model read", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1, p2] }) });
    const cell = (basis: string, quote: string) => ({ productId: "p-1", note: "A claim", basis, quote });
    const out = await run<CompareProductsOutput>(tools, "compare_products", {
      productIds: ["p-1", "p-2"],
      rows: [
        // Case, spaces and punctuation don't matter.
        { priority: "Weather", cells: [cell("merchant", "WATER REPELLENT   nylon,")] },
        // A quote may not cross a link the digest removed.
        { priority: "Care", cells: [cell("merchant", "See for care tips")] },
        { priority: "Material", cells: [cell("catalog_summary", "Material: nylon")] },
        // Made up.
        { priority: "Rain", cells: [cell("merchant", "fully waterproof")] },
        // Whole words only: "6 inch" is not "16 inch".
        { priority: "Laptop", cells: [cell("merchant", "6 inch laptop")] },
        // Merchant words labelled as Shopify's summary.
        { priority: "Build", cells: [cell("catalog_summary", "water-repellent nylon")] },
        // Spans two summary lines.
        { priority: "Pockets", cells: [cell("catalog_summary", "Padded laptop sleeve Bottle pocket")] },
      ],
      takeaway: "A tradeoff between the two.",
    });
    const first = out.comparison.rows.map((row) => row.cells[0]);
    expect(first.map((c) => c.basis)).toEqual([
      "merchant",
      "inference",
      "catalog_summary",
      "inference",
      "inference",
      "inference",
      "inference",
    ]);
    // The cell carries the listing's whole sentence, not the model's copy.
    expect(first[0].quote).toBe("Water-repellent nylon with a padded 16 inch laptop pocket.");
    expect(first[1].quote).toBeUndefined();
    expect(first[2].quote).toBe("Material: Nylon");
    expect(first.slice(3).every((c) => c.quote === undefined)).toBe(true);
  });

  it("makes a merchant or summary cell with no quote Pica's read", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1, p2] }) });
    const out = await run<CompareProductsOutput>(tools, "compare_products", {
      productIds: ["p-1", "p-2"],
      rows: [
        { priority: "Weight", cells: [{ productId: "p-1", note: "Light", basis: "merchant" }] },
        { priority: "Build", cells: [{ productId: "p-2", note: "Nylon", basis: "catalog_summary" }] },
      ],
      takeaway: "A tradeoff.",
    });
    expect(out.comparison.rows[0].cells[0]).toEqual({ productId: "p-1", note: "Light", basis: "inference" });
    expect(out.comparison.rows[1].cells[1]).toEqual({ productId: "p-2", note: "Nylon", basis: "inference" });
  });

  it("rejects unknown IDs and stray cells", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1, p2] }) });
    await expect(
      run(tools, "compare_products", {
        productIds: ["p-1", "nope"],
        rows: [{ priority: "Weight", cells: [{ productId: "p-2", note: "Light", basis: "inference" }] }],
        takeaway: "A tradeoff.",
      }),
    ).rejects.toThrow(/nope is not a product[\s\S]*cell for p-2, which is not in productIds/);
  });
});

describe("second review fixes", () => {
  it("checks ask_question text for catalog facts, letting the buyer's amounts through", async () => {
    const budgetQuestion = {
      question: "What's your budget?",
      why: "It sets the price range.",
      options: ["Under $100", "$100 to $200"],
    };
    await expect(run(setup().tools, "ask_question", budgetQuestion)).rejects.toThrow(/option 1 contains a price/);
    const allowed = setup({ allowedAmounts: [100, 200] });
    await expect(run(allowed.tools, "ask_question", budgetQuestion)).resolves.toEqual({ question: budgetQuestion });
  });

  it("does not let a budget the model sets clear an amount later in the same request", async () => {
    // The model sets the budget to a product's price, then names that price.
    const { tools } = setup({ session: makeSession({ products: [p1, p2, p3] }), allowedAmounts: [] });
    await run(tools, "update_canvas", { budget: { maxUsd: 129, source: "stated" } });
    await expect(
      run(tools, "present_shortlist", {
        entries: [{ ...entry("p-1", "A"), valueNote: "It costs $129" }, entry("p-2", "B"), entry("p-3", "C")],
        note: "Three to weigh.",
      }),
    ).rejects.toThrow(/entry 1 valueNote contains a price/);
  });

  it("sends a generic line, not the error text, when a tool fails for another reason", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { tools } = setup({
      makeId: () => {
        throw new Error("db at /srv/secret refused");
      },
    });
    const call = run(tools, "update_canvas", { add: [{ kind: "preference", text: "Black", source: "stated" }] });
    await expect(call).rejects.toThrow(TOOL_FAILED_TEXT);
    await expect(call).rejects.not.toThrow(/secret/);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("requires the note to say so when the shortlist is short", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1, p2] }) });
    await expect(
      run(tools, "present_shortlist", { entries: [entry("p-1", "A"), entry("p-2", "B")], note: "Here they are." }),
    ).rejects.toThrow(/fewer than 3 entries/);
  });
});

describe("canvas typing", () => {
  it("starts from the session canvas", () => {
    const canvas: Canvas = { category: "luggage", outcome: null, budget: null, items: [] };
    expect(setup({ session: makeSession({ canvas }) }).getCanvas()).toBe(canvas);
  });
});

describe("third review fixes", () => {
  it("checks update_canvas outcome, add and change texts like the other tools", async () => {
    const { tools } = setup();
    await expect(
      run(tools, "update_canvas", { outcome: { text: "The best commuter bag", source: "inferred" } }),
    ).rejects.toThrow(/outcome contains "best"/);
    await expect(
      run(tools, "update_canvas", { add: [{ kind: "must_have", text: "Rated 4.6 of 5", source: "inferred" }] }),
    ).rejects.toThrow(/contains a rating/);
    await expect(
      run(tools, "update_canvas", { add: [{ kind: "preference", text: "Costs $129", source: "inferred" }] }),
    ).rejects.toThrow(/contains a price/);
  });

  it("lets update_canvas keep the buyer's own amount", async () => {
    const { tools } = setup({ allowedAmounts: [200] });
    const out = await run<UpdateCanvasOutput>(tools, "update_canvas", {
      add: [{ kind: "must_have", text: "Under $200", source: "stated" }],
    });
    expect(out.canvas.items[0].text).toBe("Under $200");
  });

  it("blocks a bare number equal to a session product's price", async () => {
    const { tools } = setup({ session: makeSession({ products: [p1, p2, p3] }) });
    await expect(
      run(tools, "present_shortlist", {
        entries: [{ ...entry("p-1", "A"), valueNote: "About 129, more than the tote" }, entry("p-2", "B"), entry("p-3", "C")],
        note: "Three to weigh.",
      }),
    ).rejects.toThrow(/entry 1 valueNote contains a price/);
  });

  it("blocks a bare number equal to a price found in this request's search", async () => {
    const cheap = makeProduct({
      id: "p-9",
      priceRange: { min: { amount: 4500, currency: "USD" }, max: { amount: 4500, currency: "USD" } },
    });
    searchMock.mockResolvedValue({ products: [cheap], totalCount: 1, nextCursor: null });
    const { tools } = setup({ session: makeSession({ products: [p1, p2] }) });
    await run(tools, "search_catalog", { query: "tote" });
    await expect(
      run(tools, "present_shortlist", {
        entries: [{ ...entry("p-9", "A"), valueNote: "Only 45 for a lighter build" }, entry("p-1", "B"), entry("p-2", "C")],
        note: "Three to weigh.",
      }),
    ).rejects.toThrow(/entry 1 valueNote contains a price/);
  });

  it("turns a quote whose sentence carries a rating into Pica's read", async () => {
    const puffy = makeProduct({ id: "p-7", descriptionText: "Rated 4.9 by commuters who carry a laptop daily." });
    const { tools } = setup({ session: makeSession({ products: [p1, puffy] }) });
    const out = await run<CompareProductsOutput>(tools, "compare_products", {
      productIds: ["p-1", "p-7"],
      rows: [
        {
          priority: "Laptop",
          cells: [{ productId: "p-7", note: "Built for laptops", basis: "merchant", quote: "commuters who carry a laptop" }],
        },
      ],
      takeaway: "A tradeoff.",
    });
    expect(out.comparison.rows[0].cells[1]).toEqual({ productId: "p-7", note: "Built for laptops", basis: "inference" });
  });
});

describe("fourth review fixes", () => {
  it("stores a budget the buyer never gave as inferred, whatever the model says", async () => {
    const { tools } = setup({ allowedAmounts: [150, 200] });
    const madeUp = await run<UpdateCanvasOutput>(tools, "update_canvas", { budget: { maxUsd: 129, source: "stated" } });
    expect(madeUp.canvas.budget).toEqual({ maxUsd: 129, source: "inferred" });
    const half = await run<UpdateCanvasOutput>(tools, "update_canvas", {
      budget: { minUsd: 150, maxUsd: 250, source: "stated" },
    });
    expect(half.canvas.budget).toEqual({ minUsd: 150, maxUsd: 250, source: "inferred" });
    const own = await run<UpdateCanvasOutput>(tools, "update_canvas", {
      budget: { minUsd: 150, maxUsd: 200, source: "stated" },
    });
    expect(own.canvas.budget).toEqual({ minUsd: 150, maxUsd: 200, source: "stated" });
  });

  it("checks a comparison quote against the product's own price as a bare number", async () => {
    const priced = makeProduct({
      id: "p-1",
      title: "Slim Commuter Backpack",
      descriptionText: "Only 129 for the full commuter kit. The bottle pocket holds a large flask.",
    });
    const { tools } = setup({ session: makeSession({ products: [priced, p2] }) });
    const cell = (quote: string) => ({ productId: "p-1", note: "From the listing", basis: "merchant", quote });
    const out = await run<CompareProductsOutput>(tools, "compare_products", {
      productIds: ["p-1", "p-2"],
      rows: [
        { priority: "Kit", cells: [cell("for the full commuter kit")] },
        { priority: "Flask", cells: [cell("bottle pocket holds")] },
      ],
      takeaway: "A tradeoff between the two.",
    });
    const [kit, flask] = out.comparison.rows.map((row) => row.cells[0]);
    expect(kit).toEqual({ productId: "p-1", note: "From the listing", basis: "inference" });
    expect(flask).toMatchObject({ basis: "merchant", quote: "The bottle pocket holds a large flask." });
  });
});
