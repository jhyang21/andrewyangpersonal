"use client";

import { useRef, useState } from "react";
import { CODE_LENGTH, DigitSlots } from "@/components/final-shift/DigitSlots";
import { ErrorNote } from "@/components/final-shift/ErrorNote";
import { Numpad } from "@/components/final-shift/Numpad";
import { StageFrame } from "@/components/final-shift/StageFrame";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";
import { ApiError, clockIn } from "@/lib/final-shift/net";
import { useReducedMotion } from "@/lib/final-shift/useMediaQuery";

const PUNCH_MS = 180;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Stage 1 — the timeclock.
 *
 * The punch runs alongside the request rather than before it, so the animation costs nothing: by the
 * time the ink has landed the server has usually answered. Under reduced motion it is skipped and
 * the guest simply waits for the reply.
 */
export function ClockInStage({ onIdentified }: StageProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [punching, setPunching] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();

  const submit = async () => {
    if (busy) return;

    if (code.length !== CODE_LENGTH) {
      setError(COPY.clockIn.errors.incomplete);
      return;
    }

    setError(null);
    setBusy(true);
    if (!reducedMotion) setPunching(true);

    try {
      const [session] = await Promise.all([
        clockIn(code, honeypot.current?.value ?? ""),
        reducedMotion ? Promise.resolve() : wait(PUNCH_MS),
      ]);
      // Unmounts this stage. Nothing after this line runs on the success path.
      onIdentified(session);
    } catch (failure) {
      setPunching(false);
      setBusy(false);
      /*
       * Whatever came back, it is one of two strings. The server answers an unknown number, a
       * deactivated guest, and a tripped honeypot with the identical body after an identical delay,
       * so there is nothing here to branch on — which is the point.
       */
      setError(
        failure instanceof ApiError
          ? failure.message
          : COPY.clockIn.errors.temporary,
      );
    }
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
          disabled={busy}
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)] active:translate-y-px disabled:opacity-70"
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

      {/*
       * Honeypot. A guest never sees it and never fills it; a form-filling bot fills everything it
       * finds. `aria-hidden` and `tabIndex={-1}` keep it out of the accessibility tree and the tab
       * order, so it is invisible to assistive technology as well as to the eye — a hidden field a
       * screen-reader user could land on would be a trap, not a defence.
       */}
      <input
        ref={honeypot}
        type="text"
        name="company"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        defaultValue=""
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

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
        {COPY.clockIn.help}
      </p>
    </StageFrame>
  );
}
