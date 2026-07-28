"use client";

import { StageFrame } from "@/components/final-shift/StageFrame";
import { StubBody } from "@/components/final-shift/stages/StubBody";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";

/** Stage 5 — the optional line for Andrew. */
export function LastWordsStage({ goTo, goBack }: StageProps) {
  return (
    <StageFrame
      stage="lastWords"
      heading={COPY.lastWords.heading}
      support={COPY.lastWords.support}
      onBack={goBack}
      action={
        <button
          type="button"
          onClick={() => goTo("review")}
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)]"
        >
          {COPY.lastWords.cta}
        </button>
      }
    >
      <StubBody note="The prompt chips, the 180-character field with a live counter, and the ticket-feed entrance." />
    </StageFrame>
  );
}
