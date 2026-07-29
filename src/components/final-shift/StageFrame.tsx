"use client";

import { useEffect, useRef } from "react";
import { COPY } from "@/lib/final-shift/copy";
import {
  PROGRESS_STAGES,
  STAGE_LABELS,
  type ProgressStage,
  type StageId,
} from "@/lib/final-shift/types";

type StageFrameProps = {
  stage: StageId;
  /** Small mono line above the heading, e.g. "Timeclock / 01". */
  eyebrow?: string;
  heading: string;
  /** Rendered under the heading, before the stage body. */
  support?: React.ReactNode;
  /** Hidden when the guest can't go back — stage 1, and the post-submit screens. */
  onBack?: () => void;
  /** Replaces the numeric progress label. Used for "Editing" on a returning guest. */
  progressOverride?: string;
  /** Sits in the bottom row: in normal flow, after the content. See the note below. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

function progressIndex(stage: StageId): number | null {
  const index = PROGRESS_STAGES.indexOf(stage as ProgressStage);
  return index === -1 ? null : index + 1;
}

/**
 * The persistent frame around every stage: event mark, progress, Back, and the focus target.
 *
 * Layout note: the primary action goes in the third grid row, in normal document flow after the
 * content — not pinned to the viewport. That's what the handoff asks for ("anchored after content,
 * never covering inputs"), and it also sidesteps the entire iOS problem where the on-screen
 * keyboard covers a fixed bottom button. No visualViewport listener needed.
 */
export function StageFrame({
  stage,
  eyebrow,
  heading,
  support,
  onBack,
  progressOverride,
  action,
  children,
}: StageFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = progressIndex(stage);
  const total = PROGRESS_STAGES.length;

  /*
   * Move focus to the stage heading on every transition. Keyed on `stage` so it fires for Back
   * (popstate) exactly as it does for Forward — a screen-reader user who navigates backward should
   * land in the same place as one going forward.
   */
  useEffect(() => {
    headingRef.current?.focus();
  }, [stage]);

  const progressLabel =
    progressOverride ??
    (step === null ? null : COPY.frame.progress(step, total, STAGE_LABELS[stage]));

  return (
    <main className="fs-stage">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
        <span className="fs-label text-[var(--fs-oat)]">{COPY.event.mark}</span>
        {progressLabel ? (
          <span className="fs-label text-[var(--fs-muted-on-espresso)]">{progressLabel}</span>
        ) : null}
      </header>

      {/*
       * Announces the stage change for screen readers. The heading focus above moves the cursor;
       * this gives the position ("Step 2 of 4") that a heading alone doesn't carry.
       */}
      <div aria-live="polite" className="fs-sr-only">
        {step === null ? heading : COPY.frame.announce(step, total, STAGE_LABELS[stage])}
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col py-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            /* min-h-11 = 44px. A 12px mono label lands at ~33px on its own padding. */
            className="fs-label -ml-2 mb-2 flex min-h-11 items-center self-start rounded-[var(--fs-radius)] px-2 text-[var(--fs-oat)] underline underline-offset-4 transition-colors hover:text-[var(--fs-cream)]"
          >
            &larr; {COPY.frame.back}
          </button>
        ) : null}

        {eyebrow ? (
          <p className="fs-label mb-3 text-[var(--fs-muted-on-espresso)]">{eyebrow}</p>
        ) : null}

        <h1
          ref={headingRef}
          tabIndex={-1}
          data-stage-heading
          className="fs-title text-[var(--fs-cream)]"
        >
          {heading}
        </h1>

        {support ? (
          <p className="fs-body mt-3 text-[var(--fs-oat)]">{support}</p>
        ) : null}

        {/*
         * flex-1 so a stage can push part of itself to the bottom of the available space with
         * `mt-auto` — which is the whole of the numpad's thumb-reach requirement, in one property on
         * the child rather than a measured layout here.
         */}
        <div className="mt-7 flex flex-1 flex-col">{children}</div>
      </div>

      <div className="mx-auto w-full max-w-md pt-2">{action}</div>
    </main>
  );
}
