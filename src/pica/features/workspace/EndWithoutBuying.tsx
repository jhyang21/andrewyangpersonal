"use client";

import { useState } from "react";
import { Button } from "@/pica/components/kit";
import { DECISION_MENU, EndDecisionSheet } from "@/pica/features/parts";

export interface EndWithoutBuyingProps {
  /** The sheet's id. Each stage gives its own, so two never share one. */
  sheetId: string;
  /** Ends the decision, such as `ws.decline`, which sends `no_purchase_decided` and goes to Done. */
  onConfirm: () => void;
  fullWidth?: boolean;
}

/**
 * "End without buying" at the foot of a stage: a plain secondary button on
 * the grey canvas that asks once in a sheet, as the header menu does.
 */
export function EndWithoutBuying({ sheetId, onConfirm, fullWidth = false }: EndWithoutBuyingProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button on="canvas" fullWidth={fullWidth} aria-haspopup="dialog" aria-controls={sheetId} onClick={() => setOpen(true)}>
        {DECISION_MENU.end}
      </Button>
      <EndDecisionSheet
        id={sheetId}
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      />
    </>
  );
}
