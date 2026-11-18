import type { DecisionSession } from "@/pica/lib/types";
import type { StageWorkspace } from "@/pica/features/workspace/stage-workspace";

/**
 * A stand-in for the workspace, for the preview page and the stage tests.
 * Nothing in it sends a message, writes the store or sends analytics; each
 * action does what `over` says, or nothing.
 */
export function previewWorkspace(session: DecisionSession, over: Partial<StageWorkspace> = {}): StageWorkspace {
  return {
    session,
    busy: false,
    picks: session.comparison?.productIds ?? [],
    pickLimits: { min: 2, max: 5 },
    picksLocked: false,
    togglePick: () => undefined,
    openEvidence: () => undefined,
    send: () => true,
    goToChat: () => undefined,
    editCanvas: () => true,
    decline: () => undefined,
    ...over,
  };
}
