/**
 * The three-statement confidence check on Done (brief 6.7). Pure.
 * It saves only once all three have an answer. An unanswered statement is
 * never saved, and never as "No".
 */
import type { ConfidenceCheck, DecisionStatus } from "@/pica/lib/types";

export type ConfidenceKey = "understandNeeds" | "canExplainTradeoffs" | "confidentInChoice";

/** Answers so far. A missing key is unanswered, which is not the same as false. */
export type ConfidenceAnswers = Partial<Record<ConfidenceKey, boolean>>;

/** The answers to show on open: the saved check, or none. */
export function answersFrom(saved: ConfidenceCheck | undefined): ConfidenceAnswers {
  if (!saved) return {};
  return {
    understandNeeds: saved.understandNeeds,
    canExplainTradeoffs: saved.canExplainTradeoffs,
    confidentInChoice: saved.confidentInChoice,
  };
}

/** The check to save, or null while any statement is still unanswered. */
export function completeCheck(answers: ConfidenceAnswers, at: number): ConfidenceCheck | null {
  const { understandNeeds, canExplainTradeoffs, confidentInChoice } = answers;
  if (typeof understandNeeds !== "boolean") return null;
  if (typeof canExplainTradeoffs !== "boolean") return null;
  if (typeof confidentInChoice !== "boolean") return null;
  return { understandNeeds, canExplainTradeoffs, confidentInChoice, submittedAt: at };
}

/** Props for `confidence_submitted`. `edited` is true when a check was already saved. */
export function confidenceEventProps(check: ConfidenceCheck, status: DecisionStatus, edited: boolean) {
  return {
    understandNeeds: check.understandNeeds,
    canExplainTradeoffs: check.canExplainTradeoffs,
    confidentInChoice: check.confidentInChoice,
    status,
    edited,
  };
}
