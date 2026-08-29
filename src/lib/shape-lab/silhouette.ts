import type { ArcProps, Settings, Vec } from "./types";
import { segmentIntersectionPoint } from "./path";

/**
 * P(t) = M + u·(d/2)·cos t + side·v·(k·d)·sin t runs B→A as t goes 0→π, so t is
 * swept from π down to 0 and the endpoints are written back exactly.
 */
export function sampleHalfEllipse(
  a: Vec,
  b: Vec,
  k: number,
  side: 1 | -1,
  resolution: number,
): Vec[] {
  const steps = Math.max(2, Math.round(resolution));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const out: Vec[] = [];

  if (length < 1e-12) {
    for (let i = 0; i <= steps; i++) out.push({ x: a.x, y: a.y });
    out[steps] = { x: b.x, y: b.y };
    return out;
  }

  const u: Vec = { x: dx / length, y: dy / length };
  const v: Vec = { x: -u.y, y: u.x };
  const midpoint: Vec = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const semiMajor = length / 2;
  const semiMinor = k * length;

  for (let i = 0; i <= steps; i++) {
    const t = Math.PI * (1 - i / steps);
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    out.push({
      x: midpoint.x + u.x * semiMajor * cos + side * v.x * semiMinor * sin,
      y: midpoint.y + u.y * semiMajor * cos + side * v.y * semiMinor * sin,
    });
  }

  out[0] = { x: a.x, y: a.y };
  out[steps] = { x: b.x, y: b.y };
  return out;
}

/**
 * Cubic Bézier from A to B, bulging perpendicular to AB by exactly k·d at its peak — the same
 * meaning k has for `sampleHalfEllipse`, via the standard 4/3 control-point factor. Runs A→B
 * inclusive with resolution+1 points, endpoints forced exact, mirroring the ellipse sampler.
 */
export function sampleCubicBezier(
  a: Vec,
  b: Vec,
  k: number,
  side: 1 | -1,
  resolution: number,
): Vec[] {
  const steps = Math.max(2, Math.round(resolution));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const out: Vec[] = [];

  if (length < 1e-12) {
    for (let i = 0; i <= steps; i++) out.push({ x: a.x, y: a.y });
    out[steps] = { x: b.x, y: b.y };
    return out;
  }

  const u: Vec = { x: dx / length, y: dy / length };
  const v: Vec = { x: -u.y, y: u.x };
  const bulge = side * (4 / 3) * k * length;
  const c1: Vec = { x: a.x + dx / 3 + v.x * bulge, y: a.y + dy / 3 + v.y * bulge };
  const c2: Vec = { x: a.x + (2 * dx) / 3 + v.x * bulge, y: a.y + (2 * dy) / 3 + v.y * bulge };

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const w0 = mt * mt * mt;
    const w1 = 3 * mt * mt * t;
    const w2 = 3 * mt * t * t;
    const w3 = t * t * t;
    out.push({
      x: w0 * a.x + w1 * c1.x + w2 * c2.x + w3 * b.x,
      y: w0 * a.y + w1 * c1.y + w2 * c2.y + w3 * b.y,
    });
  }

  out[0] = { x: a.x, y: a.y };
  out[steps] = { x: b.x, y: b.y };
  return out;
}

/** Samples one edge with whichever curve the settings ask for. */
export function sampleArc(
  a: Vec,
  b: Vec,
  k: number,
  side: 1 | -1,
  resolution: number,
  style: Settings["curveStyle"],
): Vec[] {
  return style === "bezier"
    ? sampleCubicBezier(a, b, k, side, resolution)
    : sampleHalfEllipse(a, b, k, side, resolution);
}

/** Closed polyline of edges×resolution vertices; joints are written once. */
export function buildSilhouette(
  points: Vec[],
  order: number[],
  arcs: ArcProps[],
  resolution: number,
  curveStyle: Settings["curveStyle"],
): Vec[] {
  const sample = curveStyle === "bezier" ? sampleCubicBezier : sampleHalfEllipse;
  const n = order.length;
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[order[i]];
    const b = points[order[(i + 1) % n]];
    const arc = arcs[i];
    const samples = sample(a, b, arc.k, arc.side, resolution);
    for (let j = 0; j < samples.length - 1; j++) out.push(samples[j]);
  }
  return out;
}

export function findSilhouetteIntersections(silhouette: Vec[]): Vec[] {
  const m = silhouette.length;
  const hits: Vec[] = [];
  if (m < 4) return hits;
  for (let i = 0; i < m; i++) {
    const a1 = silhouette[i];
    const a2 = silhouette[(i + 1) % m];
    for (let j = i + 1; j < m; j++) {
      if (j === i + 1) continue;
      if (i === 0 && j === m - 1) continue;
      const b1 = silhouette[j];
      const b2 = silhouette[(j + 1) % m];
      const hit = segmentIntersectionPoint(a1, a2, b1, b2);
      if (hit) hits.push(hit);
    }
  }
  return hits;
}
