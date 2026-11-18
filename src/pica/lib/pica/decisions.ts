/**
 * Cheap side judgments through the OpenAI Decisions API.
 *
 * Every call here is optional. Any error, timeout, refusal or missing key
 * returns the "no answer" value and Pica carries on without it. Nothing here
 * ever throws, and no score reaches the buyer.
 */
import { experimental_decide as decide } from "ai";
import type { Canvas, CatalogProduct, Category } from "@/pica/lib/types";
import { DECISION_TIMEOUT_MS, PICA_MODEL_ID } from "./constants";
import { digestProduct } from "./digest";
import { mustHaves } from "./canvas";
import { picaProvider } from "./openai-key";

type DecisionModel = Parameters<typeof decide>[0]["model"];

export interface DecisionOptions {
  /** Override the model, for tests. Default: OpenAI, only when a key is set. */
  model?: DecisionModel;
  timeoutMs?: number;
}

function resolveModel(options: DecisionOptions): DecisionModel | null {
  if (options.model) return options.model;
  const openai = picaProvider();
  return openai ? openai.decisionModel(PICA_MODEL_ID) : null;
}

/* ------------------------------------------------------------------ */
/* Turn reading: scope gate and readiness                              */
/* ------------------------------------------------------------------ */

export type ScopeRead = Category | "out_of_scope";

export interface TurnRead {
  /** Null when the helper gave no answer. */
  scope: ScopeRead | null;
  /** Null when the helper gave no answer or was unsure. */
  ready: boolean | null;
}

export const NO_TURN_READ: TurnRead = { scope: null, ready: null };

export async function readTurn(
  input: { latestUserText: string; canvas: Canvas; recentTurns: string[] },
  options: DecisionOptions = {},
): Promise<TurnRead> {
  const model = resolveModel(options);
  if (!model || !input.latestUserText.trim()) return NO_TURN_READ;

  try {
    const result = await decide({
      model,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(options.timeoutMs ?? DECISION_TIMEOUT_MS),
      state: JSON.stringify({
        latestBuyerMessage: input.latestUserText,
        earlierTurns: input.recentTurns,
        canvas: input.canvas,
      }),
      questions: {
        scope: {
          type: "choice",
          instructions:
            "What kind of product would serve the buyer's latest message? It may name a product or a goal, such as a trip, a commute or an event. Read it with the earlier turns. A follow-up that answers a question counts as the category already in play.",
          criteria: {
            bag: "A bag: tote, handbag, crossbody, messenger, duffel, laptop bag, sling or similar. Or a goal a bag serves, such as carrying things to work, an event or the gym.",
            backpack: "A backpack of any kind. Or a goal a backpack serves, such as a daily commute with a laptop, school or a day hike.",
            luggage: "Luggage: suitcase, carry-on, checked bag, garment bag or travel case. Or a goal luggage serves, such as packing for a trip or a flight.",
            out_of_scope: "Something else, such as shoes, clothes or electronics, or a goal that no bag, backpack or luggage can serve.",
          },
        },
        ready: {
          type: "boolean",
          instructions:
            "Has the buyer asked to see products now, or said enough (their goal, or what it is for, and at least one must-have or a budget) to start a search?",
        },
      },
    });

    const scopeAnswer = result.answers.scope;
    const readyAnswer = result.answers.ready;
    const scope = scopeAnswer?.type === "choice" ? (scopeAnswer.choice as ScopeRead) : null;
    let ready: boolean | null = null;
    if (readyAnswer?.type === "boolean") {
      if (readyAnswer.probability >= 0.6) ready = true;
      else if (readyAnswer.probability <= 0.4) ready = false;
    }
    return { scope, ready };
  } catch {
    return NO_TURN_READ;
  }
}

/* ------------------------------------------------------------------ */
/* Screening inside search_catalog                                     */
/* ------------------------------------------------------------------ */

export const SCREEN_LEVELS = [
  "Clearly fails at least one must-have, going by the listing.",
  "Unclear from the listing whether it meets the must-haves.",
  "Meets every must-have, going by the listing.",
] as const;

/** Below this score a candidate counts as a clear misfit. */
const MISFIT_BELOW = 0.5;

/**
 * Order candidates by how well they meet the canvas must-haves and drop
 * clear misfits. Returns the input unchanged when there is nothing to screen
 * against, when the helper fails, or when it would drop every candidate.
 */
export async function screenCandidates(
  products: CatalogProduct[],
  canvas: Canvas,
  options: DecisionOptions = {},
): Promise<CatalogProduct[]> {
  const musts = mustHaves(canvas);
  if (products.length < 2 || musts.length === 0) return products;
  const model = resolveModel(options);
  if (!model) return products;

  const keys = products.map((_, index) => `p${index}`);
  const questions = Object.fromEntries(
    keys.map((key) => [
      key,
      {
        type: "score" as const,
        instructions: `How well does candidate ${key} meet the buyer's must-haves?`,
        criteria: [...SCREEN_LEVELS],
      },
    ]),
  );

  try {
    const result = await decide({
      model,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(options.timeoutMs ?? DECISION_TIMEOUT_MS),
      state: JSON.stringify({
        mustHaves: musts,
        budget: canvas.budget,
        candidates: Object.fromEntries(
          products.map((product, index) => [keys[index], digestProduct(product)]),
        ),
      }),
      questions,
    });

    const scored = products.map((product, index) => {
      const answer = result.answers[keys[index]];
      // The SDK throws on any refusal, which lands in the catch below. A
      // missing answer counts as "unclear", never a misfit.
      const score = answer?.type === "score" ? answer.score : 1;
      return { product, score, index };
    });
    const kept = scored.filter((entry) => entry.score >= MISFIT_BELOW);
    if (kept.length === 0) return products;
    kept.sort((a, b) => b.score - a.score || a.index - b.index);
    return kept.map((entry) => entry.product);
  } catch {
    return products;
  }
}
