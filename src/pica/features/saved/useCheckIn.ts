"use client";

import { useState } from "react";
import { track } from "@/pica/lib/analytics";
import { dispatch } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { now } from "@/pica/features/shared/format";
import {
  buildOutcome,
  checkInChanged,
  checkInItems,
  initialMet,
  isMet,
  outcomeEventProps,
  type Met,
  type MetAnswers,
  type Satisfied,
} from "./checkin-model";

/** The check-in form. Saving needs the overall answer; the rest is optional. */
export function useCheckIn(session: DecisionSession, onDone: () => void) {
  const previous = session.outcome;
  const items = checkInItems(session);
  const [met, setMet] = useState<MetAnswers>(() => initialMet(previous));
  const [satisfied, setSatisfied] = useState<Satisfied | null>(previous?.satisfied ?? null);
  const [note, setNote] = useState(previous?.note ?? "");
  /** Set when Save was pressed with no overall answer. */
  const [missingOverall, setMissingOverall] = useState(false);

  return {
    items,
    satisfied,
    note,
    missingOverall,
    isMet: (itemId: string, value: Met) => isMet(met, itemId, value),
    answer: (itemId: string, value: Met) => setMet((current) => ({ ...current, [itemId]: value })),
    pickOverall(value: Satisfied) {
      setSatisfied(value);
      setMissingOverall(false);
    },
    setNote,
    save() {
      const outcome = buildOutcome(items, met, satisfied, note, now());
      if (!outcome) {
        setMissingOverall(true);
        return;
      }
      // Read before the dispatch replaces it.
      const changed = checkInChanged(previous, outcome);
      dispatch(session.id, { type: "outcome_submitted", outcome, at: outcome.submittedAt });
      if (changed) track("satisfaction_submitted", outcomeEventProps(outcome), session.id);
      onDone();
    },
  };
}
