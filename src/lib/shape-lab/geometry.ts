/**
 * Distance and box primitives for the constraint solver. Everything here is
 * exact for the polyline geometry the solver works with — no tolerances, so a
 * caller decides what "too close" means.
 */

import type { Vec } from "./types";
import { segmentIntersects } from "./path";

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

const DEGENERATE_LENGTH_SQ = 1e-24;

export function polylineBox(polyline: Vec[]): Box {
  if (polyline.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polyline) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function segmentBox(a: Vec, b: Vec): Box {
  return {
    minX: a.x < b.x ? a.x : b.x,
    minY: a.y < b.y ? a.y : b.y,
    maxX: a.x > b.x ? a.x : b.x,
    maxY: a.y > b.y ? a.y : b.y,
  };
}

/** `pad` inflates the first box; overlap is inclusive so a pad of 0 still catches touching boxes. */
export function boxesOverlap(a: Box, b: Box, pad = 0): boolean {
  return !(
    a.maxX + pad < b.minX ||
    b.maxX + pad < a.minX ||
    a.maxY + pad < b.minY ||
    b.maxY + pad < a.minY
  );
}

export function pointInBox(p: Vec, box: Box, pad = 0): boolean {
  return (
    p.x >= box.minX - pad && p.x <= box.maxX + pad && p.y >= box.minY - pad && p.y <= box.maxY + pad
  );
}

/** 0 inside the box, otherwise the distance to its nearest edge or corner. */
export function pointBoxDistance(p: Vec, box: Box): number {
  const dx = p.x < box.minX ? box.minX - p.x : p.x > box.maxX ? p.x - box.maxX : 0;
  const dy = p.y < box.minY ? box.minY - p.y : p.y > box.maxY ? p.y - box.maxY : 0;
  return Math.hypot(dx, dy);
}

export function pointSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < DEGENERATE_LENGTH_SQ) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Exact: two segments that do not cross have their closest approach at an
 * endpoint of one of them, so the four endpoint-to-segment distances cover it.
 */
export function segmentSegmentDistance(p1: Vec, p2: Vec, p3: Vec, p4: Vec): number {
  if (segmentIntersects(p1, p2, p3, p4)) return 0;
  const d1 = pointSegmentDistance(p1, p3, p4);
  const d2 = pointSegmentDistance(p2, p3, p4);
  const d3 = pointSegmentDistance(p3, p1, p2);
  const d4 = pointSegmentDistance(p4, p1, p2);
  return Math.min(Math.min(d1, d2), Math.min(d3, d4));
}

/**
 * Returns Infinity when `box` (the polyline's own bounds) already proves the
 * point is at least `limit` away — the caller only asked whether it is closer.
 */
export function pointPolylineDistance(
  p: Vec,
  polyline: Vec[],
  limit = Infinity,
  box?: Box,
): number {
  const n = polyline.length;
  if (n === 0) return Infinity;
  if (box && pointBoxDistance(p, box) >= limit) return Infinity;
  if (n === 1) return Math.hypot(p.x - polyline[0].x, p.y - polyline[0].y);
  let best = Infinity;
  for (let i = 0; i + 1 < n; i++) {
    const d = pointSegmentDistance(p, polyline[i], polyline[i + 1]);
    if (d < best) best = d;
  }
  return best;
}
