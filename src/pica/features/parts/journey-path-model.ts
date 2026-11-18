/**
 * Feeds the kit's StagePath from `journeySteps`, without React. The links,
 * the current stage and "chosen" all come from `journeySteps`, so the path
 * and the journey rules cannot disagree; journey-path-model.test.ts checks
 * that the kit's words match the journey's.
 */
import type { DecisionResult, StageCounts, StageId } from "@/pica/components/kit";
import type { DecisionSession, DecisionStatus } from "@/pica/lib/types";
import { journeySteps, optionCount, type JourneyStage } from "@/pica/features/shared/journey";
import { needsOf } from "@/pica/features/workspace/canvas-model";

const OUTCOMES: Record<Exclude<DecisionStatus, "open">, DecisionResult> = {
  bought: "Bought",
  declined: "Not buying",
  saved: "Saved",
};

export interface JourneyPathModel {
  counts: StageCounts;
  hrefs: Record<StageId, string>;
  current?: StageId;
}

export function journeyPath(
  session: DecisionSession,
  current: JourneyStage | null,
  chosenProductId?: string,
): JourneyPathModel {
  const steps = journeySteps(session, current, chosenProductId);
  const byStage = Object.fromEntries(steps.map((step) => [step.stage, step])) as Record<StageId, (typeof steps)[number]>;
  const status = session.decision.status;
  return {
    counts: {
      needs: needsOf(session.canvas).length,
      options: optionCount(session),
      comparing: session.comparison?.productIds.length ?? 0,
      outcome: status === "open" ? null : OUTCOMES[status],
      // Decide links to a product exactly when one is chosen.
      chosen: byStage.decide.target.kind === "decide",
    },
    hrefs: {
      needs: byStage.needs.href,
      options: byStage.options.href,
      compare: byStage.compare.href,
      decide: byStage.decide.href,
    },
    current: steps.find((step) => step.current)?.stage,
  };
}
