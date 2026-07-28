"use client";

import { StageFrame } from "@/components/final-shift/StageFrame";
import { StubBody } from "@/components/final-shift/stages/StubBody";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";

/** Stage 3 — the RSVP receipt: attendance, conditional dates, dietary notes, wall consent. */
export function ReceiptStage({ goTo, goBack }: StageProps) {
  return (
    <StageFrame
      stage="receipt"
      heading={COPY.receipt.heading}
      onBack={goBack}
      action={
        <button
          type="button"
          onClick={() => goTo("photo")}
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)]"
        >
          {COPY.receipt.cta}
        </button>
      }
    >
      <StubBody note="Attendance cards, the conditional date list, dietary chips, and the wall-consent checkbox." />
    </StageFrame>
  );
}
