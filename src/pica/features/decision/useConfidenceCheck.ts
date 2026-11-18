"use client";

import { useState } from "react";
import { track } from "@/pica/lib/analytics";
import { dispatch } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { now } from "@/pica/features/shared/format";
import {
  answersFrom,
  completeCheck,
  confidenceEventProps,
  type ConfidenceAnswers,
  type ConfidenceKey,
} from "./confidence-model";

/**
 * The confidence check's answers. Each answer stays on screen; the check is
 * saved, and `confidence_submitted` fires, each time all three have one.
 */
export function useConfidenceCheck(session: DecisionSession) {
  const [answers, setAnswers] = useState<ConfidenceAnswers>(() => answersFrom(session.confidence));
  const [saved, setSaved] = useState(Boolean(session.confidence));

  function answer(key: ConfidenceKey, value: boolean) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    const check = completeCheck(next, now());
    if (!check) return;
    dispatch(session.id, { type: "confidence_submitted", check, at: check.submittedAt });
    track("confidence_submitted", confidenceEventProps(check, session.decision.status, saved), session.id);
    setSaved(true);
  }

  return { answers, saved, answer };
}
