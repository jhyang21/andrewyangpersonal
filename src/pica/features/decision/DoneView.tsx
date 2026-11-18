"use client";

import { useRef, type ReactNode } from "react";
import { Button, Card } from "@/pica/components/kit";
import { Pica } from "@/pica/components/mascot";
import type { DecisionSession } from "@/pica/lib/types";
import { DeclineReasons, JourneyPath, StorageNotice } from "@/pica/features/parts";
import { ConfidenceCheck } from "./ConfidenceCheck";
import { DONE, doneLinks, donePose, outcomeLine } from "./done-screen-model";
import type { useDone } from "./useDone";
import { useFocusWhenGone } from "./useFocusWhenGone";

export interface DoneViewProps {
  session: DecisionSession;
  done: ReturnType<typeof useDone>;
  /** "Did you buy it?", from the screen. Tests pass their own. */
  returnCheck: ReactNode;
}

/**
 * Done: the outcome in one line, the reasons after not buying, the
 * confidence check, then the way on. Bought and not buying look the same:
 * the same pose, the same size, no celebration.
 */
export function DoneView({ session, done, returnCheck }: DoneViewProps) {
  const outcome = useRef<HTMLHeadingElement>(null);
  // Answering "Did you buy it?" removes the card: put focus on the outcome that replaces it.
  useFocusWhenGone(done.askBought, outcome);
  const { status, product } = done;

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4 px-4 pb-12 pt-3">
      <StorageNotice />
      <JourneyPath session={session} current={null} />
      <h1 className="break-words text-heading font-semibold text-ink">{session.title}</h1>

      {done.askBought ? (
        returnCheck
      ) : (
        <section className="flex flex-col items-center gap-3 py-4 text-center">
          <Pica pose={donePose(status)} size={120} />
          <h2 ref={outcome} tabIndex={-1} className="break-words text-display font-semibold text-ink outline-none">
            {outcomeLine(status, product)}
          </h2>
          {status === "declined" ? <p className="text-body-lg text-ink">{DONE.notBuying}</p> : null}
          {status === "open" ? <p className="text-body-lg text-ink">{DONE.stillOpen}</p> : null}
        </section>
      )}

      {done.showReasons ? (
        <Card>
          <DeclineReasons current={done.reason} onPick={done.pickReason} />
        </Card>
      ) : null}

      {status === "bought" && !done.askBought ? (
        <Card as="section" className="flex flex-col gap-2">
          <h2 className="text-body-lg font-semibold text-ink">{DONE.checkInHeading}</h2>
          <p className="text-body text-ink">{DONE.checkIn}</p>
          <p className="text-body text-ink-muted">{DONE.orders}</p>
        </Card>
      ) : null}

      {done.showConfidence ? <ConfidenceCheck session={session} /> : null}

      <nav aria-label="Where next" className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
        {doneLinks(session.id).map((link) => (
          <Button key={link.href} href={link.href} size="lg" on="canvas" className="sm:flex-1">
            {link.label}
          </Button>
        ))}
      </nav>
    </main>
  );
}
