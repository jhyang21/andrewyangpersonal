import type { CSSProperties } from "react";
import "./mascot.css";
import {
  BEAD,
  BELLY,
  BILL_TIP,
  FEET,
  HEAD_R,
  HELD_BEAD,
  LEG_LENGTH,
  NECK,
  POSES,
  TAIL_LENGTH,
  WING_TIP,
  headPlace,
  legsPlace,
  placeTransform,
  tailPlace,
  type PicaPose,
  type Place,
  type PoseSpec,
} from "./poses";

/**
 * Pica the magpie: line and flat fill on a 48-unit grid, drawn to sit beside
 * Lucide icons. Black head, back and tail, white belly, one purple-soft wing
 * patch. Under 32px it draws a plainer bird with a heavier line so it still
 * reads at 24.
 *
 * Pica is hidden from screen readers in every pose but `thinking`, where it
 * is an image named by `label`.
 */

export type { PicaPose } from "./poses";

export interface PicaProps {
  pose?: PicaPose;
  /** Width and height in px. Default 48. */
  size?: number;
  /**
   * Which drawing to use. By default the plain bird under 32px and the full
   * bird from 32px up. Set it when the size the buyer reads is not the
   * bird's own, as in PicaAvatar, where the circle sets the level.
   */
  detail?: PicaDetail;
  /**
   * The spoken name in the `thinking` pose; other poses ignore it. Default
   * "Pica is working on it". Pass null when a live region nearby already
   * says it, as PicaThinking does.
   */
  label?: string | null;
  /**
   * Hold the thinking loop still. For a page that shows several thinking
   * birds at once, such as MascotSheet, so only one moves.
   */
  still?: boolean;
  className?: string;
}

/** What Pica says, in the thinking pose, to a screen reader. */
export const THINKING_LABEL = "Pica is working on it";

/** The only colours Pica uses: three tokens from src/pica/styles.css. */
export const PICA_COLORS = {
  ink: "var(--color-ink)",
  white: "var(--color-surface)",
  patch: "var(--color-purple-soft)",
} as const;

const { ink: INK, white: WHITE, patch: PATCH } = PICA_COLORS;

/** Below this size Pica draws the plainer bird. */
export const SIMPLE_BELOW = 32;

export type PicaDetail = "plain" | "full";

/** The drawing the brief gives a mark of this size. */
export function detailFor(size: number): PicaDetail {
  return size < SIMPLE_BELOW ? "plain" : "full";
}

/**
 * Line width in grid units. The plain bird's line is about 1.75px at 24;
 * the full bird keeps between 1.5px and 3px as it grows.
 */
function lineWidth(size: number, simple: boolean): number {
  if (simple) return 3.5;
  return Math.max(1.2, 72 / size);
}

/**
 * The line round the plain bird's white shapes (belly and beads), about 1px
 * at 24. The full outline line would eat most of a small white shape, and
 * the bird must still read black and white.
 */
export const PLAIN_WHITE_LINE = 2;

/** A part's place on the grid, set as CSS so a pose change can slide it. */
function placed(place: Place, sx = 1, sy = 1): CSSProperties {
  return { transform: placeTransform(place.x, place.y, place.a, sx, sy) };
}

export function Pica({ pose = "idle", size = 48, detail, label, still = false, className }: PicaProps) {
  const spec = POSES[pose];
  const legs = legsPlace(spec);
  const simple = (detail ?? detailFor(size)) === "plain";
  const line = lineWidth(size, simple);
  const whiteLine = simple ? PLAIN_WHITE_LINE : line;

  const spoken = pose === "thinking" && label !== null ? (label ?? THINKING_LABEL) : null;
  const a11y = spoken
    ? { role: "img" as const, "aria-label": spoken }
    : { "aria-hidden": "true" as const, focusable: "false" as const };

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      {...a11y}
      data-pose={pose}
      className={["pica-mascot", `pica-mascot-pose-${pose}`, still ? "pica-mascot-still" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {/*
        Legs first, so the body covers their tops. They stay mounted in every
        pose, feet on the ground line, so a pose change only slides them
        along it; sitting folds them down and fades them.
      */}
      <g
        className="pica-mascot-part pica-mascot-legs"
        style={{ ...placed(legs.place, 1, legs.sy), opacity: legs.opacity }}
      >
        <Legs line={line} simple={simple} />
      </g>

      <g className="pica-mascot-part" style={placed(tailPlace(spec), spec.tailLength ?? 1)}>
        <Tail line={line} />
      </g>

      <g className="pica-mascot-part" style={placed(spec.body)}>
        <Body line={line} whiteLine={whiteLine} simple={simple} />
      </g>

      <g className="pica-mascot-part" style={placed(headPlace(spec))}>
        {/*
          Looking back mirrors the head at once, in its own group with no
          transition, so the head never squeezes flat as it turns.
        */}
        <g className="pica-mascot-flip" style={{ transform: spec.head.back ? "scale(-1, 1)" : "scale(1, 1)" }}>
          {/* A third group so the thinking tilt can turn the head without undoing its place. */}
          <g className="pica-mascot-tilt">
            <Head line={line} whiteLine={whiteLine} simple={simple} eye={spec.eye} holds={spec.holds} />
          </g>
        </g>
      </g>

      {spec.beads?.map((bead) => (
        <Bead key={`${bead.x},${bead.y}`} x={bead.x} y={bead.y} line={whiteLine} />
      ))}
    </svg>
  );
}

interface PartProps {
  line: number;
  simple?: boolean;
}

/** A small round thing Pica has picked up: white with an ink line. */
function Bead({ x, y, line }: PartProps & { x: number; y: number }) {
  return <circle className="pica-mascot-bead" cx={x} cy={y} r={BEAD} fill={WHITE} stroke={INK} strokeWidth={line} />;
}

/** The body, with the hip at 0,0 and the breast facing +x. */
function Body({ line, whiteLine, simple }: PartProps & { whiteLine: number }) {
  return (
    <g strokeLinejoin="round">
      {/* White belly; the black parts below cover all but its lower side. */}
      <ellipse
        cx={BELLY.cx}
        cy={BELLY.cy}
        rx={BELLY.rx}
        ry={BELLY.ry}
        fill={WHITE}
        stroke={INK}
        strokeWidth={whiteLine}
      />
      {/* Black neck and breast, down to where the belly turns white. */}
      <circle cx={NECK.x} cy={NECK.y} r={3.5} fill={INK} />
      <path d="M1 -12.8 C8 -13.6 11 -8.5 9.4 -4.2 C8.6 -2.4 7.4 -1.2 6 -0.4 C4.2 -4.4 2.8 -8.6 1 -12.8 Z" fill={INK} />
      {/* Folded wing over the back, its tip over the tail root. */}
      <path
        d={`M7.5 -10.5 C3 -14.6 -7.5 -14.2 ${WING_TIP.x} ${WING_TIP.y} L-11.6 -4.2 C-4.5 -2.8 3 -4.6 7.5 -10.5 Z`}
        fill={INK}
        stroke={INK}
        strokeWidth={line}
      />
      {/* The wing patch: purple-soft where a real magpie is white. */}
      <path
        d={
          simple
            ? "M6 -9.8 C2 -11.4 -4 -10.4 -8.6 -6.2 C-3 -4.8 2.2 -6.2 6 -9.8 Z"
            : "M5.6 -9.8 C2 -10.9 -3.5 -10 -7.8 -6.6 C-3 -5.6 2 -6.6 5.6 -9.8 Z"
        }
        fill={PATCH}
      />
    </g>
  );
}

/** The head, centred on 0,0, bill to +x. */
function Head({ line, whiteLine, simple, eye, holds }: PartProps & { whiteLine: number; eye: PoseSpec["eye"]; holds?: boolean }) {
  return (
    <g strokeLinejoin="round">
      <path
        d={`M4.2 -2.6 L${BILL_TIP.x} ${BILL_TIP.y} L4.6 2.4 Z`}
        fill={INK}
        stroke={INK}
        strokeWidth={line * 0.6}
      />
      {/* The throat, below and behind the head, joins it to the breast in every pose. */}
      <ellipse cx={-0.4} cy={3.8} rx={4} ry={4.2} fill={INK} />
      <circle r={HEAD_R} fill={INK} />
      {eye === "closed" ? (
        // Shut, an almost flat line: at rest, neither smiling nor sad.
        <path
          d="M0.4 -1.4 Q2.2 -0.9 4 -1.4"
          stroke={WHITE}
          strokeWidth={simple ? 1.6 : 1.1}
          strokeLinecap="round"
        />
      ) : (
        <g className="pica-mascot-eye">
          <circle cx={2.2} cy={-1.6} r={simple ? 1.9 : 1.8} fill={WHITE} />
          {simple ? null : <circle cx={2.7} cy={-1.6} r={1} fill={INK} />}
        </g>
      )}
      {holds ? <Bead x={HELD_BEAD.x} y={HELD_BEAD.y} line={whiteLine} /> : null}
    </g>
  );
}

/** The long tail, root at 0,0, pointing to -x. */
function Tail({ line }: PartProps) {
  const tip = -TAIL_LENGTH;
  return (
    <path
      d={`M1.5 -2 L-11 -2.9 Q-15.5 -2.6 ${tip} 0 Q-15.5 2.6 -11 2.9 L1.5 2 Z`}
      fill={INK}
      stroke={INK}
      strokeWidth={line * 0.5}
      strokeLinejoin="round"
    />
  );
}

/**
 * Two legs standing on the ground line at y 0, under a hip at x 0, reaching
 * LEG_LENGTH up. The same drawing in every pose, so nothing jumps between
 * poses; the body covers the tops.
 */
function Legs({ line, simple }: PartProps) {
  const w = simple ? line * 0.8 : line;
  const top = -LEG_LENGTH;
  return (
    <g stroke={INK} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M-1.5 ${top} L${FEET.back} 0 L1 0`} />
      <path d={`M2.5 ${top} L3 0 L${FEET.front} 0`} />
    </g>
  );
}
