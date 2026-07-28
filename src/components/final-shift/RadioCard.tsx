"use client";

import { useId } from "react";

type RadioCardProps = {
  name: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  support?: string;
};

/**
 * A large tappable card backed by a real radio.
 *
 * The input is a genuine `<input type="radio">`, visually hidden but present — so arrow-key roving,
 * form semantics, and screen-reader announcement all come free, and none of it has to be
 * reimplemented with roles and key handlers.
 *
 * Selection is shown three ways: a heavier border, a check glyph, and a bolder label. Colour is only
 * the fourth signal, because the handoff requires state to survive without it.
 */
export function RadioCard({ name, checked, onSelect, label, support }: RadioCardProps) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-[var(--fs-radius)] border p-4 transition-colors ${
        checked
          ? "border-2 border-[var(--fs-cream)] bg-[var(--fs-ink)]"
          : "border-[var(--fs-line)] hover:border-[var(--fs-oat)]"
      }`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="fs-sr-only"
      />
      <span
        aria-hidden="true"
        className={`fs-label mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          checked
            ? "border-[var(--fs-cream)] bg-[var(--fs-cream)] text-[var(--fs-espresso)]"
            : "border-[var(--fs-line)] text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="min-w-0">
        <span
          className={`fs-body block text-[var(--fs-cream)] ${checked ? "font-semibold" : ""}`}
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
