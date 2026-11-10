// Every label, heading, legend and sentence the microsite builds from data, in one place. Pure:
// safe on server and client. Never import data.ts from here (client files import this module).
import type { Findings } from "./findings";
import { r0 } from "./findings";
import { pct, whole } from "./format";
import type { CupAction, LeverKey, Outcomes, Reaction, Stance } from "./types";

export const LEVER_TITLES: Record<LeverKey, string> = {
  enforcement: "Enforcement",
  note: "Note",
  traffic: "Traffic",
  staffing: "Staffing",
};

/** One line on what each lever changes, for the home page and the method page. */
export const LEVER_INTRO: Record<LeverKey, string> = {
  enforcement: "How hard HQ pushes it.",
  note: "What counts as a note.",
  traffic: "How long the line is.",
  staffing: "Who showed up.",
};

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

/* Ordered best to worst, which is also the order the legend and the store record use. */
export const REACTIONS: Reaction[] = ["delighted", "warm", "neutral", "indifferent", "annoyed"];

export const REACTION_LABELS: Record<Reaction, string> = {
  delighted: "Delighted",
  warm: "Warm",
  neutral: "Neutral",
  indifferent: "Indifferent",
  annoyed: "Annoyed",
};

export const MANAGER_FLAGS = {
  checking: "Checking cups",
  notChecking: "Not checking",
  rushSkip: "Rush: may skip",
};

export type Stage = "policy" | "managers" | "shifts" | "customers" | "outcomes";

/** The five steps of the chain on a run page. */
export const STEPS: Record<Stage, { title: string; sub: string }> = {
  policy: { title: "Policy", sub: "One memo, sent to six stores" },
  managers: { title: "Store managers", sub: "Six managers read it through their own job" },
  shifts: { title: "Baristas", sub: "Twelve people, eight customers each" },
  customers: { title: "Customers", sub: "96 people react to the cup and the wait" },
  outcomes: { title: "Outcomes", sub: "Averages over all 96 cups" },
};

/* The five headline metrics, shared by the outcome tiles, the chart and the runs table. */
export type Metric =
  | "compliance_pct"
  | "avg_seconds_added"
  | "barista_sentiment"
  | "customer_satisfaction"
  | "connection";

export const METRICS: Record<Metric, { label: string; short: string; note: (o: Outcomes) => string }> = {
  compliance_pct: {
    label: "Compliance",
    short: "Compliance",
    note: (o) => `${pct(o.personal_pct)} personal · ${pct(o.skip_pct)} skipped`,
  },
  avg_seconds_added: {
    label: "Added wait per cup",
    short: "Added wait",
    note: (o) => `${o.avg_wait_min.toFixed(1)} min average wait`,
  },
  barista_sentiment: {
    label: "Barista sentiment",
    short: "Barista mood",
    note: (o) => `0 to 100 · stress ${whole(o.barista_stress)}`,
  },
  customer_satisfaction: {
    label: "Customer satisfaction",
    short: "Satisfaction",
    note: (o) => `${pct(o.delighted_pct)} delighted · ${pct(o.annoyed_pct)} annoyed`,
  },
  connection: {
    label: "Connection",
    short: "Connection",
    note: (o) => `${pct(o.noticed_pct)} noticed the note`,
  },
};

export const METRIC_ORDER: Metric[] = [
  "compliance_pct",
  "avg_seconds_added",
  "barista_sentiment",
  "customer_satisfaction",
  "connection",
];

export const HINTS = {
  managers: "Open a card for what the manager thought and didn’t say. Open store for the whole shift.",
  cups: "Hover, tap or arrow through the cups to read each note and how that customer took it.",
  faces: "Click a face to read what that customer said.",
};

export const FALLBACK_NOTE =
  "Some shifts in this run came back broken from the model. I filled them from a rule-based stand-in and marked them Fallback.";

export const NO_NOTE = "No note";
export const NAME_ONLY = "Nothing on the cup but a name";

/**
 * Above the lever quotes on the home and method pages. The manager prompt carries enforcement and
 * note under the memo heading; traffic and staffing come in a separate "Today's shift" block.
 */
export const MEMO_LINES =
  "The memo is two lines: how hard HQ pushes, and what counts as a note. The line and the staffing reach the manager on their own, as today’s shift. Every quote below is word for word what the managers read.";

/** What each round of calls sees, for the method page. */
export const ROUND_SEES: Record<"manager" | "barista" | "customer", { who: string; sees: string }> = {
  manager: {
    who: "Managers",
    sees: "see the rule, the shift, their store and their own job: what they are judged on, how long they have run the store, how they feel about programs from HQ.",
  },
  barista: {
    who: "Baristas",
    sees: "see their manager’s message, the shift, and the eight customers they serve with the line length at each. They decide each cup and how many seconds it costs.",
  },
  customer: {
    who: "Customers",
    sees: "see who they are, where they are, how long they waited and what is on their cup. They never see the rule or the manager.",
  },
};

/** The paragraph under the chain on every run page. */
export const HOW_TO_READ =
  "The memo at the top is the same for every store. Everything below it is what six managers, twelve baristas and 96 customers did with it. The five numbers at the bottom are what HQ would see. Read the quotes. They show where the rule bent.";

function move(from: number, to: number, unit = "", digits = 0) {
  const a = from.toFixed(digits);
  const b = to.toFixed(digits);
  if (a === b) return "no change";
  return `${to > from ? "up" : "down"} from ${a}${unit}`;
}

/**
 * One line on what changed when a single lever moved, built only from the saved numbers. Named by
 * that lever's options: "Adaptive instead of Strict".
 */
export function compareSentence(nameA: string, nameB: string, a: Outcomes, b: Outcomes) {
  const ca = r0(a.compliance_pct);
  const cb = r0(b.compliance_pct);
  const wa = a.avg_seconds_added;
  const wb = b.avg_seconds_added;
  const sa = r0(a.customer_satisfaction);
  const sb = r0(b.customer_satisfaction);
  return {
    title: `${nameB} instead of ${nameA}`,
    text: `A note on ${cb}% of cups, ${move(ca, cb, "%")}. ${wb.toFixed(1)} s a cup, ${move(wa, wb, " s", 1)}. Satisfaction ${sb}, ${move(sa, sb)}.`,
  };
}

/** The three findings on the home page. Arithmetic in findings.ts; only the words live here. */
export function findingSentences(f: Findings): string[] {
  /* The rest are the off-peak and encourage stances; ignore gets its own sentence when it happens. */
  const rest = f.offpeak + f.encourage;
  const ignored = f.ignore > 0 ? ` ${f.ignore} ignored it.` : "";
  /* One rounded number decides the wording and fills it, so the two always agree. */
  const satGap = r0(Math.abs(f.strict.customer_satisfaction - f.adaptive.customer_satisfaction));
  const satMove = satGap <= 3 ? "The note barely moved it." : `The note moved it ${satGap} points.`;
  return [
    `Strict rule, ${f.managers} manager decisions, ${f.enforceAll} chose to enforce every cup. ${rest} made a rush exception or turned it into a request.${ignored}`,
    `Short-staffed rush, personal notes: strict kept a note on ${r0(f.strict.compliance_pct)}% of cups, adaptive on ${r0(f.adaptive.compliance_pct)}%. Strict cost ${f.strict.avg_seconds_added.toFixed(1)} seconds a cup, adaptive ${f.adaptive.avg_seconds_added.toFixed(1)}. Satisfaction ${r0(f.strict.customer_satisfaction)} and ${r0(f.adaptive.customer_satisfaction)}. ${satMove}`,
    `Satisfaction tracked the line: ${f.quietSat} on quiet, full-staffed shifts, ${f.slammedSat} on short-staffed rushes, across every rule. Connection tracked the note: ${f.personalConn} where it had to be personal, ${f.markConn} where a smiley counted. Compliance alone shows neither.`,
  ];
}

export function tenure(years: number) {
  return years < 1 ? `${Math.round(years * 12)} months` : `${years} ${years === 1 ? "year" : "years"}`;
}
