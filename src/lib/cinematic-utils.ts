import type { ThesisState } from "@/types/cinematic";

export function stateToVisualClass(state: ThesisState): string {
  switch (state) {
    case "stable":
      return "cinematic-glow";
    case "evolving":
      return "cinematic-pulse";
    case "contradicted":
      return "cinematic-blur";
    case "emerging":
      return "cinematic-shimmer";
  }
}

export function stateLabel(state: ThesisState): string {
  switch (state) {
    case "stable":
      return "Stable";
    case "evolving":
      return "Evolving";
    case "contradicted":
      return "Contradicted";
    case "emerging":
      return "Emerging";
  }
}

export function stateColor(state: ThesisState): string {
  switch (state) {
    case "stable":
      return "var(--color-accent)";
    case "evolving":
      return "#c084fc";
    case "contradicted":
      return "var(--color-contradiction)";
    case "emerging":
      return "#fbbf24";
  }
}

/** Split a body string into sentences for crossfade transitions. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Given a scroll progress (0-1) and a number of versions,
 * returns the current version index and the interpolation factor
 * within the transition zone.
 *
 * Returns { index, transitionProgress } where:
 * - index: the version index currently displayed
 * - transitionProgress: 0 means fully showing current version,
 *   0-1 means in transition zone toward next version
 */
export function getVersionAtScroll(
  scrollProgress: number,
  versionCount: number,
  transitionZone: number = 0.05
): { index: number; transitionProgress: number } {
  if (versionCount <= 1) return { index: 0, transitionProgress: 0 };

  const segmentSize = 1 / versionCount;
  const rawIndex = scrollProgress / segmentSize;
  const index = Math.min(Math.floor(rawIndex), versionCount - 1);

  // How far into this segment are we (0-1)
  const segmentProgress = (scrollProgress - index * segmentSize) / segmentSize;

  // Transition zone is at the end of each segment
  const transitionStart = 1 - transitionZone * 2;

  if (segmentProgress > transitionStart && index < versionCount - 1) {
    const transitionProgress =
      (segmentProgress - transitionStart) / (1 - transitionStart);
    return { index, transitionProgress: Math.min(transitionProgress, 1) };
  }

  return { index, transitionProgress: 0 };
}
