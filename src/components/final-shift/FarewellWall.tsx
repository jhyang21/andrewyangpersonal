"use client";

import { useEffect, useRef, useState } from "react";
import { PrivateNoteDialog } from "@/components/final-shift/PrivateNoteDialog";
import { WallCard } from "@/components/final-shift/WallCard";
import { WallCardDialog } from "@/components/final-shift/WallCardDialog";
import { COPY } from "@/lib/final-shift/copy";
import { fetchNote, fetchWall } from "@/lib/final-shift/net";
import type { PrivateNote, WallCard as Card } from "@/lib/final-shift/types";

/** How long the reader's own card wears its marker before the wall settles into being everyone's. */
const MARKER_MS = 4200;

/**
 * Signed photo URLs last fifteen minutes.
 *
 * A guest who leaves the wall open, goes back to the group chat, and returns half an hour later
 * would otherwise scroll into a column of broken images. Coming back to the tab after ten minutes
 * re-fetches, which re-signs everything.
 */
const REFRESH_AFTER_MS = 10 * 60 * 1000;

type FarewellWallProps = {
  firstName: string;
  /** Blank except on the visit where the guest typed it. The dialog masks an absent one. */
  code: string;
  enabled: boolean;
  hasSubmitted: boolean;
  initialCards: Card[];
};

export function FarewellWall({
  firstName,
  code,
  enabled,
  hasSubmitted,
  initialCards,
}: FarewellWallProps) {
  const [cards, setCards] = useState(initialCards);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [marked, setMarked] = useState(true);

  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState<PrivateNote | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const loadedAt = useRef(Date.now());

  useEffect(() => {
    const timer = window.setTimeout(() => setMarked(false), MARKER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - loadedAt.current < REFRESH_AFTER_MS) return;
      try {
        const next = await fetchWall();
        loadedAt.current = Date.now();
        setCards(next.cards);
      } catch {
        // Leave what is on screen. A failed refresh is not worth replacing a wall the guest is
        // already reading with an error.
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  /*
   * The note is fetched when it is asked for, not when the page loads.
   *
   * It is one person's private message and this link gets opened on borrowed phones — putting it in
   * the HTML of every wall load would mean it was on screen, in memory, and in the network tab for
   * everyone who never opened the dialog at all.
   */
  const openNote = async () => {
    setNoteOpen(true);
    if (note || noteLoading) return;

    setNoteLoading(true);
    setNoteError(null);
    try {
      setNote(await fetchNote());
    } catch {
      setNoteError(COPY.wall.unavailable);
    } finally {
      setNoteLoading(false);
    }
  };

  const mine = cards.some((card) => card.isMe);
  const soloCard = cards.length === 1 && cards[0].isMe;

  const ghost =
    "fs-label flex min-h-11 items-center justify-center rounded-[var(--fs-radius)] border border-[var(--fs-line)] px-4 text-[var(--fs-cream)]";

  return (
    <main className="fs-stage fs-stage-wide">
      <header>
        <p className="fs-label text-[var(--fs-muted-on-espresso)]">
          {COPY.event.mark}
        </p>
        <h1 className="fs-title mt-2 text-[var(--fs-cream)]">
          {COPY.wall.heading}
        </h1>
        <p className="fs-body mt-2 text-[var(--fs-oat)]">{COPY.wall.subheading}</p>

        {/*
         * Both controls sit at the top rather than the foot of the page. The wall scrolls, and a
         * guest who wants to reread their own note should not have to travel past everyone else's
         * to find the button.
         */}
        <div className="mt-5 flex flex-wrap gap-3">
          {hasSubmitted ? (
            <button type="button" onClick={openNote} className={ghost}>
              {COPY.wall.myNote}
            </button>
          ) : null}
          <a href="/final-shift" className={ghost}>
            {COPY.wall.myRsvp}
          </a>
        </div>
      </header>

      <div className="mt-8">
        {!enabled ? (
          <p className="fs-body text-[var(--fs-oat)]">{COPY.wall.unavailable}</p>
        ) : cards.length === 0 ? (
          /*
           * The common case at this group size, not an edge case — the first two or three guests
           * through will all see this, right after the ceremony that led them here.
           */
          <p className="fs-body max-w-md text-[var(--fs-oat)]">
            {mine ? COPY.wall.empty : COPY.wall.emptyNoContribution}
          </p>
        ) : (
          <>
            <ul className="fs-wall-grid list-none p-0">
              {cards.map((card, index) => (
                <WallCard
                  key={card.id}
                  card={card}
                  index={index}
                  marked={marked && card.isMe}
                  onOpen={setOpenCard}
                />
              ))}
            </ul>

            {soloCard ? (
              <p className="fs-body mt-2 max-w-md text-[var(--fs-oat)]">
                {COPY.wall.empty}
              </p>
            ) : null}
          </>
        )}
      </div>

      <WallCardDialog card={openCard} onClose={() => setOpenCard(null)} />
      <PrivateNoteDialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        firstName={firstName}
        code={code}
        note={note}
        loading={noteLoading}
        error={noteError}
      />
    </main>
  );
}
