"use client";

import { StageFrame } from "@/components/final-shift/StageFrame";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";

/** Stage 2 — recognition. Name, employee number, and the curated crew role. */
export function WelcomeStage({ session, goTo, onSignOut }: StageProps) {
  if (!session) return null;
  const { guest } = session;

  return (
    <StageFrame
      stage="welcome"
      heading={COPY.welcome.headline(guest.firstName)}
      support={COPY.welcome.body}
      action={
        <button
          type="button"
          onClick={() => goTo("receipt")}
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)]"
        >
          {COPY.welcome.cta}
        </button>
      }
    >
      <div className="rounded-[var(--fs-radius)] border border-[var(--fs-line)] bg-[var(--fs-ink)] p-5">
        <p className="fs-label text-[var(--fs-muted-on-espresso)]">
          {COPY.welcome.badgeLabel}
        </p>
        <p className="fs-digit mt-1 text-[var(--fs-cream)]">{guest.code}</p>
        <p className="fs-body mt-4 text-[var(--fs-oat)]">{guest.crewRole}</p>
      </div>

      <p className="fs-body mt-5 text-[var(--fs-oat)]">{COPY.welcome.expectation}</p>

      <button
        type="button"
        onClick={onSignOut}
        className="fs-label mt-6 min-h-11 text-[var(--fs-muted-on-espresso)] underline underline-offset-4"
      >
        {COPY.welcome.notYou(guest.firstName)}
      </button>
    </StageFrame>
  );
}
