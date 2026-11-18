/**
 * Done's words and the small rules behind what it shows. Pure. What Done
 * shows for a decision lives in done-model.ts.
 */
import { BASE } from "@/pica/lib/base";
import type { PicaPose } from "@/pica/components/mascot";
import type { CatalogProduct, DecisionStatus } from "@/pica/lib/types";
import type { ConfidenceKey } from "./confidence-model";

export const DONE = {
  notBuying: "Deciding not to buy is a real answer.",
  stillOpen: "Go back to it whenever you're ready.",
  checkInHeading: "Check in later",
  checkIn:
    "Once you've used it for a while, tell Pica whether it met what you needed. Find “Check in” on this decision in Saved.",
  orders: "Pica can't see your orders. The merchant's email has your order status.",
  confidenceHeading: "How sure do you feel?",
  confidenceNote: "Optional. Answer all three to save them.",
  confidenceSaved: "Your answers are saved.",
  yes: "Yes",
  no: "No",
  newDecision: "Start a new decision",
  backToDecision: "Back to this decision",
  saved: "Saved",
} as const;

/**
 * Pica's pose. Bought and not buying get the same pose, so neither outcome
 * looks like the better one; saved rests.
 */
export function donePose(status: DecisionStatus): PicaPose {
  switch (status) {
    case "bought":
    case "declined":
      return "settled";
    case "saved":
      return "resting";
    case "open":
      return "idle";
  }
}

/** The one display line: what happened, in the brief's words. */
export function outcomeLine(status: DecisionStatus, product: CatalogProduct | undefined): string {
  switch (status) {
    case "bought":
      return product ? `You bought the ${product.title}` : "You bought it";
    case "declined":
      return "You decided not to buy";
    case "saved":
      return "Saved for later";
    case "open":
      return "This decision is still open";
  }
}

/** The three statements, in order, as the buyer reads them. */
export const CONFIDENCE_STATEMENTS: readonly { key: ConfidenceKey; text: string }[] = [
  { key: "understandNeeds", text: "I know what I need" },
  { key: "canExplainTradeoffs", text: "I can explain the tradeoffs" },
  { key: "confidentInChoice", text: "I'm confident in this choice" },
];

/** The links at the foot of Done. */
export function doneLinks(sessionId: string): { label: string; href: string }[] {
  return [
    { label: DONE.newDecision, href: BASE },
    { label: DONE.backToDecision, href: `${BASE}/d/${sessionId}` },
    { label: DONE.saved, href: `${BASE}/saved` },
  ];
}
