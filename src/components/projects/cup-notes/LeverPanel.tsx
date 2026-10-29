"use client";

import { useId } from "react";
import { Columns2, Play, RotateCcw, SkipForward, X } from "lucide-react";
import type { CupNotesIndex, LeverKey, LeverSelection } from "@/lib/cup-notes/types";
import { LEVER_ORDER, LEVER_TITLES } from "./shared";

export type Phase = "idle" | "playing" | "done";

type Props = {
  index: CupNotesIndex;
  selection: LeverSelection;
  onLever: (lever: LeverKey, key: string) => void;
  phase: Phase;
  onRun: () => void;
  onSkip: () => void;
  onCompare: () => void;
  /* Set while compare is on: the name of the pinned scenario A. */
  pinnedName: string | null;
};

export function LeverPanel({
  index,
  selection,
  onLever,
  phase,
  onRun,
  onSkip,
  onCompare,
  pinnedName,
}: Props) {
  const groupId = useId();
  const compareOn = pinnedName !== null;

  return (
    <div className="cn-panel">
      <div className="cn-levers">
        {LEVER_ORDER.map((lever) => (
          <fieldset key={lever} className="cn-lever">
            <legend className="cn-seg-legend">
              {LEVER_TITLES[lever]}
              {compareOn && <span className="cn-seg-legend-b"> · sets B</span>}
            </legend>
            <div className="cn-seg-track">
              {index.levers[lever].map((o) => {
                const on = selection[lever] === o.key;
                return (
                  <label key={o.key} className={`cn-seg ${on ? "cn-seg-on" : ""}`}>
                    <input
                      type="radio"
                      name={`${groupId}-${lever}`}
                      value={o.key}
                      checked={on}
                      onChange={() => onLever(lever, o.key)}
                      className="sr-only"
                    />
                    <span className="cn-seg-label">{o.label}</span>
                    <span className="cn-seg-short">{o.short}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="cn-actions">
        <button type="button" className="cn-btn cn-btn-primary" onClick={onRun}>
          {phase === "idle" ? (
            <Play size={16} aria-hidden="true" />
          ) : (
            <RotateCcw size={16} aria-hidden="true" />
          )}
          {phase === "idle" ? "Run simulation" : "Replay"}
        </button>

        {phase === "playing" && (
          <button type="button" className="cn-btn cn-btn-ghost" onClick={onSkip}>
            <SkipForward size={16} aria-hidden="true" />
            Skip
          </button>
        )}

        <button
          type="button"
          className={`cn-btn cn-btn-ghost ${compareOn ? "cn-btn-on" : ""}`}
          aria-pressed={compareOn}
          onClick={onCompare}
        >
          {compareOn ? (
            <X size={16} aria-hidden="true" />
          ) : (
            <Columns2 size={16} aria-hidden="true" />
          )}
          {compareOn ? "End compare" : "Compare"}
        </button>

        <p className="cn-actions-hint" aria-live="polite">
          {compareOn ? (
            <>
              <span className="cn-ab cn-ab-a">A</span> pinned: {pinnedName}. Use the levers to
              pick <span className="cn-ab cn-ab-b">B</span>.
            </>
          ) : (
            "Compare pins this scenario as A, then the levers pick B."
          )}
        </p>
      </div>
    </div>
  );
}
