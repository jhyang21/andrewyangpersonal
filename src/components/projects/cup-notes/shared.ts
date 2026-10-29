import type {
  CupAction,
  CupNotesIndex,
  LeverKey,
  LeverSelection,
  Reaction,
  Stance,
} from "@/lib/cup-notes/types";

export const LEVER_ORDER: LeverKey[] = ["enforcement", "note", "traffic", "staffing"];

export const LEVER_TITLES: Record<LeverKey, string> = {
  enforcement: "Enforcement",
  note: "Note",
  traffic: "Traffic",
  staffing: "Staffing",
};

export const DEFAULT_SELECTION: LeverSelection = {
  enforcement: "strict",
  note: "personal",
  traffic: "rush",
  staffing: "short",
};

/* Same key format the generator uses: `{enforcement}-{note}-{traffic}-{staffing}`. */
export function scenarioKey(s: LeverSelection) {
  return `${s.enforcement}-${s.note}-${s.traffic}-${s.staffing}`;
}

export function leverLabel(index: CupNotesIndex, lever: LeverKey, key: string) {
  return index.levers[lever].find((o) => o.key === key)?.label ?? key;
}

/** "Strict · Personal note · Morning rush · Short-staffed" */
export function scenarioName(index: CupNotesIndex, s: LeverSelection) {
  return LEVER_ORDER.map((l) => leverLabel(index, l, s[l])).join(" · ");
}

export const STANCE_LABELS: Record<Stance, string> = {
  enforce_all: "Enforces every cup",
  enforce_offpeak: "Enforces off-peak",
  encourage: "Encourages",
  ignore: "Ignores it",
};

export const ACTION_LABELS: Record<CupAction, string> = {
  skip: "Skipped",
  smiley: "Smiley",
  generic: "Generic note",
  personal: "Personal note",
};

/* Ordered best to worst, which is also the order the legend and the drill-down groups use. */
export const REACTIONS: Reaction[] = ["delighted", "warm", "neutral", "indifferent", "annoyed"];

export const REACTION_LABELS: Record<Reaction, string> = {
  delighted: "Delighted",
  warm: "Warm",
  neutral: "Neutral",
  indifferent: "Indifferent",
  annoyed: "Annoyed",
};

/* The five headline metrics, shared by the outcome tiles and the tradeoff chart. */
export type Metric =
  | "compliance_pct"
  | "avg_seconds_added"
  | "barista_sentiment"
  | "customer_satisfaction"
  | "connection";

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const whole = (v: number) => `${Math.round(v)}`;
export const pct = (v: number) => `${Math.round(v)}%`;
export const secs = (v: number) => `${v.toFixed(1)} s`;

/*
 * The playback timeline, in milliseconds from "Run". Every stage reads the one clock and decides what
 * it shows; nothing here invents data, it only says when saved data appears. About seven seconds end
 * to end: managers speak, then all twelve baristas pour in step, each customer reacting just after
 * their cup lands, then the totals count up.
 */
export const T = {
  managerStart: (i: number) => 450 + i * 260,
  managerSpeak: 1300,
  shiftsStart: 2350,
  cup: (row: number, slot: number) => 2350 + slot * 330 + row * 28,
  reactionLag: 420,
  outcomes: 5650,
  outcomesDur: 1250,
  end: 7000,
} as const;

export const rowDone = (row: number) => T.cup(row, 7) + 260;

export type Stage = "policy" | "managers" | "shifts" | "customers" | "outcomes";

/** Which stage the clock is in. Drives the step rail. */
export function stageAt(t: number): Stage {
  if (t < T.managerStart(0)) return "policy";
  if (t < T.shiftsStart) return "managers";
  if (t < T.cup(0, 2) + T.reactionLag) return "shifts";
  if (t < T.outcomes) return "customers";
  return "outcomes";
}

export const STAGES: Stage[] = ["policy", "managers", "shifts", "customers", "outcomes"];
