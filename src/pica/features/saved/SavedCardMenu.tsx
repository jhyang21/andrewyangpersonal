"use client";

import { Ellipsis } from "lucide-react";
import { Button, IconButton } from "@/pica/components/kit";
import { useDisclosure } from "@/pica/features/parts/useDisclosure";
import { SAVED, menuLabel } from "./saved-screen-model";

export interface SavedCardMenuProps {
  /** The card's title, to name the button. */
  title: string;
  /** Opens the remove sheet. */
  onRemove: () => void;
  /** The remove sheet's id, for `aria-controls`. */
  sheetId: string;
  /** Start with the list open. For tests. */
  defaultOpen?: boolean;
}

/**
 * A card's menu: a button that opens a short list holding "Remove". A
 * disclosure, sharing the decision menu's (useDisclosure): Tab, a tap
 * outside or Escape closes the list, and Escape sends focus back to the
 * button.
 */
export function SavedCardMenu({ title, onRemove, sheetId, defaultOpen = false }: SavedCardMenuProps) {
  const { open, setOpen, panelId, root, toggle, onKeyDown, onBlur } = useDisclosure(defaultOpen);

  return (
    <div ref={root} onKeyDown={onKeyDown} onBlur={onBlur} className="relative shrink-0">
      <IconButton
        ref={toggle}
        icon={Ellipsis}
        label={menuLabel(title)}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
      />
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-40 mt-2 w-48 max-w-[calc(100vw-2rem)] rounded-image border border-ink-muted bg-surface p-2 shadow-float"
      >
        <Button
          fullWidth
          aria-haspopup="dialog"
          aria-controls={sheetId}
          onClick={() => {
            // The list hides, so focus the button first: the sheet sends
            // focus back to whatever had it when it opened.
            toggle.current?.focus();
            setOpen(false);
            onRemove();
          }}
        >
          {SAVED.remove}
          <span className="sr-only">: {title}</span>
        </Button>
      </div>
    </div>
  );
}
