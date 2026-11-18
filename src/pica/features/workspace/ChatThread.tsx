"use client";

import Link from "next/link";
import { PicaAvatar } from "@/pica/components/mascot";
import { cn } from "@/pica/components/kit";
import type { Canvas } from "@/pica/lib/types";
import { confirmCard } from "./chat-model";
import { ConfirmGuessCard } from "./ConfirmGuessCard";
import { viewHref } from "./frame-model";
import { QuestionCard } from "./QuestionCard";
import { NOTE_LINKS, type ThreadRow } from "./thread-model";

export interface ChatThreadProps {
  sessionId: string;
  rows: readonly ThreadRow[];
  /**
   * The row "Open chat" sends focus to (`newestReplyStart`). It gets this id
   * and `tabIndex={-1}`: focus by script, no new tab stop.
   */
  focusIndex?: number;
  focusId?: string;
  /** The canvas now, for where each guess stands. */
  canvas: Canvas;
  /** True while Pica replies: the canvas is locked, so guesses wait. */
  busy: boolean;
  /** Whether a question takes answers now (`questionLive`). */
  isLive: (toolCallId: string) => boolean;
  onAnswer: (text: string, index: number) => void;
  onSkip: () => void;
  onConfirm: (itemId: string) => boolean;
  /** Opens the needs; with an id, that need's form. */
  onOpenNeeds: (itemId?: string) => void;
}

const NOTE_LINK =
  "inline-flex min-h-11 items-center rounded-pill px-2 font-medium text-ink underline underline-offset-4";

function PicaBubble({ text, unsure = false }: { text: string; unsure?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <PicaAvatar pose={unsure ? "unsure" : "idle"} size={40} />
      <p className="min-w-0 flex-1 whitespace-pre-line break-words rounded-image bg-surface px-4 py-3 text-body-lg text-ink">
        <span className="sr-only">Pica said: </span>
        {text}
      </p>
    </div>
  );
}

/**
 * The conversation's rows: the buyer's and Pica's bubbles, small centred
 * notes for what Pica did, confirm cards for its guesses, and question
 * cards. Each note is a status line with its link inside, never on the link.
 */
export function ChatThread({
  sessionId,
  rows,
  focusIndex,
  focusId,
  canvas,
  busy,
  isLive,
  onAnswer,
  onSkip,
  onConfirm,
  onOpenNeeds,
}: ChatThreadProps) {
  function render(row: ThreadRow) {
    switch (row.kind) {
      case "user":
        return (
          <div className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-line break-words rounded-image bg-purple-tint px-4 py-3 text-body-lg text-ink">
              <span className="sr-only">You said: </span>
              {row.text}
            </p>
          </div>
        );
      case "pica":
        return <PicaBubble text={row.text} />;
      case "problem":
        return <PicaBubble text={row.text} unsure />;
      case "note":
        return (
          <div role="status" className="flex flex-wrap items-center justify-center gap-x-1 text-center text-caption text-ink-soft">
            <span className="py-1">{row.text}</span>
            <Link href={viewHref(sessionId, row.target)} scroll={false} className={NOTE_LINK}>
              {NOTE_LINKS[row.target]}
            </Link>
          </div>
        );
      case "confirm": {
        const card = confirmCard(row.update, canvas);
        if (!card) return null;
        return (
          <ConfirmGuessCard
            card={card}
            locked={busy}
            onConfirm={onConfirm}
            onEdit={onOpenNeeds}
            onSeeAll={() => onOpenNeeds()}
          />
        );
      }
      case "question":
        return (
          <QuestionCard
            id={row.toolCallId}
            question={row.question}
            number={row.number}
            state={row.state}
            live={isLive(row.toolCallId)}
            onAnswer={onAnswer}
            onSkip={onSkip}
            onOpenNeeds={() => onOpenNeeds()}
          />
        );
    }
  }

  return (
    <ol aria-label="Conversation" className="flex flex-col gap-3">
      {rows.map((row, index) => {
        const target = index === focusIndex;
        return (
          <li
            key={row.key}
            id={target ? focusId : undefined}
            tabIndex={target ? -1 : undefined}
            // The margin keeps the row clear of the sticky strip when it scrolls to the top.
            className={cn(target && "scroll-mt-20")}
          >
            {render(row)}
          </li>
        );
      })}
    </ol>
  );
}
