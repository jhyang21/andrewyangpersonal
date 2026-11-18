/**
 * The check-in after a purchase: did it meet the must-haves? Pure.
 */
import type { CanvasItem, DecisionSession, OutcomeFeedback } from "@/pica/lib/types";

/** Yes, no, or not sure (null). */
export type Met = boolean | null;
export type Satisfied = OutcomeFeedback["satisfied"];
/** A missing key is unanswered; it saves as "not sure". */
export type MetAnswers = Record<string, Met | undefined>;

/** Only what the buyer said they need. Pica's guesses are not theirs to grade. */
export function checkInItems(session: DecisionSession): CanvasItem[] {
  return session.canvas.items.filter((item) => item.kind === "must_have" && item.source === "stated");
}

/** The answers from an earlier check-in, or none. */
export function initialMet(previous: OutcomeFeedback | undefined): MetAnswers {
  const out: MetAnswers = {};
  for (const requirement of previous?.requirements ?? []) out[requirement.itemId] = requirement.met;
  return out;
}

/** True when this item has this answer. An unanswered item has none, not "Not sure". */
export function isMet(answers: MetAnswers, itemId: string, value: Met): boolean {
  return itemId in answers && answers[itemId] === value;
}

/** The check-in to save, or null until the overall answer is picked. */
export function buildOutcome(
  items: CanvasItem[],
  answers: MetAnswers,
  satisfied: Satisfied | null,
  note: string,
  at: number,
): OutcomeFeedback | null {
  if (!satisfied) return null;
  return {
    satisfied,
    requirements: items.map((item) => ({ itemId: item.id, text: item.text, met: answers[item.id] ?? null })),
    note: note.trim() || undefined,
    submittedAt: at,
  };
}

/**
 * Whether saving `next` should send `satisfaction_submitted`: always the
 * first time, then only when a must-have answer, the overall answer, or
 * whether there is a note differs from what is stored. Rewording a note that
 * was already there is not a new answer.
 */
export function checkInChanged(previous: OutcomeFeedback | undefined, next: OutcomeFeedback): boolean {
  if (!previous) return true;
  if (previous.satisfied !== next.satisfied) return true;
  if (Boolean(previous.note) !== Boolean(next.note)) return true;
  if (previous.requirements.length !== next.requirements.length) return true;
  const stored = new Map(previous.requirements.map((r) => [r.itemId, r.met]));
  return next.requirements.some((r) => !stored.has(r.itemId) || stored.get(r.itemId) !== r.met);
}

/** Props for `satisfaction_submitted`: counts only, never the note's words. */
export function outcomeEventProps(outcome: OutcomeFeedback) {
  const { requirements } = outcome;
  return {
    satisfied: outcome.satisfied,
    met: requirements.filter((r) => r.met === true).length,
    notMet: requirements.filter((r) => r.met === false).length,
    unsure: requirements.filter((r) => r.met === null).length,
    hasNote: Boolean(outcome.note),
  };
}

/** "the {product}" when the session has it, else "your purchase". */
export function boughtName(session: DecisionSession): string {
  const id = session.decision.productId;
  const product = id ? session.products[id] : undefined;
  return product ? `the ${product.title}` : "your purchase";
}

export const CHECK_IN = {
  title: "Check in on your purchase",
  needsHeading: "Did it meet your must-haves?",
  overallHeading: "Overall, are you happy with it?",
  missingOverall: "Pick an overall answer first.",
  noteLabel: "Anything else? (optional)",
  noteHint: "It stays in this browser.",
  save: "Save check-in",
} as const;

export const MET_CHOICES: readonly { value: Met; label: string }[] = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
  { value: null, label: "Not sure" },
];

export const SATISFIED_CHOICES: readonly { value: Satisfied; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partly", label: "Partly" },
  { value: "no", label: "No" },
];

/** "Did the Travel Pack 30L turn out as you hoped? Optional." */
export function checkInDescription(session: DecisionSession): string {
  return `Did ${boughtName(session)} turn out as you hoped? Optional.`;
}
