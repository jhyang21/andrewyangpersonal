import type {
  DraftValues,
  PhotoRef,
  SessionPayload,
  StageId,
} from "@/lib/final-shift/types";

/**
 * What every stage receives from the machine.
 *
 * This lives in its own file rather than beside ShiftMachine so the stages can import the type
 * without importing the machine that renders them — no import cycle, and no chance of a stage
 * accidentally reaching into machine internals.
 */
export type StageProps = {
  session: SessionPayload | null;
  values: DraftValues;
  update: (patch: Partial<DraftValues>) => void;
  /**
   * The approved photo, held above the stages.
   *
   * It is not part of DraftValues on purpose. The caption is a draft value and the photo is not, so
   * a retake or a failed upload physically cannot disturb the caption — which is the handoff's rule
   * about preserving the caption draft, enforced by the shape of the state rather than by care.
   */
  setPhoto: (photo: PhotoRef | null) => void;
  goTo: (next: StageId, options?: { replace?: boolean }) => void;
  goBack: () => void;
  onIdentified: (payload: SessionPayload) => void;
  onSignOut: () => void;
};
