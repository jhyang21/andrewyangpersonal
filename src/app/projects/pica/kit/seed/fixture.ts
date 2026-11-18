/**
 * One made-up decision for building and reviewing screens: needs, a guess to
 * confirm, an open question, four options (one sold out, one with unknown
 * stock), a shortlist with its note, and a comparison. Pure, apart from the
 * time passed in.
 *
 * The products, shortlist and comparison come from the demo's data, so Decide
 * cannot load them from the live catalog.
 */
import { createSession, sessionReducer, userMessage } from "@/pica/lib/session";
import { demoComparison, demoProducts, demoShortlist } from "@/pica/features/demo/demo-data";
import type { DecisionSession } from "@/pica/lib/types";

export const SEED_ID = "seed-decision";

/** The four made-up backpacks, shared with the demo. */
export const seedProducts = demoProducts;

/** The seed decision, built only through the session reducer. */
export function seedDecision(at: number): DecisionSession {
  const products = seedProducts(at);
  const ask = "I need a backpack for my commute that fits my 16-inch laptop. Around $150 at most.";

  let session = createSession({
    id: SEED_ID,
    at,
    title: "A commute backpack for a 16-inch laptop",
    products,
    messages: [
      userMessage("seed-m1", ask),
      {
        id: "seed-m2",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Here are four to look at. One is sold out and one doesn't list its stock. I also guessed you'd want it to handle rain; tell me if that's wrong.",
          },
        ],
      },
    ],
    canvas: {
      category: "backpack",
      outcome: { text: "Get my 16-inch laptop to work and back in comfort", source: "stated" },
      budget: { maxUsd: 150, source: "stated" },
      items: [
        { id: "seed-need-1", kind: "must_have", text: "Fits a 16-inch laptop", source: "stated" },
        { id: "seed-need-2", kind: "must_have", text: "Comfortable for a 30-minute walk", source: "stated" },
        // The guess to confirm.
        { id: "seed-guess-1", kind: "must_have", text: "Holds up in rain", source: "inferred" },
        { id: "seed-pref-1", kind: "preference", text: "Plain colours", source: "stated" },
        { id: "seed-open-1", kind: "open_question", text: "Do you carry a water bottle every day?", source: "inferred" },
      ],
    },
  });

  session = sessionReducer(session, {
    type: "tool_output_applied",
    toolCallId: "seed-shortlist",
    at: at + 1,
    tool: "present_shortlist",
    output: { shortlist: demoShortlist(products, at + 1) },
  });

  session = sessionReducer(session, {
    type: "tool_output_applied",
    toolCallId: "seed-compare",
    at: at + 2,
    tool: "compare_products",
    output: { comparison: demoComparison(products, at + 2) },
  });

  return session;
}
