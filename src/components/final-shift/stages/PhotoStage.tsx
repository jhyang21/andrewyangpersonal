"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ErrorNote } from "@/components/final-shift/ErrorNote";
import { PolaroidCapture } from "@/components/final-shift/PolaroidCapture";
import { PolaroidFrame } from "@/components/final-shift/PolaroidFrame";
import { StageFrame } from "@/components/final-shift/StageFrame";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";
import { PhotoError, preparePhoto, type PreparedPhoto } from "@/lib/final-shift/image";
import { LIMITS } from "@/lib/final-shift/types";
import { uploadPhoto } from "@/lib/final-shift/upload";
import { useReducedMotion } from "@/lib/final-shift/useMediaQuery";

type Busy = "preparing" | "uploading" | null;

/** Which recovery buttons the error offers. A decode failure and a dropped upload need different ones. */
type Failure = { message: string; kind: "input" | "upload" } | null;

function messageFor(error: unknown): string {
  if (error instanceof PhotoError) {
    // encodeFailed is a canvas problem, not the guest's, but "try a different photo" is still the
    // only useful thing to say — so it borrows the decode copy rather than inventing jargon.
    return error.kind === "tooLarge"
      ? COPY.photo.errors.tooLarge
      : COPY.photo.errors.decodeFailed;
  }
  return COPY.photo.errors.decodeFailed;
}

/**
 * Stage 4 — the required Polaroid. No skip, by design.
 *
 * The caption is not held here. It lives in the machine's draft values, so a retake, a failed
 * upload, or a trip back to the receipt cannot touch it — the handoff's "preserve the caption draft"
 * rule enforced by where the state sits rather than by remembering to be careful. The photo is held
 * above this component for the same reason: every stage remounts on transition.
 */
export function PhotoStage({ session, values, update, setPhoto, goTo, goBack }: StageProps) {
  const [pending, setPending] = useState<PreparedPhoto | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<Failure>(null);
  const [flashing, setFlashing] = useState(false);
  const [developing, setDeveloping] = useState(false);
  const [captionTouched, setCaptionTouched] = useState(false);
  const reducedMotion = useReducedMotion();
  const captionId = useId();

  /*
   * Release an unapproved photo's object URL when the stage goes away. An approved one is not ours
   * to revoke — it belongs to the machine, which releases it when a later photo replaces it.
   */
  const pendingRef = useRef<PreparedPhoto | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(
    () => () => {
      if (pendingRef.current) URL.revokeObjectURL(pendingRef.current.previewUrl);
    },
    [],
  );

  if (!session) return null;

  const photo = session.submission.photo;
  const caption = values.caption;
  const captionOver = caption.length > LIMITS.caption;
  const captionMissing = !caption.trim();

  const replacePending = (next: PreparedPhoto | null) => {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(next);
  };

  const onFile = async (file: File) => {
    setFailure(null);
    setBusy("preparing");
    try {
      const prepared = await preparePhoto(file);
      replacePending(prepared);
    } catch (error) {
      setFailure({ message: messageFor(error), kind: "input" });
    } finally {
      setBusy(null);
    }
  };

  const approve = async (prepared: PreparedPhoto) => {
    setFailure(null);
    setProgress(0);
    setBusy("uploading");
    if (!reducedMotion) setFlashing(true);

    try {
      const ref = await uploadPhoto(prepared, { onProgress: setProgress });
      setPhoto(ref);
      // The machine owns the object URL from here; dropping `pending` must not revoke it.
      setPending(null);
      if (!reducedMotion) setDeveloping(true);
    } catch {
      setFailure({ message: COPY.photo.errors.uploadFailed, kind: "upload" });
    } finally {
      setBusy(null);
    }
  };

  const onContinue = () => {
    setCaptionTouched(true);
    if (captionMissing || captionOver) return;
    goTo("lastWords");
  };

  const captionError = captionTouched
    ? captionMissing
      ? COPY.photo.errors.noCaption
      : captionOver
        ? COPY.photo.errors.longCaption
        : null
    : null;

  const ghostButton =
    "fs-label h-12 w-full rounded-[var(--fs-radius)] border border-[var(--fs-oat)] text-[var(--fs-cream)] active:translate-y-px disabled:opacity-50";
  const primaryButton =
    "fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)] active:translate-y-px disabled:opacity-60";

  return (
    <StageFrame
      stage="photo"
      heading={COPY.photo.heading}
      support={COPY.photo.support}
      onBack={goBack}
      action={
        <div className="grid gap-3">
          {photo ? (
            <>
              <button type="button" onClick={onContinue} className={primaryButton}>
                {COPY.photo.cta}
              </button>
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className={ghostButton}
              >
                {COPY.photo.retake}
              </button>
            </>
          ) : pending ? (
            <>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => approve(pending)}
                className={primaryButton}
              >
                {busy === "uploading" ? COPY.photo.uploading : COPY.photo.approve}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => replacePending(null)}
                className={ghostButton}
              >
                {COPY.photo.retake}
              </button>
            </>
          ) : (
            /*
             * No Continue at all until a photo is approved. The handoff asks for Continue to be
             * unavailable, and a greyed-out button that explains nothing is worse than a screen
             * whose only forward routes are the two that actually work.
             */
            <PolaroidCapture onFile={onFile} disabled={busy !== null} />
          )}
        </div>
      }
    >
      {/* The shutter. Fixed, over everything, and gone the moment it finishes. */}
      {flashing ? (
        <div
          aria-hidden="true"
          onAnimationEnd={() => setFlashing(false)}
          className="fs-anim-flash pointer-events-none fixed inset-0 z-50 bg-[var(--fs-cream)]"
        />
      ) : null}

      <PolaroidFrame
        footer={
          photo ? (
            <div>
              <label
                htmlFor={captionId}
                className="fs-label block text-[var(--fs-muted-on-cream)]"
              >
                {COPY.photo.captionLabel}
              </label>
              {/*
               * No maxLength: it swallows keystrokes at the boundary and truncates a paste without
               * saying so. The counter turns red and Continue refuses instead, and the server
               * re-checks the same limit.
               */}
              <input
                id={captionId}
                type="text"
                value={caption}
                onChange={(event) => update({ caption: event.target.value })}
                placeholder={COPY.photo.captionPlaceholder}
                aria-invalid={captionOver || Boolean(captionError)}
                aria-describedby={[
                  `${captionId}-count`,
                  captionError ? `${captionId}-error` : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                /* min-h-11 = 44px. A 16px input on its own sits at 30, under the target-size floor. */
                className="mt-1 min-h-11 w-full border-b border-[var(--fs-steel)] bg-transparent pb-2 font-[family-name:var(--font-instrument-serif)] text-[var(--fs-ink)] placeholder:text-[var(--fs-muted-on-cream)]"
              />
              <p
                id={`${captionId}-count`}
                className={`fs-meta mt-1 text-right ${
                  captionOver ? "text-[var(--fs-red)]" : "text-[var(--fs-muted-on-cream)]"
                }`}
              >
                {captionOver
                  ? `${caption.length - LIMITS.caption} over the ${LIMITS.caption} limit`
                  : `${caption.length} / ${LIMITS.caption}`}
              </p>
            </div>
          ) : null
        }
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed, already-sized, expiring URL */}
            <img
              src={photo.url}
              alt="Your shift photo"
              width={photo.width}
              height={photo.height}
              className={`h-full w-full object-cover ${developing ? "fs-anim-develop" : ""}`}
            />
            {developing ? (
              <div
                aria-hidden="true"
                onAnimationEnd={() => setDeveloping(false)}
                className="fs-anim-develop-veil pointer-events-none absolute inset-0 bg-[var(--fs-cream)]"
              />
            ) : null}
          </>
        ) : pending ? (
          /* eslint-disable-next-line @next/next/no-img-element -- local object URL */
          <img
            src={pending.previewUrl}
            alt="The photo you just chose"
            width={pending.width}
            height={pending.height}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center">
            <p className="fs-meta text-[var(--fs-muted-on-espresso)]">
              {busy === "preparing" ? COPY.photo.preparing : COPY.photo.placeholder}
            </p>
          </div>
        )}
      </PolaroidFrame>

      {busy === "uploading" ? (
        <div className="mt-5">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Uploading your photo"
            className="h-1 w-full overflow-hidden rounded-full bg-[var(--fs-line)]"
          >
            <div
              className="h-full bg-[var(--fs-oat)] transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {failure ? (
        <>
          <ErrorNote>{failure.message}</ErrorNote>
          {failure.kind === "upload" && pending ? (
            <button
              type="button"
              onClick={() => approve(pending)}
              className="fs-label mt-3 min-h-11 rounded-[var(--fs-radius)] px-2 text-[var(--fs-oat)] underline underline-offset-4"
            >
              {COPY.photo.tryAgain}
            </button>
          ) : null}
        </>
      ) : null}

      {captionError ? (
        <ErrorNote id={`${captionId}-error`}>{captionError}</ErrorNote>
      ) : null}

      {/*
       * Say plainly where this ends up, on the screen where the guest makes the thing — not only on
       * the checkbox two stages back where they agreed to it.
       */}
      <p className="fs-meta mt-6 text-[var(--fs-muted-on-espresso)]">
        {values.wallConsent ? COPY.photo.consentPublic : COPY.photo.consentPrivate}
      </p>
    </StageFrame>
  );
}
