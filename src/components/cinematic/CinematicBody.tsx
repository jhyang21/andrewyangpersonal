"use client";

import { useEffect, type ReactNode } from "react";

export function CinematicBody({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add("cinematic");
    return () => {
      document.body.classList.remove("cinematic");
    };
  }, []);

  return <>{children}</>;
}
