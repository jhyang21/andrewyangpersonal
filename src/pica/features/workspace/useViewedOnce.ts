"use client";

import { useEffect, useEffectEvent } from "react";

/** Keys already counted on this page load, per event. */
const seen = new Set<string>();

/**
 * Calls `onFirstView` the first time `key` is on screen in this page load.
 * Pass a null key while the thing is hidden or missing. `event` keeps the
 * keys of different events apart.
 */
export function useViewedOnce(event: string, key: string | null, onFirstView: () => void) {
  const fire = useEffectEvent(onFirstView);
  useEffect(() => {
    if (key === null) return;
    const id = `${event}|${key}`;
    if (seen.has(id)) return;
    seen.add(id);
    fire();
  }, [event, key]);
}
