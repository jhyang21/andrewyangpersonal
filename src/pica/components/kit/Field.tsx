import { CircleExclamationPoint } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Shared label, hint and error layout for TextInput and TextArea.
 * Not exported from the kit's index.
 */
export interface FieldShellProps {
  id: string;
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

/** The shown error replaces the hint, so point at whichever one is on screen. */
export function fieldDescribedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

/**
 * The input itself. The brief sets the edge and the placeholder:
 * - a 1px ink-muted border on any background (hairline is 1.2:1 on white);
 * - placeholders in ink-soft, never the `disabled` grey (1.6:1).
 * Focus is the brief's ring: 2px purple with a 2px gap, on any focus (a
 * text field takes the keyboard however it was reached). The edge stays as
 * it is, so the field does not shift. The ring's colour is set at rest, so
 * `transition-colors` does not fade it in from ink.
 */
export const FIELD_BASE =
  "w-full border bg-surface px-5 text-body-lg text-ink placeholder:text-ink-soft " +
  "transition-colors duration-(--duration-fast) ease-out-soft " +
  "outline-shop-purple focus:outline-2 focus:outline-offset-2 " +
  "disabled:cursor-not-allowed disabled:border-hairline disabled:bg-canvas disabled:text-ink-muted";

export function fieldBorder(error?: string) {
  return error ? "border-critical" : "border-ink-muted";
}

export function FieldShell({ id, label, hideLabel, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("px-1 text-body font-medium text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="px-1 text-caption text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        // role="alert" so screen readers announce a new error as it appears.
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 px-1 text-caption text-ink">
          <CircleExclamationPoint aria-hidden size={16} className="shrink-0 text-critical" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
