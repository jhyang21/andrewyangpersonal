import { useId, type ComponentPropsWithRef } from "react";
import { cn } from "./cn";
import { FIELD_BASE, FieldShell, fieldBorder, fieldDescribedBy } from "./Field";

export interface TextInputProps extends Omit<ComponentPropsWithRef<"input">, "size" | "className"> {
  /** Always required. Use `hideLabel` to show it to screen readers only; a placeholder is never the label. */
  label: string;
  hideLabel?: boolean;
  /** Help text under the field. Hidden while an error shows. */
  hint?: string;
  /** What went wrong and how to fix it. Turns the border red. */
  error?: string;
  className?: string;
}

/** A white pill input, 48 high, with a 1px ink-muted border that turns purple on focus. */
export function TextInput({ label, hideLabel, hint, error, id, className, ...rest }: TextInputProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hideLabel={hideLabel} hint={hint} error={error} className={className}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(fieldId, hint, error)}
        className={cn(FIELD_BASE, fieldBorder(error), "h-12 rounded-pill")}
        {...rest}
      />
    </FieldShell>
  );
}
