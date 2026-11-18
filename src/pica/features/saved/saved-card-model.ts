/**
 * What a decision card says on Home and Saved (brief 6.1 and 6.8). Pure.
 */
import { stageFacts } from "@/pica/components/kit/StagePath";
import type { DecisionSession } from "@/pica/lib/types";
import { journeyPath } from "@/pica/features/parts/journey-path-model";

/** The words when a decision has no needs, options or comparison yet. */
export const NO_FACTS = "No needs yet";

/**
 * "3 needs · 4 options", in the path's own words and from the path's own
 * counts, so a card and the path never disagree. Stages with nothing in
 * them are left out.
 */
export function decisionFacts(session: DecisionSession): string {
  const { counts } = journeyPath(session, null);
  const facts = stageFacts(counts);
  const parts = [
    counts.needs > 0 ? facts.needs : null,
    counts.options > 0 ? facts.options : null,
    counts.comparing > 0 ? facts.compare : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : NO_FACTS;
}
