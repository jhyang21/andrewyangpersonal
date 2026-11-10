import type { Stage } from "@/cup-notes/lib/words";

/*
 * The playback timeline, in milliseconds from "Replay". Every stage reads the one clock and decides
 * what it shows; nothing here invents data, it only says when saved data appears. About seven seconds
 * end to end: managers speak, then all twelve baristas pour in step, each customer reacting just after
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

export const STAGES: Stage[] = ["policy", "managers", "shifts", "customers", "outcomes"];

/** Which stage the clock is in. Drives the step rail. */
export function stageAt(t: number): Stage {
  if (t < T.managerStart(0)) return "policy";
  if (t < T.shiftsStart) return "managers";
  if (t < T.cup(0, 2) + T.reactionLag) return "shifts";
  if (t < T.outcomes) return "customers";
  return "outcomes";
}

export type Phase = "playing" | "done";
