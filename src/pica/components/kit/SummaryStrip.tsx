"use client";

import { ChevronUp, ListChecks } from "lucide-react";
import { Fragment, useState } from "react";
import { cn } from "./cn";
import { useLand } from "./useLand";

export interface SummaryInput {
  /** The buyer's goal in their words, e.g. "Two weeks in Japan without checking a bag". Leads the strip. */
  goal?: string | null;
  /** What the buyer is after, e.g. "Backpacks". */
  category?: string | null;
  /** The budget as words, e.g. "under $200". */
  budget?: string | null;
  /** Must-haves plus nice-to-haves. */
  needs: number;
  /** Guesses waiting for the buyer to confirm. */
  toConfirm: number;
}

export const EMPTY_SUMMARY = "Your needs: none yet";

/** The strip's parts, leaving out any with no value. */
export function summaryParts({ goal, category, budget, needs, toConfirm }: SummaryInput): string[] {
  const parts: string[] = [];
  if (goal?.trim()) parts.push(goal.trim());
  if (category?.trim()) parts.push(category.trim());
  if (budget?.trim()) parts.push(budget.trim());
  if (needs > 0) parts.push(`${needs} ${needs === 1 ? "need" : "needs"}`);
  if (toConfirm > 0) parts.push(`${toConfirm} to confirm`);
  return parts;
}

/** "Backpacks · under $200 · 3 needs · 1 to confirm", or "Your needs: none yet". */
export function summaryText(input: SummaryInput): string {
  const parts = summaryParts(input);
  return parts.length ? parts.join(" · ") : EMPTY_SUMMARY;
}

/**
 * The strip's render-time rule. Null when the text has not changed.
 * Otherwise the new text to remember, plus a line for the status region
 * when `announce` is on. While it is off the text is still remembered, so
 * turning it on later does not replay the load. The strip passes true only
 * when `announce` was on in the last render too, so a change that lands in
 * the render that turns it on stays silent.
 */
export function summaryStep(
  shown: string,
  input: SummaryInput,
  announce: boolean,
): { shown: string; announcement?: string } | null {
  const parts = summaryParts(input);
  const text = parts.length ? parts.join(" · ") : EMPTY_SUMMARY;
  if (text === shown) return null;
  if (!announce) return { shown: text };
  return { shown: text, announcement: `Needs updated: ${parts.length ? parts.join(", ") : "none yet"}` };
}

export interface SummaryStripProps extends SummaryInput {
  /** Opens the canvas as a sheet. */
  onOpen: () => void;
  /** Whether the sheet is open. */
  expanded?: boolean;
  /** The id of the sheet it opens, such as Sheet's `id`. */
  controls?: string;
  /**
   * Whether changes are announced and lift the strip. Default on, so a
   * strip that always has its data behaves as before. A screen that renders
   * empty and then loads the decision passes whether that first load has
   * finished, for example `announce={loaded}`. Never pass a busy flag that
   * flips on every request: each change arrives with that flag turning back
   * on, so every change would be silent. The first load is silent and still,
   * even when the data and the switch to `true` arrive in the same render:
   * only changes after that render are announced.
   */
  announce?: boolean;
  className?: string;
}

/**
 * One line, always in view, built from the canvas. The strip is a button; a
 * hidden `role="status"` region beside it, not inside it, announces each
 * change after the first render. It lifts once when the need count changes.
 * Both wait while `announce` is false; see that prop.
 */
export function SummaryStrip({
  onOpen,
  expanded = false,
  controls,
  announce = true,
  className,
  ...input
}: SummaryStripProps) {
  const parts = summaryParts(input);
  const text = parts.length ? parts.join(" · ") : EMPTY_SUMMARY;
  const ref = useLand<HTMLButtonElement>(input.needs, "kit-lift", announce);

  // Announce changes, not the first render: React's "adjust state while
  // rendering" pattern, so no effect is needed. See summaryStep. `wasOn`
  // is `announce` as of the last render, so the render that switches it on
  // (the one that usually carries the loaded data) stays silent.
  const [shown, setShown] = useState(text);
  const [wasOn, setWasOn] = useState(announce);
  const [announcement, setAnnouncement] = useState("");
  const step = summaryStep(shown, input, announce && wasOn);
  if (step) {
    setShown(step.shown);
    if (step.announcement !== undefined) setAnnouncement(step.announcement);
  }
  if (wasOn !== announce) setWasOn(announce);

  return (
    <div className={className}>
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onOpen}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 bg-surface px-4 py-2 text-left text-body text-ink shadow-float",
          "rounded-pill transition-colors duration-(--duration-fast) ease-out-soft hover:bg-canvas",
        )}
      >
        <ListChecks aria-hidden size={20} className="shrink-0" />
        <span className="min-w-0 flex-1 break-words">
          {parts.length ? (
            <>
              <span className="sr-only">Your needs: </span>
              {parts.map((part, i) => (
                <Fragment key={i}>
                  {i > 0 ? (
                    <>
                      <span aria-hidden> · </span>
                      <span className="sr-only">, </span>
                    </>
                  ) : null}
                  {/* Keep a count with its word: "3 needs" never splits across lines. */}
                  <span className={i === 0 ? "font-semibold" : undefined}>{part.replace(/^(\d+) /, "$1\u00a0")}</span>
                </Fragment>
              ))}
            </>
          ) : (
            <span className="text-ink-soft">{EMPTY_SUMMARY}</span>
          )}
        </span>
        <ChevronUp aria-hidden size={20} className="shrink-0" />
      </button>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
