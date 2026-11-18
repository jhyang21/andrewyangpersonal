"use client";

import { dispatch } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { now } from "@/pica/features/shared/format";
import { doneView, toggleReason } from "./done-model";

/** Done's view of a decision, and the optional reason for not buying. */
export function useDone(session: DecisionSession) {
  const reason = session.decision.reason;
  return {
    ...doneView(session),
    reason,
    /**
     * The reason stays in the session only: `no_purchase_decided` already
     * fired once, when the buyer decided. Tapping it again clears it.
     */
    pickReason(code: string) {
      dispatch(session.id, { type: "reason_set", reason: toggleReason(reason, code), at: now() });
    },
  };
}
