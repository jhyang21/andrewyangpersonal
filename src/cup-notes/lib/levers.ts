// The four levers and the run keys they make. Pure functions, safe on server and client.
import type { CupNotesIndex, LeverKey, LeverSelection } from "./types";

export const LEVER_ORDER: LeverKey[] = ["enforcement", "note", "traffic", "staffing"];

/** The run the home page points to first: the hardest shift under the strictest rule. */
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

/** The levers of a run key, or null when the key is not one of the runs in the index. */
export function parseKey(index: CupNotesIndex, key: string): LeverSelection | null {
  return index.scenarios.find((s) => s.key === key)?.levers ?? null;
}

export type Neighbour = { lever: LeverKey; key: string; selection: LeverSelection };

/** Every run that differs from this one in exactly one lever, in lever order (five of them). */
export function neighbours(index: CupNotesIndex, selection: LeverSelection): Neighbour[] {
  const keys = new Set(index.scenarios.map((s) => s.key));
  const out: Neighbour[] = [];
  for (const lever of LEVER_ORDER) {
    for (const o of index.levers[lever]) {
      if (o.key === selection[lever]) continue;
      const next = { ...selection, [lever]: o.key };
      const key = scenarioKey(next);
      if (keys.has(key)) out.push({ lever, key, selection: next });
    }
  }
  return out;
}
