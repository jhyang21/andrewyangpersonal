"use client";

import { useEffect, useState } from "react";
import { Pica, THINKING_LABEL } from "./Pica";
import { PicaLiveRegion } from "./PicaLiveRegion";

export interface PicaThinkingProps {
  /** What the row says, on screen and to a screen reader. Default "Pica is working on it". */
  label?: string;
  /** Pica's size in px. Default 24, the inline size. */
  size?: number;
  /**
   * Whether the row brings its own live region. Default true. Pass false
   * when the screen keeps one PicaLiveRegion mounted and fills it, so the
   * words are said once.
   */
  announce?: boolean;
  className?: string;
}

/**
 * Wait this long after mount before filling the live region. Screen readers
 * often miss text that is already in a region when it appears, so the
 * region mounts empty and gets its text a moment later.
 */
const ANNOUNCE_DELAY_MS = 100;

/**
 * The working row: Pica in the thinking pose (head tilt and blink) beside a
 * short label. By default a polite live region says the label once.
 */
export function PicaThinking({ label = THINKING_LABEL, size = 24, announce = true, className }: PicaThinkingProps) {
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    if (!announce) return;
    const timer = setTimeout(() => setAnnounced(label), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [announce, label]);

  return (
    <div className={["inline-flex items-center gap-2 text-body text-ink", className ?? ""].join(" ").trim()}>
      {/* A live region speaks for Pica, here or on the screen, so the drawing itself stays quiet. */}
      <Pica pose="thinking" size={size} label={null} />
      {/* Hidden only when this row's region says it; otherwise the words are read here. */}
      <span aria-hidden={announce ? "true" : undefined}>{label}</span>
      {announce ? <PicaLiveRegion text={announced} /> : null}
    </div>
  );
}
