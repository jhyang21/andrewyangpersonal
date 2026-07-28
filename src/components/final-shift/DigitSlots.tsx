"use client";

import { useRef } from "react";
import { useCoarsePointer } from "@/lib/final-shift/useMediaQuery";

export const CODE_LENGTH = 4;

type DigitSlotsProps = {
  value: string;
  onChange: (next: string) => void;
  label: string;
  invalid?: boolean;
  describedBy?: string;
  /** Plays the punch motion once, when the guest submits. */
  punching?: boolean;
};

/**
 * The four-digit display, with one real input hidden behind it.
 *
 * The usual approaches both fail somebody. Four separate inputs that auto-advance are a well-known
 * screen-reader and paste disaster. A pure-JS keypad writing to a `<div>` gives a hardware keyboard,
 * a switch device, or a braille display nothing to type into at all.
 *
 * So: exactly one `<input>`, labelled and focusable, stretched transparently over the four rendered
 * slots. On a touch device it takes `inputMode="none"`, which keeps the input real while telling iOS
 * and Android not to raise the on-screen keyboard over our own keypad. On anything with a fine
 * pointer — a laptop, or a switch user driving a keyboard — the attribute is dropped and typing works
 * normally. Nobody has to choose between the custom pad and keyboard access.
 */
export function DigitSlots({
  value,
  onChange,
  label,
  invalid,
  describedBy,
  punching,
}: DigitSlotsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const coarse = useCoarsePointer();
  const slots = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? "");

  return (
    <div className={`relative ${punching ? "fs-anim-punch" : ""}`}>
      <input
        ref={inputRef}
        type="text"
        inputMode={coarse ? "none" : "numeric"}
        pattern="\d*"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
        }
        /*
         * Transparent rather than hidden. A visually-hidden input can't be focused by tapping the
         * slots, and off-screen positioning makes some browsers scroll the page when it takes focus.
         * Sitting invisibly on top of the slots means a tap lands on the input itself.
         */
        className="absolute inset-0 z-10 h-full w-full cursor-pointer bg-transparent text-transparent caret-transparent"
      />

      <div aria-hidden="true" className="flex gap-3">
        {slots.map((digit, index) => {
          const isNext = index === value.length;
          return (
            <span
              key={index}
              className={`fs-digit flex h-16 flex-1 items-center justify-center rounded-[var(--fs-radius)] border bg-[var(--fs-cream)] text-[var(--fs-ink)] ${
                invalid
                  ? "border-2 border-[var(--fs-red)]"
                  : isNext
                    ? "border-2 border-[var(--fs-ink)]"
                    : "border-[var(--fs-line)]"
              }`}
            >
              {digit || (isNext ? <span className="fs-anim-caret">|</span> : "")}
            </span>
          );
        })}
      </div>
    </div>
  );
}
