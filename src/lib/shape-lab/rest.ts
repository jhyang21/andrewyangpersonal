/**
 * Resting orientation — where the shape would settle if you put it down on flat ground.
 *
 * The physics, in one claim: a rigid flat shape laid on flat ground can only touch through its
 * convex hull, and it sits still on a hull edge when the perpendicular dropped from the centre of
 * area pierces that edge — otherwise gravity turns it. Every shape has at least one such edge.
 * Where several qualify the shape settles into the one that holds the centre of area lowest, so
 * that is the pose reported here.
 *
 * Everything below is pure and deterministic: no clock, no random, and no engine state. It is a way
 * of looking at a finished shape, not a step in making one.
 */

import type { Vec } from "./types";

export type RestPose = {
  /** Turn about the centroid that stands the shape on its resting edge, in degrees, (-180, 180]. */
  angleDeg: number;
  edgeA: Vec;
  edgeB: Vec;
  /** Perpendicular drop from the centroid to that edge — the height of the ground below it. */
  height: number;
};

function cross(o: Vec, a: Vec, b: Vec): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Monotone chain, O(n log n). Exact duplicates are dropped on the way in so the collinearity test
 * never sees a zero-length edge.
 */
export function convexHull(points: Vec[]): Vec[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const unique: Vec[] = [];
  for (const p of sorted) {
    const last = unique[unique.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    unique.push(p);
  }
  if (unique.length < 3) return unique;

  const build = (source: Vec[]): Vec[] => {
    const chain: Vec[] = [];
    for (const p of source) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= 0) {
        chain.pop();
      }
      chain.push(p);
    }
    chain.pop();
    return chain;
  };

  return [...build(unique), ...build([...unique].reverse())];
}

/**
 * Rotation about `c` by `angleDeg`, matching SVG's `rotate(deg cx cy)` exactly: on a y-down canvas
 * a positive angle turns the drawing clockwise. Viewport rotates the scene with the transform and
 * the extents with this function, so the two must agree — that is why it lives beside the angle.
 */
export function rotateAbout(p: Vec, c: Vec, angleDeg: number): Vec {
  const t = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/**
 * The pose the shape would come to rest in, or null when the outline has no area to speak of
 * (fewer than three hull points).
 */
export function restPose(silhouette: Vec[], c: Vec): RestPose | null {
  const hull = convexHull(silhouette);
  const n = hull.length;
  if (n < 3) return null;

  let edgeA: Vec | null = null;
  let edgeB: Vec | null = null;
  let height = Infinity;

  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const lengthSquared = ex * ex + ey * ey;
    if (lengthSquared === 0) continue;

    // The foot of the perpendicular must land between the two ends, or the shape tips off the edge.
    const t = ((c.x - a.x) * ex + (c.y - a.y) * ey) / lengthSquared;
    if (t <= 0 || t >= 1) continue;

    const drop = Math.abs(ex * (c.y - a.y) - ey * (c.x - a.x)) / Math.sqrt(lengthSquared);
    // Strict, so a tie between two equally low edges keeps the earlier one.
    if (drop < height) {
      height = drop;
      edgeA = a;
      edgeB = b;
    }
  }

  // A centre of area always falls inside its own hull, so some edge always wins. This is a guard.
  if (!edgeA || !edgeB) return null;

  /*
   * Lay the edge flat. Rotating the direction (ex, ey) by t leaves it with a y of
   * ex·sin t + ey·cos t, so the two angles that flatten the edge are atan2(-ey, ex) and that plus a
   * half turn. Pick the one that puts the shape above the ground — and above on a y-down canvas
   * means the centroid ends up at a *smaller* y than the edge. The centroid is the pivot, so it
   * does not move; only the edge does, and it has to end up below.
   */
  let angle = Math.atan2(-(edgeB.y - edgeA.y), edgeB.x - edgeA.x);
  const ax = edgeA.x - c.x;
  const ay = edgeA.y - c.y;
  if (ax * Math.sin(angle) + ay * Math.cos(angle) < 0) angle += Math.PI;

  let angleDeg = (angle * 180) / Math.PI;
  if (angleDeg > 180) angleDeg -= 360;

  return { angleDeg, edgeA, edgeB, height };
}
