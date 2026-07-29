"use client";

import { useState } from "react";
import { CharCountField } from "@/components/final-shift/CharCountField";
import { StageFrame } from "@/components/final-shift/StageFrame";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";
import { LIMITS } from "@/lib/final-shift/types";

/**
 * Stage 5 — one line for Andrew. Optional, and the skip is a real, visible option.
 *
 * A row of prompt chips used to sit above the field — Memory, Thank-you, Classic Andrew, Next
 * chapter — each swapping the placeholder. They were cut: four categories to read and choose between
 * is more work than writing the sentence, and the stage that asks the least is the one people
 * actually answer. One field, one prompt, and a skip that means it.
 */
export function LastWordsStage({ values, update, goTo, goBack }: StageProps) {
  const [showErrors, setShowErrors] = useState(false);

  const tooLong = values.memory.length > LIMITS.memory;

  const advance = () => {
    if (tooLong) {
      setShowErrors(true);
      return;
    }
    goTo("review");
  };

  return (
    <StageFrame
      stage="lastWords"
      heading={COPY.lastWords.heading}
      support={COPY.lastWords.support}
      onBack={goBack}
      action={
        <div className="space-y-3">
          <button
            type="button"
            onClick={advance}
            className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)] active:translate-y-px"
          >
            {COPY.lastWords.cta}
          </button>
          <button
            type="button"
            onClick={() => {
              update({ memory: "" });
              goTo("review");
            }}
            className="fs-label min-h-11 w-full text-[var(--fs-oat)] underline underline-offset-4"
          >
            {COPY.lastWords.skip}
          </button>
        </div>
      }
    >
      <div className="fs-anim-ticket-feed">
        <CharCountField
          label={COPY.lastWords.label}
          value={values.memory}
          onChange={(memory) => update({ memory })}
          limit={LIMITS.memory}
          rows={4}
          placeholder={COPY.lastWords.placeholder}
          error={showErrors && tooLong ? COPY.lastWords.errors.longMemory : null}
        />
      </div>
    </StageFrame>
  );
}
