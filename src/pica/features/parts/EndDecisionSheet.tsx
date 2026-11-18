"use client";

import { Button, Sheet } from "@/pica/components/kit";

/** The sheet's words, from the brief (section 6.6). */
export const END_SHEET = {
  title: "End this decision without buying?",
  description: "You can reopen it later from Saved. Your needs and options stay with it.",
  confirm: "End without buying",
  cancel: "Keep deciding",
} as const;

export interface EndDecisionSheetProps {
  open: boolean;
  /** "Keep deciding", Escape, the close button or a tap outside. Set `open` to false. */
  onClose: () => void;
  /**
   * "End without buying". The screen ends the decision here, for example
   * with `ws.decline` or `endWithoutBuying`, which sends `no_purchase_decided`.
   * The sheet sends nothing itself.
   */
  onConfirm: () => void;
  /** The <dialog>'s id, for `aria-controls` on what opens it. */
  id?: string;
}

/**
 * Asks once before a decision ends without buying. Both buttons are the same
 * size, one above the other: ending is a real answer, so it gets the same
 * care as going on. No reasons here; Done asks for those, once.
 */
export function EndDecisionSheet({ open, onClose, onConfirm, id }: EndDecisionSheetProps) {
  return (
    <Sheet
      id={id}
      open={open}
      onClose={onClose}
      title={END_SHEET.title}
      description={END_SHEET.description}
      footer={
        <div className="flex flex-col gap-3">
          <Button variant="primary" size="lg" fullWidth onClick={onConfirm}>
            {END_SHEET.confirm}
          </Button>
          <Button size="lg" fullWidth onClick={onClose}>
            {END_SHEET.cancel}
          </Button>
        </div>
      }
    >
      {null}
    </Sheet>
  );
}
