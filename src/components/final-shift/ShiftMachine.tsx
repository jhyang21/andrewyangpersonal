"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StageProps } from "@/components/final-shift/stageProps";
import { ClockInStage } from "@/components/final-shift/stages/ClockInStage";
import { CompleteStage } from "@/components/final-shift/stages/CompleteStage";
import { LastWordsStage } from "@/components/final-shift/stages/LastWordsStage";
import { PhotoStage } from "@/components/final-shift/stages/PhotoStage";
import { ReceiptStage } from "@/components/final-shift/stages/ReceiptStage";
import { ReviewStage } from "@/components/final-shift/stages/ReviewStage";
import { WelcomeStage } from "@/components/final-shift/stages/WelcomeStage";
import { saveDraft, signOut } from "@/lib/final-shift/net";
import {
  STAGE_ORDER,
  type DraftValues,
  type PhotoRef,
  type PrivateNote,
  type SessionPayload,
  type StageId,
  type Submission,
} from "@/lib/final-shift/types";

const DRAFT_KEY = "fs:draft:v1";
const HASH_PREFIX = "#";

/**
 * How long the guest has to stop typing before the draft goes to the server.
 *
 * Long enough that a sentence is one write rather than forty, short enough that closing the tab
 * mid-thought loses nothing worth having. The submit carries the final values regardless, so this
 * only ever protects against abandonment.
 */
const AUTOSAVE_MS = 800;

type ShiftMachineProps = {
  /** Present when the cookie identified a guest server-side, so the keypad never flashes. */
  initialSession: SessionPayload | null;
};

type StoredDraft = {
  code: string;
  stage: StageId;
  values: DraftValues;
  updatedAt: number;
};

function emptyValues(): DraftValues {
  return {
    attending: null,
    availableDates: [],
    dietaryTags: [],
    dietaryNote: "",
    caption: "",
    memory: "",
    wallConsent: false,
  };
}

function valuesFrom(submission: Submission): DraftValues {
  return {
    attending: submission.attending,
    availableDates: submission.availableDates,
    dietaryTags: submission.dietaryTags,
    dietaryNote: submission.dietaryNote,
    caption: submission.caption,
    memory: submission.memory,
    wallConsent: submission.wallConsent,
  };
}

function stageFromHash(hash: string): StageId | null {
  const raw = hash.replace(HASH_PREFIX, "");
  return (STAGE_ORDER as string[]).includes(raw) ? (raw as StageId) : null;
}

/**
 * How far into the flow the guest is allowed to be, given what they've filled in.
 *
 * This exists because the stage lives in the URL hash, so anyone can type `#review` — and a
 * returning guest's Forward button can point at a stage their current answers no longer support.
 * Rather than trusting the hash, we clamp it to the furthest legitimately reachable stage.
 */
function furthestReachable(values: DraftValues, submission: Submission): StageId {
  if (submission.status === "submitted") return "complete";
  if (values.attending === null) return "receipt";
  if (values.attending === true && values.availableDates.length === 0) return "receipt";
  if (!submission.photo || !values.caption.trim()) return "photo";
  return "review";
}

function clampStage(
  requested: StageId,
  values: DraftValues,
  submission: Submission,
): StageId {
  // The identity stages are always available; they're behind the session, not behind progress.
  if (requested === "clockIn" || requested === "welcome") return requested;

  const limit = furthestReachable(values, submission);
  const requestedIndex = STAGE_ORDER.indexOf(requested);
  const limitIndex = STAGE_ORDER.indexOf(limit);
  return requestedIndex > limitIndex ? limit : requested;
}

/**
 * The whole RSVP flow, mounted once.
 *
 * Stages are held in memory and mirrored into the URL hash via the History API. Next's App Router
 * ignores hash-only changes, so advancing a stage triggers no navigation, no remount, and no server
 * render — which means in-progress values (including the decoded photo blob and the caption draft)
 * survive Back and Forward for free, because they never leave memory. That's what the handoff's
 * "preserve completed entries when moving backward" asks for, without a persistence round-trip on
 * every step.
 *
 * The two alternatives were both worse. Routed sub-paths would unmount the stage on every
 * transition and destroy exactly the state we need to keep. A plain useState index would ignore the
 * URL entirely, which on Android means the hardware Back button leaves the site and loses
 * everything — disqualifying for a link that is opened on a phone.
 */
export function ShiftMachine({ initialSession }: ShiftMachineProps) {
  const [session, setSession] = useState<SessionPayload | null>(initialSession);
  const [values, setValues] = useState<DraftValues>(() =>
    initialSession ? valuesFrom(initialSession.submission) : emptyValues(),
  );
  const [stage, setStage] = useState<StageId>(() => {
    if (!initialSession) return "clockIn";
    return initialSession.submission.status === "submitted" ? "complete" : "welcome";
  });

  /*
   * The private note lives here, not in a stage, and it is never written to localStorage.
   *
   * It is a personal message to one named person, and this link gets opened on borrowed and shared
   * phones. Holding it in memory means closing the tab is enough to be rid of it; the /note route
   * hands it back on the next visit, behind the cookie.
   */
  const [note, setNote] = useState<PrivateNote | null>(null);

  /** The last values known to be on the server, so an idle autosave doesn't write them again. */
  const lastSaved = useRef<string | null>(null);

  /*
   * Seed the first history entry with a stage so the very first Back has something to return to,
   * and so a refresh mid-flow lands on the right screen. replaceState, not pushState: we're
   * labelling the entry the guest is already on, not creating a new one.
   */
  useEffect(() => {
    const fromHash = stageFromHash(window.location.hash);
    const initial = fromHash ?? stage;
    const clamped = session
      ? clampStage(initial, values, session.submission)
      : "clockIn";

    if (clamped !== stage) setStage(clamped);
    window.history.replaceState({ fsStage: clamped }, "", `${HASH_PREFIX}${clamped}`);
    // Intentionally mount-only: this establishes the baseline entry, nothing more.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const fromEntry = (event.state as { fsStage?: StageId } | null)?.fsStage ?? null;
      const target = fromEntry ?? stageFromHash(window.location.hash);

      // No stage anywhere means this isn't one of our entries — leave it alone rather than trapping
      // the guest on the page.
      if (!target) return;
      if (!session) {
        setStage("clockIn");
        return;
      }

      /*
       * Trust our own history entries; clamp anything else.
       *
       * An entry carrying `fsStage` was written by goTo, which only ever runs after a stage let the
       * guest move on — so going Back to it is always legitimate, and re-checking would be wrong:
       * mid-flow the answers ahead of you are by definition incomplete, and clamping would drag a
       * guest reviewing their earlier steps forward again. A bare hash with no state is someone
       * typing `#review` into the address bar, and that does get checked.
       */
      const allowed = fromEntry
        ? target
        : clampStage(target, values, session.submission);

      setStage(allowed);

      // If we refused the requested stage, correct the URL to match. Leaving `#review` in the
      // address bar while showing the RSVP would make the next reload or Back reason off a hash
      // that was never true.
      if (allowed !== target) {
        window.history.replaceState({ fsStage: allowed }, "", `${HASH_PREFIX}${allowed}`);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [session, values]);

  const goTo = useCallback(
    (next: StageId, options?: { replace?: boolean }) => {
      setStage(next);
      const url = `${HASH_PREFIX}${next}`;
      if (options?.replace) {
        window.history.replaceState({ fsStage: next }, "", url);
      } else {
        window.history.pushState({ fsStage: next }, "", url);
      }
    },
    [],
  );

  const goBack = useCallback(() => {
    // Defer to real browser history so Back-the-button and Back-the-gesture behave identically.
    window.history.back();
  }, []);

  /*
   * localStorage is a crash mirror, not the source of truth — the server draft row is. It exists to
   * survive a mid-stage refresh or an offline blip. It never holds photo bytes (quota) and never
   * holds the private note (it must not persist on a shared device).
   */
  useEffect(() => {
    if (!session) return;
    const payload: StoredDraft = {
      code: session.guest.code,
      stage,
      values,
      updatedAt: Date.now(),
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // Private mode, or quota. The server draft still has it; nothing to tell the guest.
    }
  }, [session, stage, values]);

  /*
   * Autosave, debounced.
   *
   * The first pass after a session appears records a baseline and writes nothing — those values came
   * *from* the server, and echoing them straight back is a round trip that can only lose. After that
   * every settled change goes up.
   *
   * Failures are swallowed inside saveDraft. This is a background save the guest never asked for, so
   * interrupting them to report one would be the feature complaining about its own housekeeping; the
   * values stay in memory and in the localStorage mirror, and the submit carries them regardless.
   */
  useEffect(() => {
    if (!session || session.event.editsLocked) return;

    const serialised = JSON.stringify(values);
    if (lastSaved.current === null) {
      lastSaved.current = serialised;
      return;
    }
    if (lastSaved.current === serialised) return;

    const timer = window.setTimeout(() => {
      lastSaved.current = serialised;
      void saveDraft(values);
    }, AUTOSAVE_MS);

    return () => window.clearTimeout(timer);
  }, [session, values]);

  const clearLocalDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing to do.
    }
  }, []);

  /**
   * Merges a partial update. Never clears unrelated fields — which is what makes the handoff's
   * "switching Yes to No and back retains the dates" behaviour free. Do not add clearing logic here
   * later thinking it's tidier; the retention is deliberate.
   */
  const update = useCallback((patch: Partial<DraftValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  }, []);

  /**
   * Records the approved photo, and releases the one it replaces.
   *
   * The photo lives up here rather than in PhotoStage because every stage is keyed on `stage` and
   * remounts on each transition — a photo held inside the stage would not survive a trip back to the
   * receipt. The revoke matters on retakes: each prepared photo holds an object URL over a few
   * hundred KB of decoded JPEG, and a guest who retakes five times would otherwise pin all five for
   * the life of the document.
   */
  const setPhoto = useCallback(
    (photo: PhotoRef | null) => {
      const previous = session?.submission.photo ?? null;
      if (previous && previous.url !== photo?.url && previous.url.startsWith("blob:")) {
        URL.revokeObjectURL(previous.url);
      }
      setSession((current) =>
        current ? { ...current, submission: { ...current.submission, photo } } : current,
      );
    },
    [session],
  );

  /** Replaces the stored submission wholesale — used by the submit, which returns the saved row. */
  const setSubmission = useCallback((submission: Submission) => {
    setSession((current) => (current ? { ...current, submission } : current));
  }, []);

  const onIdentified = useCallback(
    (payload: SessionPayload) => {
      // Cleared so the autosave takes a fresh baseline from this guest's own row rather than
      // treating the previous occupant's answers as unsaved changes.
      lastSaved.current = null;
      setSession(payload);
      setValues(valuesFrom(payload.submission));
      setNote(null);
      goTo(payload.submission.status === "submitted" ? "complete" : "welcome");
    },
    [goTo],
  );

  const onSignOut = useCallback(() => {
    // Fire and forget: the cookie is expired server-side, but the guest must not wait on a round
    // trip to stop seeing someone else's name.
    void signOut();
    lastSaved.current = null;
    setSession(null);
    setValues(emptyValues());
    setNote(null);
    clearLocalDraft();
    goTo("clockIn", { replace: true });
  }, [clearLocalDraft, goTo]);

  const stageProps: StageProps = {
    session,
    values,
    note,
    update,
    setPhoto,
    setSubmission,
    setNote,
    goTo,
    goBack,
    onIdentified,
    onSignOut,
  };

  /*
   * Keyed on the stage so each screen mounts fresh and its entry animation plays. That's safe only
   * because nothing worth keeping lives inside a stage — every value the guest has entered is held
   * here, above the remount.
   */
  return (
    <div key={stage} className="fs-anim-stage-in">
      {renderStage(stage, stageProps)}
    </div>
  );
}

function renderStage(stage: StageId, props: StageProps) {
  // A guest who has no session can only be at the timeclock, whatever the hash claims.
  if (!props.session) return <ClockInStage {...props} />;

  switch (stage) {
    case "clockIn":
      return <ClockInStage {...props} />;
    case "welcome":
      return <WelcomeStage {...props} />;
    case "receipt":
      return <ReceiptStage {...props} />;
    case "photo":
      return <PhotoStage {...props} />;
    case "lastWords":
      return <LastWordsStage {...props} />;
    case "review":
      return <ReviewStage {...props} />;
    case "complete":
      return <CompleteStage {...props} />;
  }
}
