"use client";

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

/**
 * A button that shows and hides a short list: the decision menu and a saved
 * card's menu. Not an ARIA menu: Tab moves through the list, and tabbing
 * out, a tap outside or Escape closes it. Escape sends focus back to the
 * button. Put `root`, `onKeyDown` and `onBlur` on the box around both, `toggle`
 * on the button and `panelId` on the list.
 */
export function useDisclosure(defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation();
    setOpen(false);
    toggle.current?.focus();
  }

  // Tab past the last item closes the list. A blur with no new focus (a
  // click on plain page, or Safari not focusing clicked buttons) is left to
  // the pointerdown listener, so a click inside the list still lands.
  function onBlur(e: FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null;
    if (open && next && !root.current?.contains(next)) setOpen(false);
  }

  return { open, setOpen, panelId, root, toggle, onKeyDown, onBlur };
}
