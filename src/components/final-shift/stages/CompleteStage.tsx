"use client";

import { useState } from "react";
import { PrivateNoteDialog } from "@/components/final-shift/PrivateNoteDialog";
import { StageFrame } from "@/components/final-shift/StageFrame";
import { VenueBlock } from "@/components/final-shift/VenueBlock";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";
import { fetchNote } from "@/lib/final-shift/net";

/**
 * Stage 7 — clocked out.
 *
 * No Back here on purpose. Returning to the review screen after the stamp has fired would undo the
 * one moment the whole flow is built around; editing is a forward move from this screen instead.
 */
export function CompleteStage({ session, note, setNote, goTo }: StageProps) {
  const submitted = session?.submission.status === "submitted";
  const returning = submitted && note === null;
  /*
   * The one case where this screen isn't a farewell: edits are frozen and this guest never clocked
   * out. There is no stamp to show, no note to read — /note refuses an unsubmitted guest, and
   * rightly — and nothing to edit. What's left is the truth and Andrew's phone number.
   */
  const shutOut = Boolean(session?.event.editsLocked) && !submitted;

  /*
   * Opens on arrival when the note came back with the submit — that is the beat the ceremony has
   * been building to, and making the guest tap for it would be an anticlimax.
   *
   * Initialised from a prop rather than set in an effect: the stage mounts fresh on every
   * transition, and the submit sets the note before it navigates, so the answer is already known at
   * first render. A returning guest arrives with no note and an unopened dialog, which is right —
   * they have read it, and it should not ambush them on a shared screen.
   */
  const [noteOpen, setNoteOpen] = useState(note !== null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  const locked = session.event.editsLocked;

  const openNote = async () => {
    setNoteOpen(true);
    if (note || loading) return;

    setLoading(true);
    setError(null);
    try {
      setNote(await fetchNote());
    } catch {
      setError(COPY.wall.unavailable);
    } finally {
      setLoading(false);
    }
  };

  const ghost =
    "fs-label flex min-h-11 items-center justify-center rounded-[var(--fs-radius)] border border-[var(--fs-line)] px-4 text-[var(--fs-cream)]";

  return (
    <StageFrame
      stage="complete"
      heading={
        shutOut
          ? COPY.locked.heading
          : returning
            ? COPY.complete.backHeadline
            : COPY.complete.headline
      }
      support={
        shutOut
          ? COPY.locked.support
          : returning
            ? COPY.complete.backSupport
            : COPY.complete.support
      }
      action={
        <a
          href="/final-shift/wall"
          className="fs-label flex h-14 w-full items-center justify-center rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)]"
        >
          {COPY.complete.cta}
        </a>
      }
    >
      {shutOut ? null : (
        /*
         * The stamp sits on a cream chip rather than straight on the espresso. It's truer to the
         * metaphor — ink goes on paper — and it's the only way clock green reads at all here, since
         * on the dark background it measures 2.8:1.
         */
        <p className="fs-anim-stamp fs-label inline-block rotate-[var(--fs-stamp-rotate)] rounded-[var(--fs-radius)] border-2 border-[var(--fs-green)] bg-[var(--fs-cream)] px-3 py-2 text-[var(--fs-green)]">
          {COPY.complete.stamp}
        </p>
      )}

      {/*
       * Outside the shutOut guard, unlike everything else on this screen. Edits being frozen is not
       * the same as not being invited — the copy that branch shows says "it's not too late to be
       * there" — and inviting someone while withholding the address would be the screen arguing
       * with itself. This is also the screen a guest reopens the night of the party.
       */}
      <VenueBlock event={session.event} className="mt-8" />

      {shutOut ? null : (
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={openNote} className={ghost}>
            {COPY.complete.myNote}
          </button>
          {locked ? null : (
            <button type="button" onClick={() => goTo("receipt")} className={ghost}>
              {COPY.complete.edit}
            </button>
          )}
        </div>
      )}

      {locked ? (
        <p className="fs-body mt-6 border-l-2 border-[var(--fs-line)] pl-4 text-[var(--fs-oat)]">
          <span className="fs-label block text-[var(--fs-muted-on-espresso)]">
            {COPY.locked.badge}
          </span>
          <span className="mt-2 block">
            {shutOut ? session.event.contactLine : COPY.locked.body}
          </span>
        </p>
      ) : null}

      <PrivateNoteDialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        firstName={session.guest.firstName}
        code={session.guest.code}
        note={note}
        loading={loading}
        error={error}
      />
    </StageFrame>
  );
}
