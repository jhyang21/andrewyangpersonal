import Link from "next/link";
import { Check, LoaderCircle, type LucideIcon } from "lucide-react";
import type { AriaAttributes, MouseEventHandler, ReactNode, Ref } from "react";
import { cn, isExternalHref } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

export interface ButtonProps {
  children: ReactNode;
  /** `primary` is purple. Use one per screen. Default `secondary`. */
  variant?: ButtonVariant;
  /**
   * `md` is 44 high, `lg` 48. Defaults: `lg` for primary, `md` otherwise.
   * Set it to give a stack of buttons one height, as on Decide.
   */
  size?: ButtonSize;
  /** Renders a link. Paths starting with "/" use Next's Link; other URLs open in a new tab. */
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  /** Shows a spinner, blocks clicks and sets `aria-busy`. Keeps focus. */
  loading?: boolean;
  /**
   * Off but still focusable, with no spinner: the disabled look,
   * `aria-disabled`, clicks ignored. Use it where the button turns off while
   * it may hold focus, such as when a reply starts elsewhere; `disabled`
   * would drop focus to the page.
   */
  held?: boolean;
  /**
   * Makes the button a toggle, such as "Compare" on an option card. Pressed
   * takes the brief's selected look: purple-soft fill, a check in place of
   * the icon, and a 2px ink edge. Screen readers hear `aria-pressed`. With
   * no icon, an empty slot holds the check's place while unpressed, so the
   * width does not change. Leave it out for a plain button. Buttons only,
   * not links.
   */
  pressed?: boolean;
  /** A Lucide icon shown before the label. */
  icon?: LucideIcon;
  /**
   * Fills the width. Any button's height is a minimum, so a long label wraps
   * to two or three lines inside the shape instead of spilling out.
   */
  fullWidth?: boolean;
  /**
   * The background the button sits on. Only changes `secondary`: grey on a
   * white card (default), white on the grey canvas, so it never disappears.
   */
  on?: "surface" | "canvas";
  id?: string;
  /** For menus and disclosures: "More", the header menu. */
  "aria-expanded"?: AriaAttributes["aria-expanded"];
  "aria-controls"?: string;
  "aria-haspopup"?: AriaAttributes["aria-haspopup"];
  /** Only when the visible label needs more words, such as which item it acts on. */
  "aria-label"?: string;
  ref?: Ref<HTMLElement>;
  className?: string;
}

// Live styles change on hover only while not disabled, and each carries
// `disabled:` styles too, so a button inside a disabled <fieldset> (which
// matches :disabled but gets no `disabled` prop) looks disabled. DISABLED
// below covers the prop and disabled links, which never match :disabled.
// The ghost variant has no fill, so disabled it takes the `disabled` colour
// rather than ink-muted, which reads as live secondary text. Disabled
// controls are exempt from the contrast rule.
const SECONDARY_ON_CANVAS =
  "bg-surface shadow-pill not-disabled:hover:bg-hairline not-disabled:active:bg-hairline " +
  "disabled:cursor-not-allowed disabled:text-ink-muted disabled:shadow-none";

const BASE =
  "inline-flex select-none items-center justify-center gap-2 text-body-lg font-medium " +
  "transition-colors duration-(--duration-fast) ease-out-soft";

const PADDING: Record<ButtonVariant, string> = { primary: "px-6", secondary: "px-5", ghost: "px-3" };

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-shop-purple text-surface not-disabled:hover:bg-shop-purple-pressed not-disabled:active:bg-shop-purple-pressed " +
    "disabled:cursor-not-allowed disabled:bg-hairline disabled:text-ink-muted",
  secondary:
    "bg-canvas text-ink not-disabled:hover:bg-hairline not-disabled:active:bg-hairline " +
    "disabled:cursor-not-allowed disabled:text-ink-muted",
  ghost: "text-ink not-disabled:hover:underline underline-offset-4 disabled:cursor-not-allowed disabled:text-disabled",
};

const DISABLED: Record<ButtonVariant, string> = {
  primary: "bg-hairline text-ink-muted cursor-not-allowed",
  secondary: "bg-canvas text-ink-muted cursor-not-allowed",
  ghost: "text-disabled cursor-not-allowed",
};

// Selected: fill, check and a 2px ink edge, drawn as an inset ring so the
// button keeps its size when it toggles. A disabled <fieldset> greys it.
const PRESSED =
  "bg-purple-soft text-ink inset-ring-2 inset-ring-ink not-disabled:hover:bg-purple-tint " +
  "disabled:cursor-not-allowed disabled:bg-hairline disabled:text-ink-muted disabled:inset-ring-hairline";

/**
 * Height and shape. A minimum height with padding, and a radius of half the
 * one-line height: one line is exactly 44 or 48 and looks like a pill, and
 * a label that runs out of room (a long merchant name, or large text on a
 * narrow screen) wraps inside a rounded rectangle instead of pushing the
 * page sideways.
 */
function shape(size: ButtonSize, fullWidth: boolean): string {
  return cn(
    "text-center",
    fullWidth ? "w-full" : "max-w-full",
    size === "lg" ? "min-h-12 rounded-[1.5rem] py-3" : "min-h-11 rounded-[1.375rem] py-2.5",
  );
}

/**
 * A pill button, or a link styled as one. Never carries a status role: put
 * `role="status"` on a container around it instead.
 */
export function Button({
  children,
  variant = "secondary",
  size,
  href,
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  held = false,
  pressed,
  icon: Icon,
  fullWidth = false,
  on = "surface",
  id,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-haspopup": ariaHaspopup,
  "aria-label": ariaLabel,
  ref,
  className,
}: ButtonProps) {
  const inactive = disabled || loading || held;
  // Off in look: disabled, or held (off but focusable).
  const off = disabled || held;
  // Clicks ignored while focus stays.
  const blocked = loading || held;
  const isToggle = pressed !== undefined && !href;
  const onCanvas = variant === "secondary" && on === "canvas";
  const look = isToggle && pressed
    ? off
      ? "bg-hairline text-ink-muted cursor-not-allowed"
      : PRESSED
    : onCanvas
      ? off
        ? "bg-surface text-ink-muted cursor-not-allowed"
        : cn("text-ink", SECONDARY_ON_CANVAS)
      : off
        ? DISABLED[variant]
        : VARIANTS[variant];
  const classes = cn(
    BASE,
    shape(size ?? (variant === "primary" ? "lg" : "md"), fullWidth),
    onCanvas ? "px-5" : PADDING[variant],
    look,
    loading && "cursor-progress",
    className,
  );

  const LeadIcon = isToggle && pressed ? Check : Icon;
  // A toggle with no icon keeps an empty slot the check's size while
  // unpressed, so pressing it does not widen it and shift its neighbours.
  const keepCheckSlot = isToggle && !Icon;
  const content = (
    <>
      {loading ? (
        <LoaderCircle aria-hidden size={20} className="shrink-0 motion-safe:animate-spin" />
      ) : LeadIcon ? (
        <LeadIcon aria-hidden size={20} className="shrink-0" />
      ) : keepCheckSlot ? (
        <span aria-hidden data-check-slot className="size-[20px] shrink-0" />
      ) : null}
      <span className="min-w-0 break-words">{children}</span>
    </>
  );

  const aria = {
    id,
    "aria-expanded": ariaExpanded,
    "aria-controls": ariaControls,
    "aria-haspopup": ariaHaspopup,
    "aria-label": ariaLabel,
  };

  if (href) {
    const linkRef = ref as Ref<HTMLAnchorElement> | undefined;
    // An inactive link has no href, so it cannot be followed. With no href
    // an <a> has no role of its own, so `role="link"` keeps it a link to a
    // screen reader. Disabled or loading, it leaves the tab order; held, it
    // stays in it.
    if (inactive) {
      return (
        <a
          ref={linkRef}
          {...aria}
          aria-disabled="true"
          role="link"
          tabIndex={held && !disabled && !loading ? 0 : undefined}
          aria-busy={loading || undefined}
          className={classes}
        >
          {content}
        </a>
      );
    }
    if (isExternalHref(href)) {
      return (
        <a ref={linkRef} {...aria} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={classes}>
          {content}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      );
    }
    return (
      <Link ref={linkRef} {...aria} href={href} onClick={onClick} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    // A loading or held button keeps focus but ignores clicks and never
    // submits. No handler of its own, so this works in server components too.
    <button
      ref={ref as Ref<HTMLButtonElement> | undefined}
      type={blocked ? "button" : type}
      onClick={blocked ? undefined : onClick}
      disabled={disabled}
      aria-pressed={isToggle ? pressed : undefined}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      {...aria}
      className={classes}
    >
      {content}
    </button>
  );
}
