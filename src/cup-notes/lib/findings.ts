// The home page findings. Arithmetic over the saved outcomes, so they move with the dataset and
// never say a number the data does not hold. The words around them live in words.ts.
import type { CupNotesIndex, Outcomes, ScenarioSummary } from "./types";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const r0 = (v: number) => Math.round(v);

export type Findings = {
  strict: Outcomes;
  adaptive: Outcomes;
  quietSat: number;
  slammedSat: number;
  personalConn: number;
  markConn: number;
  /** Manager decisions under the strict rule, by stance. They sum to `managers`. */
  enforceAll: number;
  offpeak: number;
  encourage: number;
  ignore: number;
  managers: number;
};

export function findings(index: CupNotesIndex): Findings | null {
  const byKey = new Map(index.scenarios.map((s) => [s.key, s]));
  const strict = byKey.get("strict-personal-rush-short");
  const adaptive = byKey.get("adaptive-personal-rush-short");
  const quiet = index.scenarios.filter((s) => s.levers.traffic === "steady" && s.levers.staffing === "full");
  const slammed = index.scenarios.filter((s) => s.levers.traffic === "rush" && s.levers.staffing === "short");
  const personal = index.scenarios.filter((s) => s.levers.note === "personal");
  const mark = index.scenarios.filter((s) => s.levers.note === "mark");
  const strictRuns = index.scenarios.filter((s) => s.levers.enforcement === "strict");
  if (!strict || !adaptive || !quiet.length || !slammed.length || !personal.length || !mark.length || !strictRuns.length) {
    return null;
  }
  const sum = (stance: keyof ScenarioSummary["stance_mix"]) =>
    strictRuns.reduce((n, s) => n + s.stance_mix[stance], 0);
  const enforceAll = sum("enforce_all");
  const offpeak = sum("enforce_offpeak");
  const encourage = sum("encourage");
  const ignore = sum("ignore");
  const managers = enforceAll + offpeak + encourage + ignore;
  return {
    strict: strict.outcomes,
    adaptive: adaptive.outcomes,
    quietSat: r0(mean(quiet.map((s) => s.outcomes.customer_satisfaction))),
    slammedSat: r0(mean(slammed.map((s) => s.outcomes.customer_satisfaction))),
    personalConn: r0(mean(personal.map((s) => s.outcomes.connection))),
    markConn: r0(mean(mark.map((s) => s.outcomes.connection))),
    enforceAll,
    offpeak,
    encourage,
    ignore,
    managers,
  };
}
