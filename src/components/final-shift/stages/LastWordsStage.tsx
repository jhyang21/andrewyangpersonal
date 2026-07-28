"use client";

import { useState } from "react";
import { CharCountField } from "@/components/final-shift/CharCountField";
import { StageFrame } from "@/components/final-shift/StageFrame";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";
import { LIMITS } from "@/lib/final-shift/types";

/**
 * Stage 5 — one line for Andrew. Optional, and the skip is a real, visible option.
 *
 * The prompt chips change the placeholder and nothing else. Inserting their text into the field is
 * the obvious alternative and it's wrong twice over: it overwrites whatever the guest already typed,
 * and it turns a personal note into a form Andrew can tell was autofilled. A placeholder suggests;
 * inserted text puts words in someone's mouth.
 */
export function LastWordsStage({ values, update, goTo, goBack }: StageProps) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const tooLong = values.memory.length > LIMITS.memory;
  const placeholder =
    COPY.lastWords.prompts.find((p) => p.id === prompt)?.placeholder ??
    COPY.lastWords.placeholder;

  const advance = () => {
    if (tooLong) {
      setShowErrors(true);
      return;
    }
    goTo("review");
  };

  return (
    <StageFrame
      stage="lastWords"
      heading={COPY.lastWords.heading}
      support={COPY.lastWords.support}
      onBack={goBack}
      action={
        <div className="space-y-3">
          <button
            type="button"
            onClick={advance}
            className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)] active:translate-y-px"
          >
            {COPY.lastWords.cta}
          </button>
          <button
            type="button"
            onClick={() => {
              update({ memory: "" });
              goTo("review");
            }}
            className="fs-label min-h-11 w-full text-[var(--fs-oat)] underline underline-offset-4"
          >
            {COPY.lastWords.skip}
          </button>
        </div>
      }
    >
      <div className="fs-anim-ticket-feed space-y-5">
        <div>
          <p id="fs-prompt-label" className="fs-label text-[var(--fs-oat)]">
            Need a starting point?
          </p>
          {/*
           * Radios, not buttons: picking a prompt is choosing one of a set, and a radio group says
           * so — including which one is currently active, which a row of buttons would have to
           * describe with aria-pressed and usually gets wrong.
           */}
          <div
            role="radiogroup"
            aria-labelledby="fs-prompt-label"
            className="mt-3 flex flex-wrap gap-2"
          >
            {COPY.lastWords.prompts.map((option) => {
              const isOn = prompt === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isOn}
                  onClick={() => setPrompt(isOn ? null : option.id)}
                  className={`fs-meta flex min-h-11 items-center rounded-full border px-4 transition-colors ${
                    isOn
                      ? "border-2 border-[var(--fs-cream)] bg-[var(--fs-cream)] text-[var(--fs-espresso)]"
                      : "border-[var(--fs-line)] text-[var(--fs-cream)] hover:border-[var(--fs-oat)]"
                  }`}
                >
                  {option.chip}
                </button>
              );
            })}
          </div>
        </div>

        <CharCountField
          label={COPY.lastWords.label}
          value={values.memory}
          onChange={(memory) => update({ memory })}
          limit={LIMITS.memory}
          rows={4}
          placeholder={placeholder}
          error={showErrors && tooLong ? COPY.lastWords.errors.longMemory : null}
        />
      </div>
    </StageFrame>
  );
}
