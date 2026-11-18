/**
 * The needs panel's words and groups, without React (brief 6.2, "Canvas").
 */
import type { CanvasItemKind } from "@/pica/lib/types";

export const CANVAS = {
  title: "Your needs",
  line: "Your goal, and what it takes. Change anything here and Pica works from it.",
  locked: "Pica is replying and may update this.",
  outcome: "Your goal",
  budget: "Budget",
  category: "Category",
  notSet: "Not set yet",
  none: "None yet",
  confirm: "Confirm",
  save: "Save change",
  saveBudget: "Save budget",
  cancel: "Cancel",
  add: "Add",
  outcomeField: "Your goal",
  outcomeEdit: "Edit your goal",
  outcomeConfirm: "Confirm your goal",
  outcomeCancelTail: "editing your goal",
  budgetEdit: "Edit the budget",
  budgetConfirm: "Confirm the budget",
  budgetCancelTail: "editing the budget",
  budgetMin: "Lowest, in US dollars",
  budgetMax: "Highest, in US dollars",
} as const;

export interface NeedGroup {
  kind: CanvasItemKind;
  title: string;
  /** "Add a must-have" and "Add a nice-to-have" sit at the foot of their groups. Still open has none. */
  add: { label: string; noun: string } | null;
}

/** The item groups, in the brief's order, after Your goal and Budget. */
export const GROUPS: readonly NeedGroup[] = [
  { kind: "must_have", title: "Must-haves", add: { label: "Add a must-have", noun: "a must-have" } },
  { kind: "preference", title: "Nice to have", add: { label: "Add a nice-to-have", noun: "a nice-to-have" } },
  { kind: "open_question", title: "Still open", add: null },
];

/** The id of a need's row, so "Edit" on a confirm card can find its form. */
export function needRowId(scope: string, itemId: string): string {
  return `${scope}-need-${itemId.replace(/[^\w-]/g, "_")}`;
}
