"use client";

import { StageFrame } from "@/components/final-shift/StageFrame";
import { StubBody } from "@/components/final-shift/stages/StubBody";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";

/** Stage 6 — the timecard read-back, then clock out. */
export function ReviewStage({ goTo, goBack }: StageProps) {
  return (
    <StageFrame
      stage="review"
      heading={COPY.review.heading}
      support={COPY.review.support}
      onBack={goBack}
      action={
        <button
          type="button"
          onClick={() => goTo("complete")}
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)]"
        >
          {COPY.review.cta}
        </button>
      }
    >
      <StubBody note="Every answer read back with a per-item Edit button, the confirmation line, and the clock-out stamp." />
    </StageFrame>
  );
}
