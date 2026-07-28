"use client";

import { useState } from "react";
import { ErrorNote } from "@/components/final-shift/ErrorNote";
import { StageFrame } from "@/components/final-shift/StageFrame";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";
import { ApiError, submitShift } from "@/lib/final-shift/net";
import type { StageId } from "@/lib/final-shift/types";
import { useReducedMotion } from "@/lib/final-shift/useMediaQuery";

const STAMP_MS = 300;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type Row = {
  label: string;
  /**
   * An array renders as a list. Comma-joining the dates produced "Saturday, August 22, Saturday,
   * September 5", where the separator is indistinguishable from the commas inside each date — and a
   * screen reader reads it as one run-on string.
   */
  value?: string | string[];
  /** Rendered instead of `value`. The shift photo reads back as the photo, not as prose about it. */
  preview?: React.ReactNode;
  editStage: StageId;
  /** Read out with the Edit button so "Edit" alone isn't the whole accessible name. */
  editLabel: string;
};

/**
 * Stage 6 — the timecard, read back.
 *
 * Every row's Edit is a real button with a 44px target, not an inline text link. The handoff draws
 * them as small links, and they're the single densest cluster of controls in the flow; a miss here
 * sends the guest to the wrong stage right before they commit.
 */
export function ReviewStage({
  session,
  values,
  setSubmission,
  setNote,
  goTo,
  goBack,
}: StageProps) {
  const [stamping, setStamping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  if (!session) return null;

  const { event } = session;
  const locked = event.editsLocked;

  const dateLabels = values.availableDates
    // An option id that no longer resolves means Andrew removed that date. Drop it rather than
    // rendering a raw id — the guest never chose a string like "d2", they chose a Saturday.
    .map((id) => event.dateOptions.find((option) => option.id === id)?.label)
    .filter((label): label is string => Boolean(label));

  const rows: Row[] = [
    {
      label: COPY.review.sections.rsvp,
      value: values.attending
        ? COPY.review.values.attending
        : COPY.review.values.notAttending,
      editStage: "receipt",
      editLabel: `Edit ${COPY.review.sections.rsvp}`,
    },
  ];

  if (values.attending) {
    rows.push({
      label: COPY.review.sections.dates,
      value: dateLabels.length ? dateLabels : COPY.review.values.none,
      editStage: "receipt",
      editLabel: `Edit ${COPY.review.sections.dates}`,
    });
  }

  const photo = session.submission.photo;

  rows.push(
    {
      label: COPY.review.sections.dietary,
      value:
        [values.dietaryTags.join(", "), values.dietaryNote]
          .filter(Boolean)
          .join(" — ") || COPY.review.values.none,
      editStage: "receipt",
      editLabel: `Edit ${COPY.review.sections.dietary}`,
    },
    {
      label: COPY.review.sections.photo,
      value: photo ? undefined : COPY.review.values.none,
      preview: photo ? (
        <div className="w-24 bg-[#fffdf8] p-1.5 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- expiring signed URL */}
          <img
            src={photo.url}
            alt="Your shift photo"
            width={photo.width}
            height={photo.height}
            className="aspect-[4/5] w-full object-cover"
          />
        </div>
      ) : undefined,
      editStage: "photo",
      editLabel: `Edit ${COPY.review.sections.photo}`,
    },
    {
      label: COPY.review.sections.caption,
      value: values.caption || COPY.review.values.none,
      editStage: "photo",
      editLabel: `Edit ${COPY.review.sections.caption}`,
    },
    {
      label: COPY.review.sections.memory,
      value: values.memory || COPY.review.values.skipped,
      editStage: "lastWords",
      editLabel: `Edit ${COPY.review.sections.memory}`,
    },
    {
      label: COPY.review.sections.visibility,
      value: values.wallConsent
        ? COPY.review.values.shared
        : COPY.review.values.private,
      editStage: "receipt",
      editLabel: `Edit ${COPY.review.sections.visibility}`,
    },
  );

  /**
   * The punch-out.
   *
   * The values go up with the request rather than being trusted to have arrived by autosave. The
   * last debounced save can still be in flight when the guest taps this, and being told the RSVP is
   * incomplete because of a keystroke that hadn't landed yet would be the flow arguing with
   * something the guest can plainly see on the screen in front of them.
   *
   * The stamp runs alongside the request, so the animation costs nothing.
   */
  const clockOut = async () => {
    if (submitting) return;

    setSubmitting(true);
    setFailure(null);
    if (!reducedMotion) setStamping(true);

    try {
      const [result] = await Promise.all([
        submitShift(values),
        reducedMotion ? Promise.resolve() : wait(STAMP_MS),
      ]);
      setSubmission(result.submission);
      setNote(result.note);
      goTo("complete");
    } catch (error) {
      setStamping(false);
      setSubmitting(false);

      if (error instanceof ApiError && error.code === "incomplete") {
        // The server names the stage each missing answer belongs to, so the guest is taken to the
        // first one rather than left to work out what "something's missing" refers to.
        const first = error.missing[0];
        setFailure(COPY.review.errors.incomplete);
        if (first) goTo(first.stage);
        return;
      }

      if (error instanceof ApiError && error.code === "edits_locked") {
        setFailure(COPY.locked.body);
        return;
      }

      setFailure(
        error instanceof ApiError ? error.message : COPY.review.errors.failed,
      );
    }
  };

  return (
    <StageFrame
      stage="review"
      heading={COPY.review.heading}
      support={COPY.review.support}
      onBack={goBack}
      action={
        <div>
          {failure ? (
            <div className="mb-3">
              <ErrorNote id="fs-review-error">{failure}</ErrorNote>
            </div>
          ) : null}
          <p className="fs-meta mb-3 text-[var(--fs-muted-on-espresso)]">
            {locked ? COPY.review.confirmationLocked : COPY.review.confirmation}
          </p>
          <button
            type="button"
            onClick={clockOut}
            disabled={submitting}
            aria-describedby={failure ? "fs-review-error" : undefined}
            className={`fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)] active:translate-y-px disabled:opacity-70 ${
              stamping ? "fs-anim-stamp" : ""
            }`}
          >
            {submitting ? COPY.review.submitting : COPY.review.cta}
          </button>
        </div>
      }
    >
      <dl className="divide-y divide-[var(--fs-line)] border-y border-[var(--fs-line)]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 py-4">
            <div className="min-w-0 flex-1">
              <dt className="fs-label text-[var(--fs-muted-on-espresso)]">{row.label}</dt>
              <dd className="fs-body mt-1 break-words text-[var(--fs-cream)]">
                {row.preview ? (
                  row.preview
                ) : Array.isArray(row.value) ? (
                  <ul className="space-y-1">
                    {row.value.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  row.value
                )}
              </dd>
            </div>
            {locked ? null : (
              <button
                type="button"
                onClick={() => goTo(row.editStage)}
                aria-label={row.editLabel}
                className="fs-label -mr-2 flex min-h-11 shrink-0 items-center rounded-[var(--fs-radius)] px-2 text-[var(--fs-oat)] underline underline-offset-4"
              >
                {COPY.review.edit}
              </button>
            )}
          </div>
        ))}
      </dl>

      {locked ? (
        <p className="fs-body mt-6 border-l-2 border-[var(--fs-line)] pl-4 text-[var(--fs-oat)]">
          <span className="fs-label block text-[var(--fs-muted-on-espresso)]">
            {COPY.locked.badge}
          </span>
          <span className="mt-2 block">{COPY.locked.body}</span>
        </p>
      ) : null}
    </StageFrame>
  );
}
