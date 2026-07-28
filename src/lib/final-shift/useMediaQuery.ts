"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * MediaQueryList objects are cached per query so that subscribe/getSnapshot stay referentially
 * stable across renders — useSyncExternalStore resubscribes whenever subscribe changes identity, and
 * a fresh matchMedia() call on every render would mean tearing down and rebuilding the listener on
 * every render too.
 */
const cache = new Map<string, MediaQueryList>();

function listFor(query: string): MediaQueryList {
  let mq = cache.get(query);
  if (!mq) {
    mq = window.matchMedia(query);
    cache.set(query, mq);
  }
  return mq;
}

/**
 * Reads a media query as React state.
 *
 * Written as an external-store subscription rather than useState + useEffect, because that is what it
 * is — matchMedia is the store. It also gives a real server snapshot instead of rendering one answer
 * and correcting it a frame after hydration.
 *
 * `serverValue` is the answer to assume before the client can measure. Choose it so the wrong guess
 * degrades safely: assume full motion, assume a fine pointer.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = listFor(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => listFor(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}

/**
 * True when the user asked for reduced motion.
 *
 * final-shift.css already collapses every animation duration under this query, so this is not about
 * appearance — it's about *timing*. Two of the signature motions (the Polaroid develop, the clock-out
 * stamp) hold the flow open in JS while they play, and without reading the preference here those
 * holds would stay in place for a guest who asked for less motion: invisible, but still a delay. The
 * handoff is explicit that navigation must never wait on decoration.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/**
 * True on touch devices.
 *
 * Used for the two places where phone and desktop genuinely need different controls: suppressing the
 * OS keyboard behind the custom numpad, and collapsing the camera/upload pair into one button on
 * desktop, where `capture` is ignored anyway. Assumes a fine pointer on the server, so a desktop
 * visitor never sees a flash of phone-only chrome.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
