"use client";

import { CODE_LENGTH } from "@/components/final-shift/DigitSlots";

type NumpadProps = {
  /** Only used to disable keys; never used to compute the next value. See onDigit. */
  value: string;
  /**
   * Emits the key that was pressed, not the resulting string.
   *
   * The obvious signature — onChange(value + digit) — reads the value captured at render time, so
   * two taps landing in one React batch both compute from the same stale string and the second
   * silently overwrites the first. Someone entering a familiar four-digit code on a phone taps fast
   * enough for that to happen. Emitting the intent lets the owner apply it with a functional update,
   * where the ordering is guaranteed.
   */
  onDigit: (digit: string) => void;
  onBackspace: () => void;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * The timeclock keypad.
 *
 * It does not auto-submit on the fourth digit — the handoff is explicit, and it's right: a guest who
 * fat-fingers the last key deserves to see the number before it's judged, and auto-submit would fire
 * a rate-limited request on every typo.
 *
 * `margin-top: auto` inside the stage's middle row pushes the pad to the bottom of the available
 * space, which is the whole of the thumb-reach requirement in one property. Keys are 56px+ with
 * `touch-action: manipulation` to kill the 300ms double-tap-zoom delay, and the browser's grey tap
 * flash is replaced by a real :active state so a fast tap still feels acknowledged.
 */
export function Numpad({ value, onDigit, onBackspace }: NumpadProps) {
  const full = value.length >= CODE_LENGTH;
  const keyClass =
    "fs-digit flex h-[3.5rem] items-center justify-center rounded-[var(--fs-radius)] border border-[var(--fs-line)] bg-[var(--fs-ink)] text-[var(--fs-cream)] [touch-action:manipulation] select-none active:translate-y-px active:bg-[var(--fs-line)] disabled:opacity-40";

  return (
    /*
     * aria-hidden, and every key excluded from the tab order. The pad is a pointer convenience laid
     * over the real input in DigitSlots — a keyboard or screen-reader user types into that input
     * directly, and tabbing through twelve unlabelled buttons to reach the same field would be
     * strictly worse than not offering them at all.
     */
    <div aria-hidden="true" className="mt-auto grid grid-cols-3 gap-2 pt-8">
      {KEYS.map((digit) => (
        <button
          key={digit}
          type="button"
          tabIndex={-1}
          onClick={() => onDigit(digit)}
          disabled={full}
          className={keyClass}
        >
          {digit}
        </button>
      ))}

      <span />

      <button
        type="button"
        tabIndex={-1}
        onClick={() => onDigit("0")}
        disabled={full}
        className={keyClass}
      >
        0
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={onBackspace}
        disabled={value.length === 0}
        className={`${keyClass} fs-label`}
      >
        ⌫
      </button>
    </div>
  );
}
