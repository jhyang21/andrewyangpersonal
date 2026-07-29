type PolaroidFrameProps = {
  /** The image well. Fills a fixed 4:5 area so the frame never resizes as photos swap. */
  children: React.ReactNode;
  /** The white writing margin under the image: caption field on stage 4, caption text on the wall. */
  footer?: React.ReactNode;
  /** Small ± tilt, in degrees. Off by default; the wall seeds it per card. */
  tilt?: number;
  className?: string;
};

/**
 * The white Polaroid frame.
 *
 * The caption lives inside this frame rather than under it, because the handoff wants the guest to
 * see themselves completing one artifact — photo and words on the same piece of paper — not filling
 * a form field that happens to sit near a picture.
 *
 * The image well is a fixed 4:5 box with the photo covering it. A guest shooting 9:16 on a phone and
 * one uploading a 4:3 from a camera roll must produce the same shaped object, or the wall becomes a
 * ragged mess and this stage jumps as the preview loads. `object-cover` crops rather than letterboxes
 * — and the guest sees the crop in preview before approving, which is the handoff's rule about never
 * cropping faces without preview.
 */
export function PolaroidFrame({ children, footer, tilt, className = "" }: PolaroidFrameProps) {
  return (
    <div
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
      className={`mx-auto w-full max-w-[20rem] bg-[#fffdf8] p-3 pb-4 shadow-[0_10px_30px_rgba(0,0,0,0.45)] ${className}`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--fs-ink)]">
        {children}
      </div>
      {footer ? <div className="px-1 pt-3">{footer}</div> : null}
    </div>
  );
}
