"use client";

import { useState } from "react";
import { StageFrame } from "@/components/final-shift/StageFrame";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";
import { mockClockIn } from "@/lib/final-shift/mock";

/**
 * Stage 1 — the timeclock.
 *
 * Phase 1 stub: a plain field standing in for the numpad and the four rendered slots. What is already
 * real is the failure behaviour — one message for every kind of rejection, so the shape that keeps
 * the code from being enumerable is in place before the pretty version lands on top of it.
 */
export function ClockInStage({ onIdentified }: StageProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 4) {
      setError(COPY.clockIn.errors.incomplete);
      return;
    }

    const session = mockClockIn(digits);
    if (!session) {
      // One message, whatever the reason. Phase 5 moves this decision to the server.
      setError(COPY.clockIn.errors.unknown);
      return;
    }

    setError(null);
    onIdentified(session);
  };

  return (
    <StageFrame
      stage="clockIn"
      heading={COPY.clockIn.headline}
      support={COPY.clockIn.instruction}
      action={
        <button
          type="button"
          onClick={submit}
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)]"
        >
          {COPY.clockIn.cta}
        </button>
      }
    >
      <label htmlFor="fs-code" className="fs-label block text-[var(--fs-oat)]">
        {COPY.clockIn.slotsLabel}
      </label>
      <input
        id="fs-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        inputMode="numeric"
        pattern="\d*"
        autoComplete="off"
        aria-invalid={error !== null}
        aria-describedby={error ? "fs-code-error" : undefined}
        className="fs-digit mt-2 w-full rounded-[var(--fs-radius)] border border-[var(--fs-line)] bg-[var(--fs-ink)] px-4 py-3 text-center tracking-[0.4em] text-[var(--fs-cream)]"
      />
      {error ? (
        <p
          id="fs-code-error"
          role="alert"
          className="fs-body mt-3 text-[var(--fs-red)]"
        >
          {error}
        </p>
      ) : null}
      <p className="fs-meta mt-6 text-[var(--fs-muted-on-espresso)]">
        Stub roster: 0001, 0002, 0003, 0004.
      </p>
    </StageFrame>
  );
}
