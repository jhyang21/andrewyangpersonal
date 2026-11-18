"use client";

import { Ellipsis } from "lucide-react";
import { useId, useState } from "react";
import { Button, IconButton } from "@/pica/components/kit";
import type { DecisionSession } from "@/pica/lib/types";
import { DECISION_MENU, decisionMenuActions, hasMenu } from "./decision-menu-model";
import { EndDecisionSheet } from "./EndDecisionSheet";
import { useDisclosure } from "./useDisclosure";

export interface DecisionMenuProps {
  /** The decision on screen. Only its needs and status are read. */
  session: Pick<DecisionSession, "canvas" | "decision">;
  /** "Save for later". The caller saves (`saveForLater` sends `session_saved`) and moves on. */
  onSave: () => void;
  /**
   * Called once the buyer confirms "End without buying" in the sheet. The
   * caller ends the decision (`endWithoutBuying` sends `no_purchase_decided`).
   */
  onEnd: () => void;
  /** Start with the list open. For the parts page. */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * The header menu inside a decision: a button that opens a short list with
 * "Save for later" and "End without buying". Ending asks first, in
 * EndDecisionSheet. Renders nothing until the decision has a need.
 *
 * It is a disclosure, not an ARIA menu: Tab moves through the two buttons,
 * and tabbing out, a tap outside or Escape closes the list. Escape sends
 * focus back to the button.
 */
export function DecisionMenu({ session, onSave, onEnd, defaultOpen = false, className }: DecisionMenuProps) {
  const { open, setOpen, panelId, root, toggle, onKeyDown, onBlur } = useDisclosure(defaultOpen);
  const [confirming, setConfirming] = useState(false);
  const sheetId = useId();
  const actions = decisionMenuActions(session);

  if (!hasMenu(actions)) return null;

  return (
    <div ref={root} onKeyDown={onKeyDown} onBlur={onBlur} className={["relative", className ?? ""].join(" ").trim()}>
      <IconButton
        ref={toggle}
        icon={Ellipsis}
        label={DECISION_MENU.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
      />
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-image border border-ink-muted bg-surface p-2 shadow-float"
      >
        <ul className="flex flex-col gap-2">
          {actions.save ? (
            <li>
              <Button
                fullWidth
                onClick={() => {
                  setOpen(false);
                  onSave();
                }}
              >
                {DECISION_MENU.save}
              </Button>
            </li>
          ) : null}
          {actions.end ? (
            <li>
              <Button
                fullWidth
                aria-haspopup="dialog"
                aria-controls={sheetId}
                onClick={() => {
                  // The list hides, so focus the toggle first: the sheet
                  // sends focus back to whatever had it when it opened.
                  toggle.current?.focus();
                  setOpen(false);
                  setConfirming(true);
                }}
              >
                {DECISION_MENU.end}
              </Button>
            </li>
          ) : null}
        </ul>
      </div>
      <EndDecisionSheet
        id={sheetId}
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onEnd();
        }}
      />
    </div>
  );
}
