import { Check, X, type LucideIcon } from "lucide-react";
import { cn } from "./cn";

export interface ChipProps {
  label: string;
  /** A 16px Lucide icon before the label. Replaced by a check when selected. */
  icon?: LucideIcon;
  /**
   * Pass `true` or `false` to make the chip a toggle: screen readers hear it
   * as pressed or not. Leave it out for one-shot chips such as quick answers
   * or example prompts. Without `onClick`, a selected chip is plain text that
   * screen readers hear as "<label>, selected".
   */
  selected?: boolean;
  /** Makes the chip a button. Without it the chip is plain text. */
  onClick?: () => void;
  /** Adds a remove button after the label. */
  onRemove?: () => void;
  /** Screen reader text for the remove button. Default "Remove <label>". */
  removeLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Edges. Unselected: a 1px ink-muted border on any background (the brief
 * overrides DESIGN.md's hairline, which is 1.2:1 on white). Selected:
 * purple-soft fill, a check icon and a 2px ink edge, drawn as the 1px border
 * plus a 1px inset ring so the chip does not change size when it toggles.
 * Disabled: a hairline fill and edge, ink-muted text; disabled controls are
 * exempt from the contrast rule. `has-disabled:` also catches buttons that a
 * disabled <fieldset> turns off.
 */
const EDGE = {
  idle: "border-ink-muted bg-surface text-ink",
  selected: "border-ink bg-purple-soft text-ink inset-ring inset-ring-ink",
  inert: "border-hairline bg-hairline text-ink-muted",
} as const;

const DISABLED =
  "has-disabled:border-hairline has-disabled:bg-hairline has-disabled:text-ink-muted has-disabled:inset-ring-0";

// The chip is at least 32px tall; its inner button at least 30 inside the
// 1px border. `before:` grows each button's hit area by 7px above and below:
// 44 tall or more.
const HIT = "relative before:absolute before:inset-x-0 before:-inset-y-[7px]";

/**
 * A 32px pill: toggle, one-shot, removable, or a plain label. A long label
 * wraps rather than being cut. The radius is half the one-line height, so a
 * one-line chip is a pill and a wrapped one a rounded rectangle.
 */
export function Chip({
  label,
  icon: Icon,
  selected,
  onClick,
  onRemove,
  removeLabel,
  disabled = false,
  className,
}: ChipProps) {
  const LeadIcon = selected ? Check : Icon;
  // A chip with no buttons cannot match :disabled, so it takes the disabled
  // look from the prop.
  const inert = disabled && !onClick && !onRemove;
  const inner = (
    <>
      {LeadIcon ? <LeadIcon aria-hidden size={16} className="shrink-0" /> : null}
      <span className="min-w-0 break-words">{label}</span>
    </>
  );

  return (
    <span
      className={cn(
        "inline-flex min-h-8 max-w-full items-stretch rounded-[16px] border text-body",
        "transition-colors duration-(--duration-fast) ease-out-soft",
        inert ? EDGE.inert : selected ? EDGE.selected : EDGE.idle,
        DISABLED,
        className,
      )}
    >
      {onClick ? (
        <button
          type="button"
          // Undefined leaves the attribute off, so a one-shot chip is a plain button.
          aria-pressed={selected}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            HIT,
            "inline-flex min-w-0 items-center gap-1.5 rounded-[15px] py-1.5 pl-3 text-left",
            onRemove ? "pr-1" : "pr-3",
            "disabled:cursor-not-allowed",
          )}
        >
          {inner}
        </button>
      ) : (
        <span className={cn("inline-flex min-w-0 items-center gap-1.5 py-1.5 pl-3", onRemove ? "pr-1" : "pr-3")}>
          {inner}
          {selected ? <span className="sr-only">, selected</span> : null}
        </span>
      )}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove ${label}`}
          disabled={disabled}
          onClick={onRemove}
          className={cn(
            // 36px wide plus 4px each side, 30 tall plus 7 above and below: 44 x 44.
            "relative before:absolute before:-inset-x-1 before:-inset-y-[7px]",
            "inline-flex w-9 shrink-0 items-center justify-center rounded-[15px] pr-1 text-ink",
            "disabled:cursor-not-allowed disabled:text-ink-muted",
          )}
        >
          <X aria-hidden size={16} />
        </button>
      ) : null}
    </span>
  );
}
