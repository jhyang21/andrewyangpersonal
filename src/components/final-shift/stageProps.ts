import type {
  DraftValues,
  PhotoRef,
  PrivateNote,
  SessionPayload,
  StageId,
  Submission,
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
  /**
   * Andrew's note to this guest. Held in memory only — never localStorage, never a cookie.
   *
   * Null until the guest clocks out (the submit returns it) or asks for it again on a later visit.
   * This link is opened on borrowed phones; closing the tab has to be enough to be rid of it.
   */
  note: PrivateNote | null;
  update: (patch: Partial<DraftValues>) => void;
  /**
   * The approved photo, held above the stages.
   *
   * It is not part of DraftValues on purpose. The caption is a draft value and the photo is not, so
   * a retake or a failed upload physically cannot disturb the caption — which is the handoff's rule
   * about preserving the caption draft, enforced by the shape of the state rather than by care.
   */
  setPhoto: (photo: PhotoRef | null) => void;
  /** Takes the row the server saved, so status and submittedAt come from the database, not a guess. */
  setSubmission: (submission: Submission) => void;
  setNote: (note: PrivateNote | null) => void;
  goTo: (next: StageId, options?: { replace?: boolean }) => void;
  goBack: () => void;
  onIdentified: (payload: SessionPayload) => void;
  onSignOut: () => void;
};
