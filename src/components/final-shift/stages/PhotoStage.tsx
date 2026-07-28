"use client";

import { StageFrame } from "@/components/final-shift/StageFrame";
import { StubBody } from "@/components/final-shift/stages/StubBody";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";

/** Stage 4 — the required Polaroid. No skip, by design. */
export function PhotoStage({ goTo, goBack }: StageProps) {
  return (
    <StageFrame
      stage="photo"
      heading={COPY.photo.heading}
      support={COPY.photo.support}
      onBack={goBack}
      action={
        <button
          type="button"
          onClick={() => goTo("lastWords")}
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)]"
        >
          {COPY.photo.cta}
        </button>
      }
    >
      <StubBody note="Camera or upload, the flash and develop motions, the Polaroid frame, the caption field, and retake." />
    </StageFrame>
  );
}
