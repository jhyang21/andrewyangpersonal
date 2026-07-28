"use client";

import { useState } from "react";
import { CODE_LENGTH, DigitSlots } from "@/components/final-shift/DigitSlots";
import { ErrorNote } from "@/components/final-shift/ErrorNote";
import { Numpad } from "@/components/final-shift/Numpad";
import { StageFrame } from "@/components/final-shift/StageFrame";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";
import { mockClockIn } from "@/lib/final-shift/mock";
import { useReducedMotion } from "@/lib/final-shift/useMediaQuery";

const PUNCH_MS = 180;

/**
 * Stage 1 — the timeclock.
 *
 * The punch is the one animation in the flow that sits between the guest and the next screen, so
 * it's held to 180ms and skipped outright under reduced motion. When Phase 5 puts a real request
 * here, the hold overlaps the round trip rather than adding to it.
 */
export function ClockInStage({ onIdentified }: StageProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [punching, setPunching] = useState(false);
  const reducedMotion = useReducedMotion();

  const submit = () => {
    if (punching) return;

    if (code.length !== CODE_LENGTH) {
      setError(COPY.clockIn.errors.incomplete);
      return;
    }

    const session = mockClockIn(code);
    if (!session) {
      /*
       * One message for every kind of rejection — unknown number, deactivated guest, tripped
       * honeypot. Phase 5 moves the decision to the server, which returns this string byte for byte
       * in all of those cases and pads the response to a fixed time floor, so nothing in the reply
       * tells an attacker which four-digit codes are real.
       */
      setError(COPY.clockIn.errors.unknown);
      return;
    }

    setError(null);

    if (reducedMotion) {
      onIdentified(session);
      return;
    }

    setPunching(true);
    window.setTimeout(() => onIdentified(session), PUNCH_MS);
  };

  return (
    <StageFrame
      stage="clockIn"
      eyebrow={COPY.clockIn.eyebrow}
      heading={COPY.clockIn.headline}
      support={COPY.clockIn.instruction}
      action={
        <button
          type="button"
          onClick={submit}
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)] active:translate-y-px"
        >
          {COPY.clockIn.cta}
        </button>
      }
    >
      <DigitSlots
        value={code}
        onChange={(next) => {
          setCode(next);
          if (error) setError(null);
        }}
        label={COPY.clockIn.slotsLabel}
        invalid={error !== null}
        describedBy={error ? "fs-code-error" : undefined}
        punching={punching}
      />

      {error ? <ErrorNote id="fs-code-error">{error}</ErrorNote> : null}

      {/* Functional updates so fast consecutive taps queue instead of overwriting each other. */}
      <Numpad
        value={code}
        onDigit={(digit) => {
          setCode((current) =>
            current.length >= CODE_LENGTH ? current : current + digit,
          );
          setError(null);
        }}
        onBackspace={() => setCode((current) => current.slice(0, -1))}
      />

      <p className="fs-meta pt-6 text-[var(--fs-muted-on-espresso)]">
        Stub roster: 0001, 0002, 0003, 0004.
      </p>
    </StageFrame>
  );
}
