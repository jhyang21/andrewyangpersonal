/**
 * Pica's poses as data: where each part of the bird sits on the 48-unit grid.
 *
 * The bird is drawn in parts, each in its own local frame (see Pica.tsx):
 * the body turns about the hip, the head sits on the neck, the tail hangs
 * from its root. A pose places and turns each part; nothing else changes.
 * Keeping poses as plain numbers lets a pose change slide from one to the
 * next, and lets tests check every pose without a browser.
 *
 * Each pose means one thing (docs/PICA-DESIGN.md section 4) and changes the
 * bird's outline, not just a detail, so it still reads at 24px.
 */

export const PICA_POSES = [
  "idle",
  "listening",
  "thinking",
  "found",
  "weighing",
  "unsure",
  "resting",
  "settled",
] as const;

export type PicaPose = (typeof PICA_POSES)[number];

/** A point and a turn in degrees (positive turns clockwise on screen). */
export interface Place {
  x: number;
  y: number;
  a: number;
}

export interface PoseSpec {
  /** The hip, in view units, and the body's tilt about it. */
  body: Place;
  /** The head's centre as an offset from the neck, its turn, and whether it looks back. */
  head: Place & { back?: boolean };
  /** The tail's turn. 0 points straight back; negative swings it down. */
  tail: number;
  /** How much of the tail's length shows (a tail swung toward the viewer looks shorter). */
  tailLength?: number;
  /** Standing on both legs, or sitting with the legs hidden. */
  legs: "stand" | "sit";
  eye: "open" | "closed";
  /** A bead held in the bill. */
  holds?: boolean;
  /** Beads on the ground, in view units. */
  beads?: readonly { x: number; y: number }[];
}

/** Where the head and the tail join the body, in the body's own frame. */
export const NECK = { x: 6, y: -11 } as const;
export const TAIL_ROOT = { x: -10, y: -6.5 } as const;

/** The tip of the bill, in the head's frame. */
export const BILL_TIP = { x: 11, y: 0.4 } as const;

/** The tail's full length from its root. */
export const TAIL_LENGTH = 17.5;

/** The line the feet stand on. */
export const GROUND = 44;

/** Radius of a bead. */
export const BEAD = 3;

/** Where a held bead sits, in the head's frame: just past the bill tip. */
export const HELD_BEAD = { x: BILL_TIP.x + BEAD - 1, y: 0.6 } as const;

export const POSES: Record<PicaPose, PoseSpec> = {
  // Ready: stands at ease, head level, tail down behind.
  idle: {
    body: { x: 27.5, y: 33, a: -28 },
    head: { x: 2.5, y: -2.5, a: 0 },
    tail: -38,
    legs: "stand",
    eye: "open",
  },
  // You are typing: leans in toward the words, head low and forward, tail up behind.
  listening: {
    body: { x: 26, y: 33, a: -6 },
    head: { x: 3.5, y: 0.5, a: 14 },
    tail: 26,
    tailLength: 0.85,
    legs: "stand",
    eye: "open",
  },
  // Working: stands tall, bill up, tail down behind, clear of the ground. The head tilts and blinks.
  thinking: {
    body: { x: 26, y: 31, a: -52 },
    head: { x: 1, y: -2.5, a: -35 },
    tail: -38,
    tailLength: 0.7,
    legs: "stand",
    eye: "open",
  },
  // Options are ready: holds up a bead it picked out, bill lifted, chest forward.
  found: {
    body: { x: 25, y: 33, a: -36 },
    head: { x: 2, y: -3, a: -26 },
    tail: -40,
    tailLength: 0.8,
    legs: "stand",
    eye: "open",
    holds: true,
  },
  // Two or more things side by side: head bent down over two beads.
  weighing: {
    body: { x: 23, y: 33, a: -18 },
    head: { x: 2.5, y: 0.5, a: 40 },
    tail: -50,
    tailLength: 0.75,
    legs: "stand",
    eye: "open",
    beads: [
      { x: 35.5, y: GROUND - BEAD },
      { x: 42, y: GROUND - BEAD },
    ],
  },
  // A gap or a fault: crouches low with the body and tail level, and looks back
  // over its shoulder for what is missing. Calm, not alarmed.
  unsure: {
    body: { x: 29, y: 37, a: -12 },
    head: { x: 0, y: -3.5, a: 12, back: true },
    tail: -2,
    tailLength: 0.85,
    legs: "stand",
    eye: "open",
  },
  // Paused: sits low and long, head sunk into the shoulders, eyes shut. Calm, not sad.
  resting: {
    body: { x: 29, y: 43, a: -4 },
    head: { x: -1.5, y: 2.5, a: 6 },
    tail: -10,
    tailLength: 0.9,
    legs: "sit",
    eye: "closed",
  },
  // A decision is made, bought or not: sits upright and still, head level, eyes open.
  settled: {
    body: { x: 28, y: 40, a: -24 },
    head: { x: 2, y: -2, a: 0 },
    tail: -10,
    tailLength: 0.85,
    legs: "sit",
    eye: "open",
  },
};

/**
 * Map a point from a part's frame to the grid: stretch by `sx` along x, turn
 * by `place.a`, then move to `place.x, place.y`. The same order as
 * placeTransform, so code and drawing agree.
 */
export function toGrid(place: Place, point: { x: number; y: number }, sx = 1): { x: number; y: number } {
  const rad = (place.a * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const px = point.x * sx;
  return {
    x: place.x + px * cos - point.y * sin,
    y: place.y + px * sin + point.y * cos,
  };
}

/** Turn a point in the body's frame by the body's tilt and move it to the hip. */
export function onBody(body: Place, point: { x: number; y: number }): { x: number; y: number } {
  return toGrid(body, point);
}

/** Where the head's centre sits on the grid in a pose. */
export function headPlace(spec: PoseSpec): Place {
  const neck = onBody(spec.body, NECK);
  return { x: neck.x + spec.head.x, y: neck.y + spec.head.y, a: spec.head.a };
}

/** Where the tail's root sits on the grid in a pose, turned to the tail's angle. */
export function tailPlace(spec: PoseSpec): Place {
  const root = onBody(spec.body, TAIL_ROOT);
  return { x: root.x, y: root.y, a: spec.tail };
}

/** The body's belly oval in its own frame (see Pica.tsx). */
export const BELLY = { cx: -1, cy: -6, rx: 10.5, ry: 7 } as const;
/** The wing's tip over the tail root, in the body's frame. */
export const WING_TIP = { x: -13, y: -7.5 } as const;
/** The head's radius. */
export const HEAD_R = 6;
/** The feet's front and back ends, from the hip's x, on the ground. */
export const FEET = { back: -2.5, front: 6.5 } as const;

/** A point on the bird's outline, with room `r` around it for its line or roundness. */
export interface OutlinePoint {
  x: number;
  y: number;
  r: number;
  part: string;
}

/**
 * Points on the bird's outer edge in a pose, in grid units: bill, head, tail,
 * wing tip, belly, feet and beads. Tests use them to keep every pose inside
 * the square and inside PicaAvatar's circle.
 */
export function outlinePoints(spec: PoseSpec): OutlinePoint[] {
  const head = headPlace(spec);
  const flip = spec.head.back ? -1 : 1;
  const tail = tailPlace(spec);
  const tailLength = spec.tailLength ?? 1;
  const points: OutlinePoint[] = [
    { ...toGrid(head, BILL_TIP, flip), r: 1, part: "bill" },
    { ...head, r: HEAD_R, part: "head" },
    { ...toGrid(tail, { x: -TAIL_LENGTH, y: 0 }, tailLength), r: 1, part: "tail tip" },
    { ...toGrid(tail, { x: -11, y: -2.9 }, tailLength), r: 1, part: "tail edge" },
    { ...toGrid(tail, { x: -11, y: 2.9 }, tailLength), r: 1, part: "tail edge" },
    { ...onBody(spec.body, WING_TIP), r: 1, part: "wing tip" },
  ];
  for (let i = 0; i < 16; i += 1) {
    const t = (i / 16) * 2 * Math.PI;
    const point = { x: BELLY.cx + BELLY.rx * Math.cos(t), y: BELLY.cy + BELLY.ry * Math.sin(t) };
    points.push({ ...onBody(spec.body, point), r: 1, part: "belly" });
  }
  if (spec.legs === "stand") {
    points.push({ x: spec.body.x + FEET.back, y: GROUND, r: 1, part: "foot" });
    points.push({ x: spec.body.x + FEET.front, y: GROUND, r: 1, part: "foot" });
  }
  if (spec.holds) points.push({ ...toGrid(head, HELD_BEAD, flip), r: BEAD + 0.6, part: "held bead" });
  for (const bead of spec.beads ?? []) points.push({ ...bead, r: BEAD + 0.6, part: "bead" });
  return points;
}

/** The box around a pose's outline points, each grown by its room `r`. */
export function outlineBounds(spec: PoseSpec): { minX: number; maxX: number; minY: number; maxY: number } {
  const points = outlinePoints(spec);
  return {
    minX: Math.min(...points.map((p) => p.x - p.r)),
    maxX: Math.max(...points.map((p) => p.x + p.r)),
    minY: Math.min(...points.map((p) => p.y - p.r)),
    maxY: Math.max(...points.map((p) => p.y + p.r)),
  };
}

/**
 * How far to move a pose, in grid units, so its outline box sits in the
 * middle of the grid. PicaAvatar uses it to centre the ink in the circle.
 */
export function inkOffset(spec: PoseSpec): { x: number; y: number } {
  const box = outlineBounds(spec);
  return { x: 24 - (box.minX + box.maxX) / 2, y: 24 - (box.minY + box.maxY) / 2 };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A CSS transform that moves a part's frame to `x, y`, turns it by `a` and
 * stretches it by `sx` along its length and `sy` across it. Every part uses
 * the same three functions so a pose change can slide between them.
 */
export function placeTransform(x: number, y: number, a: number, sx = 1, sy = 1): string {
  return `translate(${round(x)}px, ${round(y)}px) rotate(${round(a)}deg) scale(${round(sx)}, ${round(sy)})`;
}

/**
 * How far the legs reach up from the ground. Long enough to meet the hip in
 * the tallest standing pose; the body covers the rest in lower ones.
 */
export const LEG_LENGTH = 13;

/** How far the legs fold down toward the ground when Pica sits. */
export const SIT_LEG_SCALE = 0.2;

/**
 * Where the legs sit in a pose: feet on the ground under the hip. The legs
 * stay mounted in every pose, so a pose change slides them; sitting folds
 * them down and fades them out.
 */
export function legsPlace(spec: PoseSpec): { place: Place; sy: number; opacity: number } {
  const sitting = spec.legs === "sit";
  return {
    place: { x: spec.body.x, y: GROUND, a: 0 },
    sy: sitting ? SIT_LEG_SCALE : 1,
    opacity: sitting ? 0 : 1,
  };
}
