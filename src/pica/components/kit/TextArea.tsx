import { useId, type ComponentPropsWithRef } from "react";
import { cn } from "./cn";
import { FIELD_BASE, FieldShell, fieldBorder, fieldDescribedBy } from "./Field";

export interface TextAreaProps extends Omit<ComponentPropsWithRef<"textarea">, "className"> {
  /** Always required. Use `hideLabel` to show it to screen readers only; a placeholder is never the label. */
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  className?: string;
}

/** A white text box with the card radius. Grows with its text where the browser allows. */
export function TextArea({ label, hideLabel, hint, error, id, rows = 3, className, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hideLabel={hideLabel} hint={hint} error={error} className={className}>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(fieldId, hint, error)}
        className={cn(FIELD_BASE, fieldBorder(error), "field-sizing-content min-h-12 max-h-64 resize-none rounded-card py-3")}
        {...rest}
      />
    </FieldShell>
  );
}
