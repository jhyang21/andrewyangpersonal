"use client";

import { Check, Pencil } from "lucide-react";
import { Button, Card, SourceTag } from "@/pica/components/kit";
import type { ConfirmCard, GuessState } from "./chat-model";

export const CONFIRM_CARD = {
  title: "Check my guesses",
  confirm: "Confirm",
  edit: "Edit",
  confirmed: "You confirmed this",
  changed: "Changed in your needs",
  seeAll: "See all in your needs",
} as const;

/** The id of a row's words, which take focus after Confirm so focus is not lost with the button. */
function guessRowId(cardId: string, itemId: string): string {
  return `guess-${cardId}-${itemId}`.replace(/[^\w-]/g, "_");
}

export interface ConfirmGuessCardProps {
  card: ConfirmCard;
  /** True while Pica replies: the canvas is locked, so Confirm and Edit wait. */
  locked: boolean;
  /** Confirms a guess through `ws.editCanvas`. Returns whether it landed. */
  onConfirm: (itemId: string) => boolean;
  /** Opens the needs with this guess's form open. */
  onEdit: (itemId: string) => void;
  /** Opens the needs. */
  onSeeAll: () => void;
}

const STATE_WORDS: Record<Exclude<GuessState, "open">, string> = {
  confirmed: CONFIRM_CARD.confirmed,
  changed: CONFIRM_CARD.changed,
};

/**
 * One card per canvas update from Pica: up to three of its guesses, each
 * with Confirm and Edit. A faster road to the needs; the guess is on the
 * canvas either way. Once confirmed, or changed in the needs, a row says so
 * and its buttons go.
 */
export function ConfirmGuessCard({ card, locked, onConfirm, onEdit, onSeeAll }: ConfirmGuessCardProps) {
  const headingId = `guesses-${card.toolCallId}`.replace(/[^\w-]/g, "_");

  function confirm(itemId: string) {
    if (!onConfirm(itemId)) return;
    // The buttons go once the guess is the buyer's; keep focus on the row.
    requestAnimationFrame(() => document.getElementById(guessRowId(card.toolCallId, itemId))?.focus());
  }

  return (
    <Card padding="md" shadow className="flex flex-col gap-3">
      <h3 id={headingId} className="text-body-lg font-semibold text-ink">
        {CONFIRM_CARD.title}
      </h3>
      <ul aria-labelledby={headingId} className="flex flex-col gap-3">
        {card.rows.map(({ item, state }) => (
          <li key={item.id} className="flex flex-col gap-1.5 border-t border-hairline pt-3 first:border-t-0 first:pt-0">
            <p id={guessRowId(card.toolCallId, item.id)} tabIndex={-1} className="break-words text-body text-ink">
              {item.text}
            </p>
            {state === "open" ? (
              <div className="flex flex-wrap items-center gap-2">
                <SourceTag source="inferred" />
                <Button
                  variant="secondary"
                  icon={Check}
                  disabled={locked}
                  aria-label={`${CONFIRM_CARD.confirm} “${item.text}”`}
                  onClick={() => confirm(item.id)}
                >
                  {CONFIRM_CARD.confirm}
                </Button>
                <Button
                  variant="ghost"
                  icon={Pencil}
                  disabled={locked}
                  aria-label={`${CONFIRM_CARD.edit} “${item.text}”`}
                  onClick={() => onEdit(item.id)}
                >
                  {CONFIRM_CARD.edit}
                </Button>
              </div>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-body text-ink-soft">
                {state === "confirmed" ? <Check aria-hidden size={16} className="shrink-0 text-ink" /> : null}
                {STATE_WORDS[state]}
              </p>
            )}
          </li>
        ))}
      </ul>
      {card.more > 0 ? (
        <div>
          <button
            type="button"
            onClick={onSeeAll}
            className="inline-flex min-h-11 items-center rounded-pill px-3 text-body font-medium text-ink underline underline-offset-4"
          >
            {CONFIRM_CARD.seeAll}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
