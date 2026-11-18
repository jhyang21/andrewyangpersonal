/**
 * What the header menu inside a decision offers, without React.
 */
import type { DecisionSession } from "@/pica/lib/types";
import { needsOf } from "@/pica/features/workspace/canvas-model";

export const DECISION_MENU = {
  toggle: "Save or end this decision",
  save: "Save for later",
  end: "End without buying",
} as const;

export interface DecisionMenuActions {
  save: boolean;
  end: boolean;
}

/**
 * Neither action shows until the decision has at least one need (brief
 * section 6.10). Then: "Save for later" while it is open; "End without
 * buying" while it is open or saved. A decision already bought or ended has
 * nothing to offer, and the menu hides.
 */
export function decisionMenuActions(session: Pick<DecisionSession, "canvas" | "decision">): DecisionMenuActions {
  if (needsOf(session.canvas).length === 0) return { save: false, end: false };
  const status = session.decision.status;
  return { save: status === "open", end: status === "open" || status === "saved" };
}

export function hasMenu(actions: DecisionMenuActions): boolean {
  return actions.save || actions.end;
}
