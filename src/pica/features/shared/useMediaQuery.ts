"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept up to date. Write the query in rem, as
 * Tailwind's breakpoints are, so script and CSS switch at the same width at
 * any text size. The server renders the narrow layout; the browser switches
 * after hydration. Use it only to choose what to mount; the layout itself
 * follows CSS breakpoints.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const getServerSnapshot = () => false;
