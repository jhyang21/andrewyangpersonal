"use client";

import { useId } from "react";
import { FsDialog } from "@/components/final-shift/FsDialog";
import type { WallCard } from "@/lib/final-shift/types";

type WallCardDialogProps = {
  card: WallCard | null;
  onClose: () => void;
};

/**
 * One card, in full.
 *
 * The grid clamps a long memory to three lines so the columns stay readable; this is where the rest
 * of it lives. The photo is the same file at the same 1400px — there is no second rendition — so it
 * loads instantly from cache rather than fetching anything new.
 */
export function WallCardDialog({ card, onClose }: WallCardDialogProps) {
  const headingId = useId();

  return (
    <FsDialog open={card !== null} onClose={onClose} labelledBy={headingId}>
      {card ? (
        <>
          {card.photo ? (
            <div className="bg-[#fffdf8] p-3 pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- expiring signed URL */}
              <img
                src={card.photo.url}
                alt={`${card.firstName}'s shift photo`}
                width={card.photo.width}
                height={card.photo.height}
                decoding="async"
                className="aspect-[4/5] w-full bg-[var(--fs-ink)] object-cover"
              />
              {card.caption ? (
                <p className="mt-3 font-[family-name:var(--font-instrument-serif)] text-[1.25rem] leading-snug text-[var(--fs-ink)]">
                  {card.caption}
                </p>
              ) : null}
            </div>
          ) : null}

          {card.memory ? (
            <p className="fs-body mt-5 text-[var(--fs-cream)]">{card.memory}</p>
          ) : null}

          {/*
           * The name is the dialog's accessible name. It is the only thing on a card that identifies
           * anyone, which is why it is also the last thing rendered rather than a header — the photo
           * and the words are what the guest came to read.
           */}
          <h2 id={headingId} className="fs-label mt-5 text-[var(--fs-oat)]">
            {card.firstName}
          </h2>
        </>
      ) : null}
    </FsDialog>
  );
}
