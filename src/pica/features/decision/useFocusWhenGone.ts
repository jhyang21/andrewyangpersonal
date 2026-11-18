"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * True when a card that was shown has gone and took focus with it: focus
 * fell back to the page body. A card closed from another tab leaves focus
 * where the buyer had it.
 */
export function shouldRefocus(wasShown: boolean, shown: boolean, focusLost: boolean): boolean {
  return wasShown && !shown && focusLost;
}

/**
 * When a card such as "Did you buy it?" goes after the buyer answers it,
 * focus would drop to the page body. Move it to `target` instead (give the
 * target `tabIndex={-1}`).
 */
export function useFocusWhenGone(shown: boolean, target: RefObject<HTMLElement | null>) {
  const wasShown = useRef(shown);
  useEffect(() => {
    const active = document.activeElement;
    const focusLost = active === null || active === document.body;
    if (shouldRefocus(wasShown.current, shown, focusLost)) target.current?.focus();
    wasShown.current = shown;
  }, [shown, target]);
}
