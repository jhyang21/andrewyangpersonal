import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  /**
   * The mascot at 120 in the pose the screen calls for (`idle`, `weighing`,
   * `resting` or `unsure`). The kit takes it as a slot and never imports it.
   */
  art?: ReactNode;
  title: string;
  /** One line on what to do next. */
  description?: string;
  /** Usually one Button. */
  action?: ReactNode;
  /** Heading tag, to fit the page outline. Default `h2`. */
  headingLevel?: "h2" | "h3";
  className?: string;
}

/**
 * The "nothing yet" pattern: centred art, a title, one line, one action.
 * The line is ink-soft, which passes on white and on canvas.
 */
export function EmptyState({ art, title, description, action, headingLevel: Heading = "h2", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
      {art ? (
        <div aria-hidden className="flex items-center justify-center">
          {art}
        </div>
      ) : null}
      <Heading className="text-heading font-semibold text-ink">{title}</Heading>
      {description ? <p className="max-w-sm text-body-lg text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
