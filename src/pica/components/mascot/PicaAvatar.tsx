import { Pica, detailFor, type PicaPose } from "./Pica";
import { POSES, inkOffset } from "./poses";

export interface PicaAvatarProps {
  pose?: PicaPose;
  /** Diameter in px. Default 40, the chat size. */
  size?: AvatarSize;
  className?: string;
}

export type AvatarSize = 32 | 40;

/**
 * The bird's square, as a share of the circle's diameter. With each pose's
 * ink centred, every pose stays inside the circle's ring at this share;
 * mascot.test.tsx checks it.
 */
export const AVATAR_BIRD_SHARE = 0.75;

/** The bird's size in px inside an avatar of this diameter. */
export function avatarBirdSize(size: AvatarSize): number {
  return Math.round(size * AVATAR_BIRD_SHARE);
}

/** How far, in px, to move the bird so a pose's ink sits in the middle of the circle. */
export function avatarShift(pose: PicaPose, size: AvatarSize): { x: number; y: number } {
  const scale = avatarBirdSize(size) / 48;
  const offset = inkOffset(POSES[pose]);
  const round = (n: number) => Math.round(n * scale * 100) / 100;
  return { x: round(offset.x), y: round(offset.y) };
}

/**
 * Pica inside a white circle with a hairline ring, beside Pica's chat bubbles.
 * The bird is 24 to 30px, under the brief's 32px line, so it uses the plain
 * drawing. The avatar is always silent: in a chat row, PicaThinking or the
 * message carries the words, so a thinking avatar is never a second named image.
 */
export function PicaAvatar({ pose = "idle", size = 40, className }: PicaAvatarProps) {
  const bird = avatarBirdSize(size);
  const shift = avatarShift(pose, size);
  return (
    <span
      className={[
        "pica-mascot-avatar inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-surface",
        size === 40 ? "size-10" : "size-8",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <span className="pica-mascot-avatar-bird flex" style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }}>
        <Pica pose={pose} size={bird} detail={detailFor(bird)} label={null} />
      </span>
    </span>
  );
}
