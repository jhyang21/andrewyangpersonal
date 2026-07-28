"use client";

import { useId } from "react";

type CheckCardProps = {
  checked: boolean;
  onToggle: (next: boolean) => void;
  label: string;
  support?: string;
  /** Quieter treatment for the consent checkbox, which is a sentence rather than an option. */
  variant?: "card" | "plain";
};

/**
 * The checkbox counterpart to RadioCard — used for the date options and the wall-consent line.
 *
 * Square glyph, not a tick in a circle: at a glance the shape is what tells a guest that dates are
 * multi-select while attendance is one-of. Same reasoning as RadioCard on everything else — a real
 * input underneath, and state carried by border, glyph, and weight before colour.
 */
export function CheckCard({
  checked,
  onToggle,
  label,
  support,
  variant = "card",
}: CheckCardProps) {
  const id = useId();
  const isCard = variant === "card";

  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-[var(--fs-radius)] ${
        isCard
          ? `border p-4 transition-colors ${
              checked
                ? "border-2 border-[var(--fs-cream)] bg-[var(--fs-ink)]"
                : "border-[var(--fs-line)] hover:border-[var(--fs-oat)]"
            }`
          : "py-2"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(event.target.checked)}
        className="fs-sr-only"
      />
      <span
        aria-hidden="true"
        className={`fs-label mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--fs-radius)] border ${
          checked
            ? "border-[var(--fs-cream)] bg-[var(--fs-cream)] text-[var(--fs-espresso)]"
            : "border-[var(--fs-line)] text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="min-w-0">
        <span
          className={`${isCard ? "fs-body" : "fs-body"} block text-[var(--fs-cream)] ${
            checked && isCard ? "font-semibold" : ""
          }`}
        >
          {label}
        </span>
        {support ? (
          <span className="fs-meta mt-1 block text-[var(--fs-muted-on-espresso)]">{support}</span>
        ) : null}
      </span>
    </label>
  );
}
