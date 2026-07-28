"use client";

import { useRef } from "react";
import { COPY } from "@/lib/final-shift/copy";
import { useCoarsePointer } from "@/lib/final-shift/useMediaQuery";

type PolaroidCaptureProps = {
  onFile: (file: File) => void;
  disabled?: boolean;
  /** Swaps the labels for a retake, where the guest already has a photo. */
  retake?: boolean;
};

/**
 * Camera and upload, both through `<input type="file">`.
 *
 * `capture="user"` hands the whole camera experience to the OS. The alternative, `getUserMedia`, is
 * unusable here for one decisive reason: it is blocked or broken in in-app browsers — Instagram,
 * Facebook, KakaoTalk — and this link will overwhelmingly be opened from a chat app. It would also
 * mean building a camera UI and would strand any guest who denies the permission, which the handoff
 * forbids outright.
 *
 * `capture` is a hint, not a guarantee: desktop browsers ignore it and open the file picker anyway.
 * So on a fine pointer the two buttons would be the same button twice, and they collapse into one.
 */
export function PolaroidCapture({ onFile, disabled, retake }: PolaroidCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const coarse = useCoarsePointer();

  const take = (input: HTMLInputElement | null) => {
    const file = input?.files?.[0];
    if (!file) return;
    onFile(file);
    /*
     * Clear the input's value. Without this, picking the same file twice in a row — which is exactly
     * what "retake, decide the first one was better, pick it again" looks like — fires no change
     * event at all, and the button appears dead.
     */
    if (input) input.value = "";
  };

  const buttonClass =
    "fs-label h-14 w-full rounded-[var(--fs-radius)] border border-[var(--fs-oat)] text-[var(--fs-cream)] active:translate-y-px disabled:opacity-50";

  return (
    <div className="grid gap-3">
      {/*
       * The inputs are hidden and taken out of the tab order; the visible buttons forward the click.
       * The usual sr-only-input-plus-label pattern is worse here — the focus ring would land on an
       * element clipped to one pixel, so a keyboard guest would tab to something they cannot see.
       */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={() => take(cameraRef.current)}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={() => take(uploadRef.current)}
      />

      {coarse ? (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
            className={`${buttonClass} bg-[var(--fs-red)] border-[var(--fs-red)]`}
          >
            {retake ? COPY.photo.retake : COPY.photo.camera}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => uploadRef.current?.click()}
            className={buttonClass}
          >
            {COPY.photo.upload}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => uploadRef.current?.click()}
          className={`${buttonClass} bg-[var(--fs-red)] border-[var(--fs-red)]`}
        >
          {retake ? COPY.photo.retake : COPY.photo.choose}
        </button>
      )}
    </div>
  );
}
