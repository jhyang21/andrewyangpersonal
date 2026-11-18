"use client";

import { useId } from "react";
import { Chip } from "@/pica/components/kit";
import { DECLINE_REASONS } from "@/pica/features/decision/actions";

export const DECLINE_REASONS_HEADING = "Why not? (optional)";

export interface DeclineReasonsProps {
  /** The stored reason code (`session.decision.reason`), or undefined. */
  current: string | undefined;
  /**
   * Tapped a reason. Pass `useDone(session).pickReason`: it stores the code,
   * and a second tap on the chosen one clears it. Nothing goes to analytics.
   */
  onPick: (code: string) => void;
  /** Default `h2`. */
  headingLevel?: "h2" | "h3";
  className?: string;
}

/**
 * The six reasons for not buying, as toggle chips. Done shows them once,
 * for "not buying" only, and nowhere else (brief sections 2 and 6.7).
 */
export function DeclineReasons({ current, onPick, headingLevel: Heading = "h2", className }: DeclineReasonsProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={["flex flex-col gap-3", className ?? ""].join(" ").trim()}>
      <Heading id={headingId} className="text-body-lg font-semibold text-ink">
        {DECLINE_REASONS_HEADING}
      </Heading>
      <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-x-2 gap-y-3">
        {DECLINE_REASONS.map((reason) => (
          <Chip
            key={reason.code}
            label={reason.label}
            selected={current === reason.code}
            onClick={() => onPick(reason.code)}
          />
        ))}
      </div>
    </section>
  );
}
