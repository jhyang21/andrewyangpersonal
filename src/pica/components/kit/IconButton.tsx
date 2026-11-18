import type { LucideIcon } from "lucide-react";
import type { AriaAttributes, MouseEventHandler, Ref } from "react";
import { cn } from "./cn";

export interface IconButtonProps {
  icon: LucideIcon;
  /** Required: what the button does, read by screen readers. It is the button's `aria-label`. */
  label: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** `surface` (white, for grey backgrounds), `canvas` (grey, for white ones) or `ghost`. Default `ghost`. */
  tone?: "surface" | "canvas" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  /** For toggles, such as save. The icon fills while pressed. */
  pressed?: boolean;
  id?: string;
  /** For menus and disclosures: "More", the Saved card's menu. */
  "aria-expanded"?: AriaAttributes["aria-expanded"];
  "aria-controls"?: string;
  "aria-haspopup"?: AriaAttributes["aria-haspopup"];
  ref?: Ref<HTMLButtonElement>;
  className?: string;
}

// Hover only while enabled. Disabled (by the prop or by a disabled
// <fieldset>, which both match :disabled): the filled tones get a hairline
// fill, no shadow and an ink-muted icon. The ghost tone has no fill to
// change, so its icon takes the `disabled` colour; ink-muted would look like
// an idle icon. Disabled controls are exempt from the contrast rule.
const TONES = {
  surface:
    "bg-surface shadow-pill enabled:hover:bg-canvas disabled:bg-hairline disabled:shadow-none disabled:text-ink-muted",
  canvas: "bg-canvas enabled:hover:bg-hairline disabled:bg-hairline disabled:text-ink-muted",
  ghost: "enabled:hover:bg-canvas disabled:text-disabled",
} as const;

/** A round 44px button with one icon. */
export function IconButton({
  icon: Icon,
  label,
  onClick,
  tone = "ghost",
  type = "button",
  disabled = false,
  pressed,
  id,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-haspopup": ariaHaspopup,
  ref,
  className,
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-haspopup={ariaHaspopup}
      id={id}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink",
        "transition-colors duration-(--duration-fast) ease-out-soft disabled:cursor-not-allowed",
        TONES[tone],
        className,
      )}
    >
      <Icon aria-hidden size={20} fill={pressed ? "currentColor" : "none"} />
    </button>
  );
}
