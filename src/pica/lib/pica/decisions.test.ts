import { openai } from "@ai-sdk/openai";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_CANVAS, type Canvas } from "@/pica/lib/types";
import { NO_TURN_READ, readTurn, screenCandidates } from "./decisions";
import { makeProduct } from "./test-helpers";

// The OpenAI provider, mocked. decisions.ts has no default model, so nothing
// should reach it; any call would land in these spies, never on the network.
const provider = vi.hoisted(() => ({
  doDecide: vi.fn<DoDecide>(async () => ({
    answers: {
      scope: { type: "choice", choice: "backpack" },
      ready: { type: "boolean", probability: 0.9 },
    },
    warnings: [],
  })),
}));

vi.mock("@ai-sdk/openai", async () => {
  const { Experimental_DecisionMockModelV4: Mock } = await import("ai/test");
  const decisionModel = vi.fn(
    () => new Mock({ supportedQuestionTypes: ["choice", "score", "boolean"], doDecide: provider.doDecide }),
  );
  const openai = { decisionModel };
  return { openai, createOpenAI: () => openai };
});

type DoDecide = ConstructorParameters<typeof DecisionMockModel>[0] extends infer O
  ? O extends { doDecide?: infer F }
    ? NonNullable<F>
    : never
  : never;

function mockModel(doDecide: DoDecide) {
  return new DecisionMockModel({
    supportedQuestionTypes: ["choice", "score", "boolean"],
    doDecide,
  });
}

const canvas: Canvas = {
  ...EMPTY_CANVAS,
  category: "backpack",
  items: [{ id: "m1", kind: "must_have", text: "Fits a 16-inch laptop", source: "stated" }],
};
const products = [makeProduct({ id: "p0" }), makeProduct({ id: "p1" }), makeProduct({ id: "p2" })];
const turn = { latestUserText: "I need a work backpack", canvas, recentTurns: [] };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(openai.decisionModel).mockClear();
  provider.doDecide.mockClear();
});

describe("readTurn", () => {
  it("returns scope and readiness when the helper answers", async () => {
    const model = mockModel(async () => ({
      answers: {
        scope: { type: "choice", choice: "backpack" },
        ready: { type: "boolean", probability: 0.8 },
      },
      warnings: [],
    }));
    expect(await readTurn(turn, { model })).toEqual({ scope: "backpack", ready: true });
  });

  it("leaves readiness unknown when the helper is unsure", async () => {
    const model = mockModel(async () => ({
      answers: {
        scope: { type: "choice", choice: "out_of_scope" },
        ready: { type: "boolean", probability: 0.5 },
      },
      warnings: [],
    }));
    expect(await readTurn(turn, { model })).toEqual({ scope: "out_of_scope", ready: null });
  });

  it("asks the model it is given", async () => {
    // Shows the spy below is wired: with a model, the call does reach it.
    expect(await readTurn(turn, { model: mockModel(provider.doDecide) })).toEqual({ scope: "backpack", ready: true });
    expect(provider.doDecide).toHaveBeenCalledTimes(1);
  });

  it("returns no answer without a model and never calls out, even with OPENAI_API_KEY set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-env-not-real-1111111111");
    expect(await readTurn(turn)).toEqual(NO_TURN_READ);
    expect(await readTurn(turn, {})).toEqual(NO_TURN_READ);
    expect(openai.decisionModel).not.toHaveBeenCalled();
    expect(provider.doDecide).not.toHaveBeenCalled();
  });

  it("returns no answer when the helper throws", async () => {
    const model = mockModel(async () => {
      throw new Error("Decisions API down");
    });
    await expect(readTurn(turn, { model })).resolves.toEqual(NO_TURN_READ);
  });

  it("returns no answer when the helper is too slow", async () => {
    const model = mockModel(
      ({ abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal?.addEventListener("abort", () => reject(abortSignal.reason));
        }),
    );
    await expect(readTurn(turn, { model, timeoutMs: 20 })).resolves.toEqual(NO_TURN_READ);
  });
});

describe("screenCandidates", () => {
  it("orders by score and drops clear misfits", async () => {
    const model = mockModel(async () => ({
      answers: {
        p0: { type: "score", score: 1 },
        p1: { type: "score", score: 0 },
        p2: { type: "score", score: 2 },
      },
      warnings: [],
    }));
    const kept = await screenCandidates(products, canvas, { model });
    expect(kept.map((p) => p.id)).toEqual(["p2", "p0"]);
  });

  it("keeps every candidate in order when the helper refuses any question", async () => {
    // The SDK throws on a refusal, so screening falls back to the input.
    const model = mockModel(async () => ({
      answers: {
        p0: { type: "refusal" },
        p1: { type: "score", score: 0 },
        p2: { type: "score", score: 2 },
      },
      warnings: [],
    }));
    expect(await screenCandidates(products, canvas, { model })).toEqual(products);
  });

  it("keeps everything when it would drop every candidate", async () => {
    const model = mockModel(async () => ({
      answers: {
        p0: { type: "score", score: 0 },
        p1: { type: "score", score: 0 },
        p2: { type: "score", score: 0.2 },
      },
      warnings: [],
    }));
    expect(await screenCandidates(products, canvas, { model })).toEqual(products);
  });

  it("skips the call when the canvas has no must-haves", async () => {
    const doDecide = vi.fn();
    const model = mockModel(doDecide);
    expect(await screenCandidates(products, EMPTY_CANVAS, { model })).toEqual(products);
    expect(doDecide).not.toHaveBeenCalled();
  });

  it("returns the input unchanged when the helper fails or has no model", async () => {
    const model = mockModel(async () => {
      throw new Error("Decisions API down");
    });
    expect(await screenCandidates(products, canvas, { model })).toEqual(products);
    expect(await screenCandidates(products, canvas)).toEqual(products);
    expect(openai.decisionModel).not.toHaveBeenCalled();
    expect(provider.doDecide).not.toHaveBeenCalled();
  });

  it("sends digests, not URLs, to the helper", async () => {
    let state = "";
    const model = mockModel(async (options) => {
      state = JSON.stringify(options);
      return {
        answers: Object.fromEntries(products.map((_, i) => [`p${i}`, { type: "score" as const, score: 2 }])),
        warnings: [],
      };
    });
    await screenCandidates(products, canvas, { model });
    expect(state).toContain("Fits a 16-inch laptop");
    expect(state).not.toMatch(/https?:|cdn\.shopify/);
  });
});
