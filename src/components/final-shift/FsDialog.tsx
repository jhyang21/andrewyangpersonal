"use client";

import { useEffect, useRef } from "react";
import { COPY } from "@/lib/final-shift/copy";

type FsDialogProps = {
  open: boolean;
  onClose: () => void;
  /** id of the element naming the dialog. */
  labelledBy: string;
  closeLabel?: string;
  children: React.ReactNode;
};

/**
 * A native `<dialog>`, opened with `showModal()`.
 *
 * Everything a hand-built modal has to reimplement comes free and correct here: the focus trap, Esc
 * to dismiss, `::backdrop`, inerting the rest of the page, and — the one most often missed — putting
 * focus back on the control that opened it. Zero dependencies and less code than a wrong version of
 * the same thing.
 */
export function FsDialog({
  open,
  onClose,
  labelledBy,
  closeLabel = COPY.wall.cardClose,
  children,
}: FsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      // Fires for Esc as well as for close(), so the parent's state can never drift out of step
      // with what is actually on screen.
      onClose={onClose}
      onClick={(event) => {
        // A click that lands on the dialog element itself landed on the backdrop — the content sits
        // in the inner div, so anything inside it stops here.
        if (event.target === ref.current) onClose();
      }}
      className="fs-dialog"
    >
      <div className="fs-dialog-panel">
        {children}
        <button
          type="button"
          onClick={onClose}
          className="fs-label mt-6 min-h-11 w-full rounded-[var(--fs-radius)] border border-[var(--fs-line)] text-[var(--fs-cream)]"
        >
          {closeLabel}
        </button>
      </div>
    </dialog>
  );
}
