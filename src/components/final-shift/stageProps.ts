import type {
  DraftValues,
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
  goTo: (next: StageId, options?: { replace?: boolean }) => void;
  goBack: () => void;
  onIdentified: (payload: SessionPayload) => void;
  onSignOut: () => void;
};
