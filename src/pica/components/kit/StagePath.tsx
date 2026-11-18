"use client";

import Link from "next/link";
import { cn } from "./cn";
import { useLand } from "./useLand";

export type StageId = "needs" | "options" | "compare" | "decide";
export type DecisionResult = "Bought" | "Not buying" | "Saved";

export const STAGES: { id: StageId; label: string }[] = [
  { id: "needs", label: "Needs" },
  { id: "options", label: "Options" },
  { id: "compare", label: "Compare" },
  { id: "decide", label: "Decide" },
];

export interface StageCounts {
  /** Must-haves plus nice-to-haves. Budget and open questions are not needs. */
  needs: number;
  options: number;
  /** Options in the comparison. */
  comparing: number;
  /** How the decision ended, once it has. */
  outcome?: DecisionResult | null;
  /** An option is chosen and the decision is still open. The outcome, if any, wins. */
  chosen?: boolean;
}

/** The fact under each stage, in the brief's words (section 5). Counts only, never a percent. */
export function stageFacts({ needs, options, comparing, outcome, chosen = false }: StageCounts): Record<StageId, string> {
  return {
    needs: needs > 0 ? `${needs} ${needs === 1 ? "need" : "needs"}` : "None yet",
    options: options > 0 ? `${options} ${options === 1 ? "option" : "options"}` : "None yet",
    compare: comparing > 0 ? `Comparing ${comparing}` : "Optional",
    decide: outcome ?? (chosen ? "Chosen" : "Nothing chosen"),
  };
}

export interface StagePathProps {
  counts: StageCounts;
  /** Where each stage goes. Every stage is a link at all times; none is locked. */
  hrefs: Record<StageId, string>;
  /** The stage on screen. Leave out where none is (Done, Saved). */
  current?: StageId;
  className?: string;
}

/**
 * Needs · Options · Compare · Decide. The current stage has a purple-soft
 * pill, a 2px ink edge and semibold text. No ticks: nothing here reads as
 * "done". On phones only the current stage shows its fact; screen readers
 * hear them all.
 */
export function StagePath({ counts, hrefs, current, className }: StagePathProps) {
  const facts = stageFacts(counts);
  return (
    <nav aria-label="Decision stages" className={className}>
      <ol className="grid grid-cols-4 gap-0.5 sm:gap-1">
        {STAGES.map(({ id, label }) => (
          <li key={id} className="min-w-0">
            <StageLink href={hrefs[id]} label={label} fact={facts[id]} current={id === current} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StageLink({ href, label, fact, current }: { href: string; label: string; fact: string; current: boolean }) {
  // The count "lands" when it changes, the second of the brief's three moments.
  const factRef = useLand<HTMLSpanElement>(fact);
  return (
    <Link
      href={href}
      aria-current={current ? "step" : undefined}
      className={cn(
        // Under 400 the labels drop to caption size so "Compare" fits a
        // quarter of a 320px screen without breaking mid-word.
        "flex min-h-11 flex-col items-center justify-center rounded-thumb border-2 px-0.5 py-1 text-center text-caption text-ink min-[400px]:text-body sm:rounded-pill sm:px-3",
        "transition-colors duration-(--duration-fast) ease-out-soft",
        current ? "border-ink bg-purple-soft font-semibold" : "border-transparent hover:bg-surface",
      )}
    >
      <span className="max-w-full break-words">{label}</span>
      <span
        ref={factRef}
        className={cn(
          "max-w-full text-caption font-normal break-words",
          // ink-soft is under 4.5:1 on purple-soft, so the current fact is ink.
          // On phones the other facts are hidden from sight only; screen
          // readers still hear every stage's fact.
          current ? "inline-block text-ink" : "sr-only text-ink-soft sm:not-sr-only sm:inline-block",
        )}
      >
        <span className="sr-only">, </span>
        {fact}
      </span>
    </Link>
  );
}
