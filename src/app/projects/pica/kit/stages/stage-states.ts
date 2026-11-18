/**
 * The states the stages preview shows, on the seed decision. Each one is a
 * session plus the picks and whether Pica is replying.
 */
import type { DecisionSession } from "@/pica/lib/types";
import { seedDecision } from "../seed/fixture";

// A fixed time, so the server and the browser draw the same page.
export const SEED = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const IDS = SEED.shortlist!.entries.map((entry) => entry.productId);
const COMPARED = SEED.comparison!.productIds;

/** The seed's comparison widened to all four options, the slim pack's cells written in. */
export const FOUR_COMPARED: DecisionSession = {
  ...SEED,
  comparison: {
    ...SEED.comparison!,
    productIds: IDS,
    rows: SEED.comparison!.rows.map((row) => ({
      ...row,
      cells: [...row.cells, { productId: IDS[2], note: "Not stated", basis: "missing" as const }],
    })),
  },
};

export interface StageState {
  key: string;
  label: string;
  session: DecisionSession;
  picks: string[];
  busy?: boolean;
}

const withShortlist = (over: Partial<NonNullable<DecisionSession["shortlist"]>>): DecisionSession => ({
  ...SEED,
  shortlist: { ...SEED.shortlist!, ...over },
});

/** The seed's products less some, as when storage dropped them. */
function withoutProducts(gone: readonly string[]): DecisionSession["products"] {
  return Object.fromEntries(Object.entries(SEED.products).filter(([id]) => !gone.includes(id)));
}

export const OPTIONS_STATES: StageState[] = [
  { key: "normal", label: "Four options, none picked", session: SEED, picks: [] },
  { key: "picked", label: "Three picked", session: SEED, picks: COMPARED },
  { key: "all", label: "All four picked", session: SEED, picks: IDS },
  { key: "stale", label: "Needs changed after the options", session: withShortlist({ stale: true }), picks: [] },
  { key: "busy", label: "Pica replying", session: SEED, picks: COMPARED, busy: true },
  { key: "saved", label: "Decision saved", session: { ...SEED, decision: { status: "saved" } }, picks: [] },
  { key: "one", label: "One option", session: withShortlist({ entries: SEED.shortlist!.entries.slice(0, 1) }), picks: [] },
  {
    key: "missing",
    label: "Every listed product missing, needs changed",
    session: { ...withShortlist({ stale: true }), products: {} },
    picks: [],
  },
  { key: "none", label: "No shortlist yet", session: { ...SEED, shortlist: null, comparison: null }, picks: [] },
];

export const COMPARE_STATES: StageState[] = [
  { key: "three", label: "Three compared", session: SEED, picks: COMPARED },
  { key: "four", label: "Four compared", session: FOUR_COMPARED, picks: IDS },
  { key: "picks-changed", label: "Picks differ from the comparison", session: SEED, picks: IDS },
  {
    key: "needs-changed",
    label: "Needs changed after the comparison",
    session: { ...SEED, comparison: { ...SEED.comparison!, stale: true } },
    picks: COMPARED,
  },
  {
    key: "busy",
    label: "Pica replying (started in chat)",
    session: { ...SEED, comparison: { ...SEED.comparison!, stale: true } },
    picks: COMPARED,
    busy: true,
  },
  { key: "no-comparison", label: "No comparison yet", session: { ...SEED, comparison: null }, picks: [] },
  {
    key: "one",
    label: "One option",
    session: { ...withShortlist({ entries: SEED.shortlist!.entries.slice(0, 1) }), comparison: null },
    picks: [],
  },
  {
    key: "lost",
    label: "Compared products gone",
    session: { ...SEED, products: withoutProducts(COMPARED.slice(0, 2)) },
    picks: [],
  },
  { key: "none", label: "No shortlist yet", session: { ...SEED, shortlist: null, comparison: null }, picks: [] },
];

export const STAGES = {
  options: { title: "Options", states: OPTIONS_STATES },
  compare: { title: "Compare", states: COMPARE_STATES },
} as const;

export type StageKey = keyof typeof STAGES;

/** The stage and state a URL asks for, or the first of each. */
export function pickState(stage: unknown, state: unknown): { stage: StageKey; state: StageState } {
  const key: StageKey = stage === "compare" ? "compare" : "options";
  const states = STAGES[key].states;
  return { stage: key, state: states.find((item) => item.key === state) ?? states[0] };
}
