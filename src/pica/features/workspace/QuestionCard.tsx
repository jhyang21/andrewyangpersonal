"use client";

import { useEffect, useRef } from "react";
import { Card } from "@/pica/components/kit";
import { MAX_QUESTIONS } from "@/pica/lib/pica/constants";
import type { PicaQuestion } from "@/pica/lib/types";
import type { QuestionState } from "./thread-model";

export const QUESTION_CARD = {
  skip: "Skip this question",
  skipped: "You skipped this question.",
  answerLead: "Your answer: ",
  change: "Change this in your needs",
  why: "Why this matters: ",
} as const;

/** "Question 2 of up to 4". */
function questionCount(number: number): string {
  return `Question ${number} of up to ${MAX_QUESTIONS}`;
}

export interface QuestionCardProps {
  /** Ties the heading to the card. The tool call's id is unique. */
  id: string;
  question: PicaQuestion;
  /** From 1, counting from the last shortlist, as Pica's limit does. */
  number: number;
  state: QuestionState;
  /** True when this is the open question and Pica is not replying. Otherwise the pills are off. */
  live: boolean;
  onAnswer: (answer: string, index: number) => void;
  onSkip: () => void;
  /** "Change this in your needs": the needs are where an answer changes. */
  onOpenNeeds: () => void;
}

const PILL =
  "inline-flex min-h-11 items-center rounded-pill border border-ink-muted bg-surface px-4 py-2 text-left text-body text-ink " +
  "transition-colors duration-(--duration-fast) ease-out-soft enabled:hover:bg-canvas " +
  "disabled:cursor-not-allowed disabled:border-hairline disabled:bg-hairline disabled:text-ink-muted";

const QUIET =
  "inline-flex min-h-11 items-center rounded-pill px-3 text-body font-medium text-ink underline underline-offset-4 " +
  "disabled:cursor-not-allowed disabled:text-ink-muted";

/**
 * One of Pica's questions: how far along it is, the question, why it
 * matters, up to four answer pills and a skip. Once answered it locks and
 * shows the answer, with a way to the needs, where an answer changes.
 */
export function QuestionCard({ id, question, number, state, live, onAnswer, onSkip, onOpenNeeds }: QuestionCardProps) {
  const headingId = `question-${id}`;
  const options = question.options.slice(0, 4);

  // A pill or Skip goes with the open card; once the card shows the answer,
  // focus moves to that line, as Confirm on a guess card moves it to the row.
  // A typed answer leaves focus in the composer.
  const answeredRef = useRef<HTMLParagraphElement>(null);
  const focusAnswer = useRef(false);
  useEffect(() => {
    if (state.kind === "open" || !focusAnswer.current) return;
    focusAnswer.current = false;
    answeredRef.current?.focus();
  }, [state.kind]);

  function choose(send: () => void) {
    focusAnswer.current = true;
    send();
  }

  return (
    // An article named by its question, so a screen reader can tell one card
    // from the next. Not a section: a named section is a landmark, and the
    // chat may hold several cards.
    <Card as="article" aria-labelledby={headingId} padding="md" shadow className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-caption text-ink-soft">{questionCount(number)}</p>
        <h3 id={headingId} className="text-body-lg font-semibold text-ink">
          {question.question}
        </h3>
        {question.why ? (
          <p className="text-body text-ink-soft">
            <span className="font-medium text-ink">{QUESTION_CARD.why}</span>
            {question.why}
          </p>
        ) : null}
      </div>

      {state.kind === "open" ? (
        <>
          <ul aria-label="Answers" className="flex flex-wrap gap-2">
            {options.map((option, index) => (
              <li key={`${index}-${option}`}>
                <button type="button" disabled={!live} onClick={() => choose(() => onAnswer(option, index))} className={PILL}>
                  {option}
                </button>
              </li>
            ))}
          </ul>
          <div>
            <button type="button" disabled={!live} onClick={() => choose(onSkip)} className={QUIET}>
              {QUESTION_CARD.skip}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-start gap-1">
          <p ref={answeredRef} tabIndex={-1} className="text-body text-ink">
            {state.kind === "skipped" ? (
              QUESTION_CARD.skipped
            ) : (
              <>
                <span className="font-medium">{QUESTION_CARD.answerLead}</span>
                {state.answer}
              </>
            )}
          </p>
          <button type="button" onClick={onOpenNeeds} className={QUIET}>
            {QUESTION_CARD.change}
          </button>
        </div>
      )}
    </Card>
  );
}
