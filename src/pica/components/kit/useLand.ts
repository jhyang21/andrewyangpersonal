"use client";

import { useEffect, useRef } from "react";
import "./kit.css";

export type LandMotion = "kit-land" | "kit-lift";

/**
 * Plays a "lands" motion on the returned element each time `value` changes,
 * never on the first render, and never under reduced motion. The element
 * keeps its identity, so focus inside it is not lost. Use `inline-block` or
 * `block` on inline elements, since transforms skip plain inline boxes.
 *
 * With `enabled` false, changes are noted but nothing plays, so a value that
 * loads in after the first render (empty, then filled) does not move. A
 * change in the same render that turns `enabled` on does not play either.
 */
export function useLand<T extends HTMLElement>(
  value: unknown,
  motion: LandMotion = "kit-land",
  enabled = true,
) {
  const ref = useRef<T>(null);
  const prev = useRef(value);
  const wasEnabled = useRef(enabled);

  useEffect(() => {
    const armed = enabled && wasEnabled.current;
    wasEnabled.current = enabled;
    if (Object.is(prev.current, value)) return;
    prev.current = value;
    if (!armed) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Restart the animation: drop the class, force a layout, add it back.
    el.classList.remove(motion);
    void el.offsetWidth;
    el.classList.add(motion);
    // No cleanup: the listener runs once and only drops the class, so it is
    // safe after a re-render, and the class never lingers.
    el.addEventListener("animationend", () => el.classList.remove(motion), { once: true });
  }, [value, motion, enabled]);

  return ref;
}
