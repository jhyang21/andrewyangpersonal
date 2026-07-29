/** Shared types for the Final Shift RSVP experience. */

/**
 * The seven stages from the handoff. `clockIn` and `welcome` sit before the progress indicator;
 * `complete` sits after it. Only the middle four are counted steps.
 */
export type StageId =
  | "clockIn"
  | "welcome"
  | "receipt"
  | "photo"
  | "lastWords"
  | "review"
  | "complete";

/** The four stages that appear in the "RSVP 1 OF 4" indicator, in order. */
export const PROGRESS_STAGES = ["receipt", "photo", "lastWords", "review"] as const;

export type ProgressStage = (typeof PROGRESS_STAGES)[number];

export const STAGE_ORDER: StageId[] = [
  "clockIn",
  "welcome",
  "receipt",
  "photo",
  "lastWords",
  "review",
  "complete",
];

/** Short labels used in the progress indicator and the screen-reader announcement. */
export const STAGE_LABELS: Record<StageId, string> = {
  clockIn: "Clock in",
  welcome: "Welcome",
  receipt: "RSVP",
  photo: "Shift photo",
  lastWords: "Last words",
  review: "Clock out",
  complete: "Shift complete",
};

/** A guest, as the client is allowed to see them. Never carries the private note. */
export type Guest = {
  firstName: string;
  /** The guest's own four-digit number. Shown back to them; never sent to the wall. */
  code: string;
  crewRole: string;
};

export type DateOption = {
  id: string;
  /** ISO 8601. Kept alongside the label so ordering never depends on prose. */
  startsAt: string;
  label: string;
  sublabel?: string;
};

export type EventConfig = {
  eventName: string;
  subtitle: string;
  contactLine: string;
  dateOptions: DateOption[];
  dietaryChips: string[];
  wallEnabled: boolean;
  /** A manual freeze, not a deadline. Flipped by hand when Andrew wants edits closed. */
  editsLocked: boolean;
};

export type SubmissionStatus = "draft" | "submitted";

/**
 * The in-progress timecard. One row per guest — the draft and the submitted record are the same
 * thing, so an edit after clock-out writes in place.
 */
export type Submission = {
  status: SubmissionStatus;
  /** null until the guest chooses. Not defaulted to false: "unanswered" and "no" differ. */
  attending: boolean | null;
  availableDates: string[];
  dietaryTags: string[];
  dietaryNote: string;
  photo: PhotoRef | null;
  caption: string;
  memory: string;
  wallConsent: boolean;
  submittedAt: string | null;
};

export type PhotoRef = {
  /** Storage object path. Server-assigned; the client never chooses it. */
  path: string;
  width: number;
  height: number;
  /** Short-lived signed URL for display. Re-minted server-side on each load. */
  url: string;
};

/** The subset of a submission the guest edits. Everything here round-trips through PATCH /draft. */
export type DraftValues = Pick<
  Submission,
  | "attending"
  | "availableDates"
  | "dietaryTags"
  | "dietaryNote"
  | "caption"
  | "memory"
  | "wallConsent"
>;

export type SessionPayload = {
  guest: Guest;
  submission: Submission;
  event: EventConfig;
};

/** A single card on the farewell wall. Deliberately minimal — see the wall query. */
export type WallCard = {
  id: string;
  firstName: string;
  caption: string | null;
  memory: string | null;
  photo: { url: string; width: number; height: number } | null;
  /** Drives the temporary YOU ARE HERE marker. */
  isMe: boolean;
};

export type PrivateNote = {
  text: string;
  /** True when Andrew wrote no custom note and the name-aware default is standing in. */
  isFallback: boolean;
};

export const LIMITS = {
  caption: 60,
  dietaryNote: 160,
  memory: 180,
} as const;
