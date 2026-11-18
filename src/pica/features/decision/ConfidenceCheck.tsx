"use client";

import { useState } from "react";
import { Card, Chip } from "@/pica/components/kit";
import type { DecisionSession } from "@/pica/lib/types";
import type { ConfidenceAnswers, ConfidenceKey } from "./confidence-model";
import { CONFIDENCE_STATEMENTS, DONE } from "./done-screen-model";
import { useConfidenceCheck } from "./useConfidenceCheck";

export interface ConfidenceCheckViewProps {
  answers: ConfidenceAnswers;
  saved: boolean;
  /** Saved before this visit: say so plainly, not through the live line. */
  savedBefore: boolean;
  onAnswer: (key: ConfidenceKey, value: boolean) => void;
}

/** The three statements with Yes or No each. Optional, and says so. */
export function ConfidenceCheckView({ answers, saved, savedBefore, onAnswer }: ConfidenceCheckViewProps) {
  return (
    <Card as="section" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-body-lg font-semibold text-ink">{DONE.confidenceHeading}</h2>
        <p className="text-body text-ink-muted">{DONE.confidenceNote}</p>
      </div>
      <div className="flex flex-col gap-4">
        {CONFIDENCE_STATEMENTS.map(({ key, text }) => (
          <fieldset key={key} className="min-w-0">
            <legend className="mb-2 break-words text-body text-ink">{text}</legend>
            <div className="flex gap-2">
              <Chip label={DONE.yes} selected={answers[key] === true} onClick={() => onAnswer(key, true)} />
              <Chip label={DONE.no} selected={answers[key] === false} onClick={() => onAnswer(key, false)} />
            </div>
          </fieldset>
        ))}
      </div>
      {savedBefore ? (
        <p className="text-body text-ink">{DONE.confidenceSaved}</p>
      ) : (
        // Says once that the answers saved during this visit. Empty on load,
        // and out of the flow while empty so the card holds no blank gap.
        <p role="status" className={saved ? "text-body text-ink" : "sr-only"}>
          {saved ? DONE.confidenceSaved : ""}
        </p>
      )}
    </Card>
  );
}

/** The confidence check on Done. Saves, and sends `confidence_submitted`, once all three have an answer. */
export function ConfidenceCheck({ session }: { session: DecisionSession }) {
  const { answers, saved, answer } = useConfidenceCheck(session);
  const [savedBefore] = useState(saved);
  return <ConfidenceCheckView answers={answers} saved={saved} savedBefore={savedBefore} onAnswer={answer} />;
}
