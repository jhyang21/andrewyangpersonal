import type { WorkspaceState } from "./useWorkspace";

/**
 * What the Options and Compare stages read from the workspace. The frame
 * passes its whole `WorkspaceState`; the preview page builds just these.
 */
export type StageWorkspace = Pick<
  WorkspaceState,
  | "session"
  | "busy"
  | "picks"
  | "pickLimits"
  | "picksLocked"
  | "togglePick"
  | "openEvidence"
  | "send"
  | "editCanvas"
  | "decline"
> & {
  /** "Go to chat" in an empty stage: Chat, with focus on the composer, as "Open chat". */
  goToChat: () => void;
};

export interface StageProps {
  ws: StageWorkspace;
  /** True while this stage is on screen. Views and price checks count only then. */
  active: boolean;
  /** The evidence sheet's id, for `aria-controls` on "See the evidence". Only where the page has that sheet. */
  evidenceSheetId?: string;
}
