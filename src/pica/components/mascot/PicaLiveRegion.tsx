export interface PicaLiveRegionProps {
  /** What to say. Change it to speak; leave it empty to stay quiet. */
  text: string;
  className?: string;
}

/**
 * A polite live region for Pica's status, hidden on screen. Mount it once,
 * where it stays for the whole screen, and change `text` to speak: a screen
 * reader often misses a region that mounts with its text already in it.
 * A screen that owns this region can pass `announce={false}` to each
 * PicaThinking so the words are said once.
 */
export function PicaLiveRegion({ text, className }: PicaLiveRegionProps) {
  return (
    <span role="status" aria-live="polite" className={["sr-only", className ?? ""].join(" ").trim()}>
      {text}
    </span>
  );
}
