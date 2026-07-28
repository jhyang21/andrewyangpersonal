"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

let mediaQuery: MediaQueryList | null = null;

function query(): MediaQueryList {
  mediaQuery ??= window.matchMedia(QUERY);
  return mediaQuery;
}

function subscribe(onChange: () => void): () => void {
  const mq = query();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Tracks the user's motion preference.
 *
 * final-shift.css already collapses every animation duration under this media query, so this hook
 * is not about appearance — it's about *timing*. Two of the signature motions (the Polaroid
 * develop, the clock-out stamp) hold the flow open in JS while they play. Without reading the
 * preference here, those holds would remain in place for a guest who asked for reduced motion:
 * invisible, but still a delay. The handoff is explicit that navigation must never wait on
 * decoration.
 *
 * Written as an external-store subscription rather than useState + useEffect, which is what it
 * actually is — matchMedia is the store. That also gives a real server snapshot instead of a first
 * paint that assumes full motion and corrects itself a frame later.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query().matches,
    // The server can't know the preference. Assume full motion; the client corrects on hydration.
    () => false,
  );
}
