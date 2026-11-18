import { Feather, UserRound, type LucideIcon } from "lucide-react";
import type { Source } from "@/pica/lib/types";
import { cn } from "./cn";

export const SOURCES: Record<Source, { icon: LucideIcon; label: string }> = {
  stated: { icon: UserRound, label: "You said" },
  inferred: { icon: Feather, label: "Pica's guess" },
};

/** The tag's words, for use outside the tag. */
export function sourceLabel(source: Source): string {
  return SOURCES[source].label;
}

export interface SourceTagProps {
  source: Source;
  className?: string;
}

/**
 * Marks a need as the buyer's words or Pica's guess.
 * Guesses get a dashed outline, since the buyer can confirm or change them.
 */
export function SourceTag({ source, className }: SourceTagProps) {
  const { icon: Icon, label } = SOURCES[source];
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-pill px-2 py-0.5 text-caption font-medium text-ink",
        source === "inferred" ? "border border-dashed border-ink-muted bg-surface" : "bg-canvas",
        className,
      )}
    >
      <Icon aria-hidden size={14} className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}
