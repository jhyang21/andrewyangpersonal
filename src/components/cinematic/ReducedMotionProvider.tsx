"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const ReducedMotionContext = createContext(false);

export function useReducedMotion() {
  return useContext(ReducedMotionContext);
}

export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <ReducedMotionContext.Provider value={reduced}>
      {children}
    </ReducedMotionContext.Provider>
  );
}
