/**
 * The path across the top of a decision: Needs, Options, Compare, Decide.
 * Each stage has a short fact and a link. Every stage links at all times;
 * none is locked, and none opens an error.
 */
import { BASE } from "@/pica/lib/base";
import { checkoutTargetOf } from "@/pica/lib/session";
import type { DecisionSession, DecisionStatus } from "@/pica/lib/types";

export type JourneyStage = "needs" | "options" | "compare" | "decide";

export const JOURNEY_STAGES: readonly JourneyStage[] = ["needs", "options", "compare", "decide"];

/** Where a stage links. Needs opens Chat with the needs showing (a sheet on phone, the canvas on desktop). */
export type JourneyTarget =
  | { kind: "workspace"; view: "chat"; needsOpen: true }
  | { kind: "workspace"; view: "options" | "compare"; needsOpen: false }
  | { kind: "decide"; productId: string };

export interface JourneyStep {
  stage: JourneyStage;
  label: string;
  /** "3 needs", "4 options", "Comparing 3", "Bought", or the empty words. */
  fact: string;
  target: JourneyTarget;
  href: string;
  current: boolean;
}

const LABELS: Record<JourneyStage, string> = {
  needs: "Needs",
  options: "Options",
  compare: "Compare",
  decide: "Decide",
};

const OUTCOMES: Record<Exclude<DecisionStatus, "open">, string> = {
  bought: "Bought",
  declined: "Not buying",
  saved: "Saved",
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The workspace stage a view belongs to. Chat is where the needs are built. */
export function stageForView(view: "chat" | "options" | "compare"): JourneyStage {
  return view === "chat" ? "needs" : view;
}

export function journeyHref(sessionId: string, target: JourneyTarget): string {
  const base = `${BASE}/d/${sessionId}`;
  if (target.kind === "decide") return `${base}/decide?product=${encodeURIComponent(target.productId)}`;
  // "canvas" is the view name that opens Chat with the needs showing.
  return `${base}?view=${target.needsOpen ? "canvas" : target.view}`;
}

/** Done: where a decision goes once it ends, by any way out. */
export function doneHref(sessionId: string): string {
  return `${BASE}/d/${sessionId}/done`;
}

/** Options on the shortlist that still have a product record: the count the path, the bar and the facts show. */
export function optionCount(session: DecisionSession): number {
  return (session.shortlist?.entries ?? []).filter((entry) => session.products[entry.productId]).length;
}

/**
 * The four stages for a session. `current` is the stage on screen, if any.
 * `chosenProductId` is the option the Decide screen shows; without it, the
 * option the buyer went to check out or decided on, if any.
 */
export function journeySteps(
  session: DecisionSession,
  current: JourneyStage | null,
  chosenProductId?: string,
): JourneyStep[] {
  const needs = session.canvas.items.filter((item) => item.kind === "must_have" || item.kind === "preference").length;
  const options = optionCount(session);
  const compared = session.comparison?.productIds.length ?? 0;
  const chosen = chosenProductId ?? checkoutTargetOf(session).productId;
  const status = session.decision.status;

  const facts: Record<JourneyStage, string> = {
    needs: needs > 0 ? plural(needs, "need", "needs") : "None yet",
    options: options > 0 ? plural(options, "option", "options") : "None yet",
    compare: session.comparison ? `Comparing ${compared}` : "Optional",
    decide: status !== "open" ? OUTCOMES[status] : chosen ? "Chosen" : "Nothing chosen",
  };
  const targets: Record<JourneyStage, JourneyTarget> = {
    needs: { kind: "workspace", view: "chat", needsOpen: true },
    options: { kind: "workspace", view: "options", needsOpen: false },
    compare: { kind: "workspace", view: "compare", needsOpen: false },
    decide: chosen ? { kind: "decide", productId: chosen } : { kind: "workspace", view: "options", needsOpen: false },
  };

  return JOURNEY_STAGES.map((stage) => ({
    stage,
    label: LABELS[stage],
    fact: facts[stage],
    target: targets[stage],
    href: journeyHref(session.id, targets[stage]),
    current: stage === current,
  }));
}
