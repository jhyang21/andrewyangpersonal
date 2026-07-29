"use client";

import { COPY } from "@/lib/final-shift/copy";
import type { WallCard as Card } from "@/lib/final-shift/types";

/**
 * A card's tilt, derived from its id.
 *
 * Deterministic on purpose: `Math.random()` would give every card a new angle on every render and a
 * different one on the server than in the browser. Same card, same lean, forever — which is what
 * makes the wall look pinned up rather than shuffled.
 */
export function tiltFor(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  // ±1.5°, in half-degree steps. Beyond about two degrees it stops reading as "hung by hand" and
  // starts reading as broken layout.
  return ((Math.abs(hash) % 7) - 3) * 0.5;
}

type WallCardProps = {
  card: Card;
  index: number;
  /** The temporary marker on the reader's own card. Fades out on its own a few seconds in. */
  marked: boolean;
  onOpen: (card: Card) => void;
};

export function WallCard({ card, index, marked, onOpen }: WallCardProps) {
  const tilt = tiltFor(card.id);

  return (
    <li
      className="mb-5 break-inside-avoid"
      // The stagger reads the index off a custom property, so the delay is CSS and the component
      // stays declarative. Capped in the stylesheet so the last card is never far behind the first.
      style={{ "--fs-i": Math.min(index, 10) } as React.CSSProperties}
    >
      <div className="fs-anim-card-in">
        <div style={{ transform: `rotate(${tilt}deg)` }}>
          <button
            type="button"
            onClick={() => onOpen(card)}
            aria-label={`${COPY.wall.cardOpen} — ${card.firstName}`}
            className="block w-full rounded-[var(--fs-radius)] text-left"
          >
            <div className="bg-[#fffdf8] p-2.5 pb-3 shadow-[0_10px_28px_rgba(0,0,0,0.45)]">
              {card.photo ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- expiring signed URL */}
                  <img
                    src={card.photo.url}
                    alt={`${card.firstName}'s shift photo`}
                    width={card.photo.width}
                    height={card.photo.height}
                    loading="lazy"
                    decoding="async"
                    /*
                     * The committed dimensions go on the element so the browser reserves the box
                     * before the bytes land — without them the whole column reflows as each photo
                     * arrives, which on a phone means the card you were about to tap moves.
                     */
                    className="aspect-[4/5] w-full bg-[var(--fs-ink)] object-cover"
                  />
                  {marked ? (
                    <span className="fs-label absolute left-2 top-2 rounded-[var(--fs-radius)] bg-[var(--fs-red)] px-2 py-1 text-[var(--fs-cream)]">
                      {COPY.wall.youAreHere}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {card.caption ? (
                <p className="mt-3 font-[family-name:var(--font-instrument-serif)] text-[1.0625rem] leading-snug text-[var(--fs-ink)]">
                  {card.caption}
                </p>
              ) : null}

              {/*
               * A memory is never the display serif — the handoff reserves that for heroes and
               * titles, and a guest's own words set in it start looking like decoration.
               */}
              {card.memory ? (
                <p
                  className={`fs-body text-[0.9375rem] text-[var(--fs-ink)] ${
                    card.photo ? "mt-2 line-clamp-3" : "mt-1"
                  }`}
                >
                  {card.memory}
                </p>
              ) : null}

              <p className="fs-label mt-3 text-[var(--fs-muted-on-cream)]">
                {card.firstName}
              </p>

              {marked && !card.photo ? (
                <span className="fs-label mt-2 inline-block rounded-[var(--fs-radius)] bg-[var(--fs-red)] px-2 py-1 text-[var(--fs-cream)]">
                  {COPY.wall.youAreHere}
                </span>
              ) : null}
            </div>
          </button>
        </div>
      </div>
    </li>
  );
}
