"use client";

import { useState } from "react";
import { CharCountField } from "@/components/final-shift/CharCountField";
import { CheckCard } from "@/components/final-shift/CheckCard";
import { ChipGroup } from "@/components/final-shift/ChipGroup";
import { ErrorNote } from "@/components/final-shift/ErrorNote";
import { RadioCard } from "@/components/final-shift/RadioCard";
import { StageFrame } from "@/components/final-shift/StageFrame";
import { VenueBlock } from "@/components/final-shift/VenueBlock";
import type { StageProps } from "@/components/final-shift/stageProps";
import { COPY } from "@/lib/final-shift/copy";
import { LIMITS } from "@/lib/final-shift/types";

/**
 * Stage 3 — the RSVP receipt.
 *
 * Two things here are load-bearing beyond what they look like.
 *
 * The date list is *removed* when the guest can't come, not hidden with CSS. A `display: none`
 * fieldset is still in the accessibility tree in some combinations and still submits; removing it is
 * the only version where "which dates can you work" genuinely isn't asked of someone who already
 * said they can't come.
 *
 * But their previously-chosen dates stay in machine state. Yes → No → Yes brings them back, because
 * a guest reconsidering shouldn't be punished by having to re-enter what they already told us. The
 * server ignores availableDates when attending is false, so nothing stale is ever recorded.
 */
export function ReceiptStage({ session, values, update, goTo, goBack }: StageProps) {
  const [showErrors, setShowErrors] = useState(false);
  if (!session) return null;

  const { event } = session;
  const attending = values.attending;
  const needsDate = attending === true && values.availableDates.length === 0;
  // Scoped to a guest who's coming, because the field itself is. An over-long note left behind by
  // someone who has since changed their answer must not block a screen that no longer shows it.
  const dietaryTooLong =
    attending === true && values.dietaryNote.length > LIMITS.dietaryNote;

  const toggleDate = (id: string) => {
    const next = values.availableDates.includes(id)
      ? values.availableDates.filter((d) => d !== id)
      : [...values.availableDates, id];
    update({ availableDates: next });
  };

  const toggleTag = (tag: string) => {
    const next = values.dietaryTags.includes(tag)
      ? values.dietaryTags.filter((t) => t !== tag)
      : [...values.dietaryTags, tag];
    update({ dietaryTags: next });
  };

  const advance = () => {
    if (attending === null || needsDate || dietaryTooLong) {
      setShowErrors(true);
      return;
    }
    goTo("photo");
  };

  return (
    <StageFrame
      stage="receipt"
      heading={COPY.receipt.heading}
      onBack={goBack}
      action={
        <button
          type="button"
          onClick={advance}
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)] active:translate-y-px"
        >
          {COPY.receipt.cta}
        </button>
      }
    >
      <div className="fs-anim-unfurl space-y-8">
        {/*
         * Above the question, not inside the attending branch. A guest can't honestly answer "can
         * you come" without knowing where — so the decliner sees this too, unlike the dates and the
         * dietary note below.
         */}
        <VenueBlock event={event} />

        <fieldset>
          <legend className="fs-sr-only">{COPY.receipt.heading}</legend>
          <div className="space-y-3">
            <RadioCard
              name="fs-attending"
              checked={attending === true}
              onSelect={() => {
                update({ attending: true });
                setShowErrors(false);
              }}
              label={COPY.receipt.yes}
              support={COPY.receipt.yesSupport}
            />
            <RadioCard
              name="fs-attending"
              checked={attending === false}
              onSelect={() => {
                update({ attending: false });
                setShowErrors(false);
              }}
              label={COPY.receipt.no}
              support={COPY.receipt.noSupport}
            />
          </div>
          {showErrors && attending === null ? (
            <ErrorNote>{COPY.receipt.errors.noAttendance}</ErrorNote>
          ) : null}
        </fieldset>

        {/*
         * Declining is not an error state. The guest still has a photo and a memory to leave, and
         * this line is what keeps the next screen from feeling like a consolation prize.
         */}
        {attending === false ? (
          <p className="fs-body border-l-2 border-[var(--fs-green-on-espresso)] pl-4 text-[var(--fs-oat)]">
            {COPY.receipt.declineNote}
          </p>
        ) : null}

        {attending === true ? (
          <fieldset>
            <legend className="fs-label text-[var(--fs-oat)]">
              {COPY.receipt.datePrompt}
            </legend>
            <p className="fs-meta mt-1 text-[var(--fs-muted-on-espresso)]">
              {COPY.receipt.dateSupport}
            </p>
            <div className="mt-3 space-y-3">
              {event.dateOptions.map((option) => (
                <CheckCard
                  key={option.id}
                  checked={values.availableDates.includes(option.id)}
                  onToggle={() => toggleDate(option.id)}
                  label={option.label}
                  support={option.sublabel}
                />
              ))}
            </div>
            {showErrors && needsDate ? (
              <ErrorNote>{COPY.receipt.errors.noDate}</ErrorNote>
            ) : null}
          </fieldset>
        ) : null}

        {/*
         * Food is only asked of someone who is coming — the same rule as the dates, and for the
         * same reason. Asking a guest who has just said they can't make it what they'd like to eat
         * is the form not listening. Their answers survive in machine state if they change their
         * mind, and the server ignores them while attending is false.
         */}
        {attending === true ? (
          <div className="space-y-4">
            <ChipGroup
              legend={COPY.receipt.dietaryLabel}
              support={COPY.receipt.dietarySupport}
              options={event.dietaryChips}
              selected={values.dietaryTags}
              onToggle={toggleTag}
            />
            <CharCountField
              label={COPY.review.sections.dietary}
              value={values.dietaryNote}
              onChange={(dietaryNote) => update({ dietaryNote })}
              limit={LIMITS.dietaryNote}
              rows={2}
              placeholder={COPY.receipt.dietaryPlaceholder}
              error={
                showErrors && dietaryTooLong ? COPY.receipt.errors.longDietary : null
              }
            />
          </div>
        ) : null}

        {event.wallEnabled ? (
          <div className="border-t border-[var(--fs-line)] pt-6">
            <CheckCard
              variant="plain"
              checked={values.wallConsent}
              onToggle={(wallConsent) => update({ wallConsent })}
              label={COPY.receipt.consentLabel}
              support={COPY.receipt.consentSupport}
            />
          </div>
        ) : null}
      </div>
    </StageFrame>
  );
}
