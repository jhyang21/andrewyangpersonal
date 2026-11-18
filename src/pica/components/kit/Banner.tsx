import { Info, OctagonExclamationPoint, TriangleExclamationPoint, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "./cn";

export type BannerTone = "info" | "caution" | "critical";

export interface BannerAction {
  label: string;
  onClick?: () => void;
  href?: string;
  /** A spinner while the action's own work runs; the button keeps focus. */
  loading?: boolean;
  /** Off, as on any Button. */
  disabled?: boolean;
  /** Off but still focusable, with no spinner, as on any Button. */
  held?: boolean;
}

export interface BannerProps {
  /** Default `info`. */
  tone?: BannerTone;
  /** Short heading. Optional. */
  title?: string;
  /** What happened, then what to do. Server lines go here word for word. */
  children: ReactNode;
  /** One way forward, such as "Try again". A ghost button inside the banner. */
  action?: BannerAction;
  /**
   * The mascot at 24 in the `unsure` pose, where the brief asks for it. It
   * takes the lead spot; the tone icon then sits before the text, so the
   * tone still shows as an icon and not as colour alone.
   */
  art?: ReactNode;
  className?: string;
}

export const BANNER_TONES: Record<
  BannerTone,
  { icon: LucideIcon; word: string; role: "alert" | "status"; box: string; iconColor: string }
> = {
  info: { icon: Info, word: "Note", role: "status", box: "bg-surface", iconColor: "text-ink" },
  caution: { icon: TriangleExclamationPoint, word: "Caution", role: "status", box: "bg-caution-bg", iconColor: "text-ink" },
  critical: { icon: OctagonExclamationPoint, word: "Problem", role: "alert", box: "bg-surface", iconColor: "text-critical" },
};

/**
 * Every tone has a 1px ink-muted edge, the brief's rule for parts that must
 * hold on any background. Without it a white banner vanishes on a white
 * card or in a Sheet, and caution-bg on white is 1.05:1. On the grey canvas
 * the edge is the only change.
 */
export const BANNER_EDGE = "border border-ink-muted";

/**
 * A message across the top of a section. Critical banners are alerts; info
 * and caution are polite status lines. The role sits on the banner, never on
 * its button. Each tone has its own icon and a hidden word for screen
 * readers, so colour never carries the meaning alone. Text is always ink:
 * neither muted grey passes on caution-bg.
 */
export function Banner({ tone = "info", title, children, action, art, className }: BannerProps) {
  const { icon: Icon, word, role, box, iconColor } = BANNER_TONES[tone];
  const toneIcon = (size: number, extra: string) => (
    <Icon aria-hidden size={size} className={cn("shrink-0", iconColor, extra)} />
  );
  const inlineIcon = art ? toneIcon(16, "mr-1.5 inline-block align-[-3px]") : null;

  return (
    <div role={role} className={cn("flex gap-3 rounded-image p-4 text-ink", BANNER_EDGE, box, className)}>
      {art ? (
        <span aria-hidden className="shrink-0">
          {art}
        </span>
      ) : (
        toneIcon(20, "mt-px")
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? (
          <p className="text-body font-semibold">
            {inlineIcon}
            <span className="sr-only">{word}: </span>
            {title}
          </p>
        ) : null}
        <div className="text-body">
          {title ? null : (
            <>
              {inlineIcon}
              <span className="sr-only">{word}: </span>
            </>
          )}
          {children}
        </div>
        {action ? (
          <div className="-ml-3 mt-1">
            <Button
              variant="ghost"
              href={action.href}
              onClick={action.onClick}
              loading={action.loading}
              disabled={action.disabled}
              held={action.held}
            >
              {action.label}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
