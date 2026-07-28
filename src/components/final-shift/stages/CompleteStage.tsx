"use client";

import { StageFrame } from "@/components/final-shift/StageFrame";
import { StubBody } from "@/components/final-shift/stages/StubBody";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";

/**
 * Stage 7 — clocked out.
 *
 * No Back here on purpose. Returning to the review screen after the stamp has fired would undo the
 * one moment the whole flow is built around; editing is a forward move from this screen instead.
 */
export function CompleteStage({ session, goTo }: StageProps) {
  const returning = session?.submission.status === "submitted";

  return (
    <StageFrame
      stage="complete"
      heading={returning ? COPY.complete.backHeadline : COPY.complete.headline}
      support={returning ? COPY.complete.backSupport : COPY.complete.support}
      action={
        <a
          href="/final-shift/wall"
          className="fs-label flex h-14 w-full items-center justify-center rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)]"
        >
          {COPY.complete.cta}
        </a>
      }
    >
      {/*
       * The stamp sits on a cream chip rather than straight on the espresso. It's truer to the
       * metaphor — ink goes on paper — and it's the only way clock green reads at all here, since on
       * the dark background it measures 2.8:1.
       */}
      <p className="fs-anim-stamp fs-label inline-block rotate-[var(--fs-stamp-rotate)] rounded-[var(--fs-radius)] border-2 border-[var(--fs-green)] bg-[var(--fs-cream)] px-3 py-2 text-[var(--fs-green)]">
        {COPY.complete.stamp}
      </p>

      <div className="mt-5">
        <StubBody note="The stamp motion, the private note dialog, and the My note and Edit my RSVP controls." />
      </div>

      <button
        type="button"
        onClick={() => goTo("receipt")}
        className="fs-label mt-6 min-h-11 text-[var(--fs-oat)] underline underline-offset-4"
      >
        {COPY.complete.edit}
      </button>
    </StageFrame>
  );
}
