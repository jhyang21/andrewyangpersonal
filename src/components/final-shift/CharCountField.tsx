"use client";

import { useId } from "react";

type CharCountFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  limit: number;
  placeholder?: string;
  support?: string;
  rows?: number;
  /** Shown under the field when the guest has tried to continue with it over the limit. */
  error?: string | null;
};

/**
 * A text field with a visible budget.
 *
 * Deliberately no `maxLength`. The handoff asks for limits "without silently deleting text", and
 * maxLength does exactly that — it swallows keystrokes at the boundary and truncates a paste without
 * saying so, which is worst for the guest who wrote their line somewhere else and pasted it in.
 * Instead the field takes everything, the counter turns red, and Continue is what refuses. The
 * server re-checks the same limit, so nothing depends on this being honoured.
 */
export function CharCountField({
  label,
  value,
  onChange,
  limit,
  placeholder,
  support,
  rows = 3,
  error,
}: CharCountFieldProps) {
  const id = useId();
  const countId = `${id}-count`;
  const supportId = `${id}-support`;
  const errorId = `${id}-error`;
  const over = value.length > limit;

  return (
    <div>
      <label htmlFor={id} className="fs-label block text-[var(--fs-oat)]">
        {label}
      </label>
      {support ? (
        <p id={supportId} className="fs-meta mt-1 text-[var(--fs-muted-on-espresso)]">
          {support}
        </p>
      ) : null}

      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={over || Boolean(error)}
        aria-describedby={[support ? supportId : null, countId, error ? errorId : null]
          .filter(Boolean)
          .join(" ")}
        className="mt-2 w-full resize-y rounded-[var(--fs-radius)] border border-[var(--fs-line)] bg-[var(--fs-ink)] px-4 py-3 text-[var(--fs-cream)] placeholder:text-[var(--fs-muted-on-espresso)]"
      />

      {/*
       * Not a live region. It would fire on every keystroke, which is unbearable on a screen reader;
       * aria-describedby means the count is read when the field takes focus and on demand instead.
       */}
      <p
        id={countId}
        className={`fs-meta mt-1 text-right ${
          over ? "text-[var(--fs-red)]" : "text-[var(--fs-muted-on-espresso)]"
        }`}
      >
        {over ? `${value.length - limit} over the ${limit} limit` : `${value.length} / ${limit}`}
      </p>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="fs-body flex gap-2 border-l-2 border-[var(--fs-red)] pl-3 text-[var(--fs-oat)]"
        >
          <span aria-hidden="true" className="text-[var(--fs-red)]">
            ✕
          </span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
