"use client";

import { useId } from "react";
import { FsDialog } from "@/components/final-shift/FsDialog";
import { COPY } from "@/lib/final-shift/copy";
import type { PrivateNote } from "@/lib/final-shift/types";

type PrivateNoteDialogProps = {
  open: boolean;
  onClose: () => void;
  firstName: string;
  /** Blank on any visit after the one where they typed it. Masked rather than missing. */
  code: string;
  note: PrivateNote | null;
  loading: boolean;
  error: string | null;
};

/**
 * Andrew's note to one person, as a receipt.
 *
 * Nothing distinguishes a note Andrew wrote from the name-aware default. The `isFallback` flag comes
 * back from the server for Andrew's own coverage check, and using it here to say "this one is
 * generic" would be a cruelty the flag exists to help him avoid, not to perform.
 */
export function PrivateNoteDialog({
  open,
  onClose,
  firstName,
  code,
  note,
  loading,
  error,
}: PrivateNoteDialogProps) {
  const headingId = useId();

  return (
    <FsDialog
      open={open}
      onClose={onClose}
      labelledBy={headingId}
      closeLabel={COPY.note.dismiss}
    >
      <p className="fs-label text-[var(--fs-red)]">{COPY.note.privateBadge}</p>
      <h2 id={headingId} className="fs-title mt-2 text-[var(--fs-cream)]">
        {COPY.note.heading}
      </h2>

      <dl className="mt-6 divide-y divide-[var(--fs-line)] border-y border-[var(--fs-line)]">
        <div className="flex justify-between gap-4 py-3">
          <dt className="fs-label text-[var(--fs-muted-on-espresso)]">
            {COPY.note.forLabel}
          </dt>
          <dd className="fs-meta text-[var(--fs-cream)]">{firstName}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="fs-label text-[var(--fs-muted-on-espresso)]">
            {COPY.note.employeeLabel}
          </dt>
          <dd className="fs-meta text-[var(--fs-cream)]">
            {code || <span aria-label="Hidden">••••</span>}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="fs-label text-[var(--fs-muted-on-espresso)]">
            {COPY.note.fromLabel}
          </dt>
          <dd className="fs-meta text-[var(--fs-cream)]">{COPY.note.from}</dd>
        </div>
      </dl>

      <p className="fs-label mt-6 text-[var(--fs-muted-on-espresso)]">
        {COPY.note.messageLabel}
      </p>

      {/*
       * aria-live, because the note arrives after the dialog opens. Without it a screen-reader user
       * is left on an empty panel with no announcement when the text lands.
       */}
      <div aria-live="polite" className="mt-2 min-h-24">
        {error ? (
          <p className="fs-body text-[var(--fs-cream)]">{error}</p>
        ) : loading || !note ? (
          <p className="fs-meta text-[var(--fs-muted-on-espresso)]">…</p>
        ) : (
          <p className="font-[family-name:var(--font-instrument-serif)] text-[1.375rem] leading-snug text-[var(--fs-cream)]">
            {note.text}
          </p>
        )}
      </div>
    </FsDialog>
  );
}
