import {
  clamp,
  type ArcProps,
  type BalanceMetrics,
  type Bbox,
  type ConstraintReport,
  type ContactRegion,
  type PrecariousnessPart,
  type Settings,
  type Vec,
} from "./types";

const AREA_EPSILON = 1e-9;

export function signedArea(polygon: Vec[]): number {
  const n = polygon.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function centroid(polygon: Vec[]): Vec {
  const n = polygon.length;
  if (n === 0) return { x: 0, y: 0 };
  const area = signedArea(polygon);
  if (Math.abs(area) < AREA_EPSILON) {
    let x = 0;
    let y = 0;
    for (const p of polygon) {
      x += p.x;
      y += p.y;
    }
    return { x: x / n, y: y / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function bbox(polygon: Vec[]): Bbox {
  if (polygon.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Everything within the tolerance band of the lowest point. It may span
 * disjoint feet; the span is what a support polygon means here.
 */
export function contactRegion(polygon: Vec[], box: Bbox, tolerance: number): ContactRegion {
  const cutoff = box.maxY - tolerance * Math.max(box.height, 1e-9);
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of polygon) {
    if (p.y >= cutoff) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
  }
  if (minX === Infinity) {
    minX = box.minX;
    maxX = box.maxX;
  }
  return { minX, maxX, centerX: (minX + maxX) / 2, width: maxX - minX, y: box.maxY };
}

/**
 * Sutherland–Hodgman against one half-plane. `inside` is a signed distance:
 * vertices with a non-negative value are kept.
 */
export function clipHalfPlane(polygon: Vec[], inside: (p: Vec) => number): Vec[] {
  const n = polygon.length;
  if (n === 0) return [];
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % n];
    const dc = inside(current);
    const dn = inside(next);
    if (dc >= 0) out.push(current);
    if ((dc >= 0 && dn < 0) || (dc < 0 && dn >= 0)) {
      const t = dc / (dc - dn);
      out.push({ x: current.x + t * (next.x - current.x), y: current.y + t * (next.y - current.y) });
    }
  }
  return out;
}

export function asymmetry(polygon: Vec[], axisX: number): number {
  const left = Math.abs(signedArea(clipHalfPlane(polygon, (p) => axisX - p.x)));
  const right = Math.abs(signedArea(clipHalfPlane(polygon, (p) => p.x - axisX)));
  const total = left + right;
  if (total < AREA_EPSILON) return 0;
  return Math.abs(left - right) / total;
}

export function topHeavyScore(polygon: Vec[], box: Bbox): number {
  const total = Math.abs(signedArea(polygon));
  if (total < AREA_EPSILON) return 0;
  const midline = (box.minY + box.maxY) / 2;
  // Above the midline is the smaller y in screen coordinates.
  const above = Math.abs(signedArea(clipHalfPlane(polygon, (p) => midline - p.y)));
  return clamp(above / total, 0, 1);
}

/**
 * How hard the solver had to work for this shape: tight gaps, arcs pressed
 * against their limit, bulges cut short, and narrow necks all read as strain.
 */
export function geometricTension(
  report: ConstraintReport,
  settings: Settings,
  arcCount: number,
): number {
  const target = settings.minimumClearance;
  const tightness = target > 0 ? clamp(1 - report.minClearance / target, 0, 1) : 0;
  const utilization = clamp(report.meanUtilization, 0, 1);
  const constrained = arcCount === 0 ? 0 : clamp(report.constrainedCount / arcCount, 0, 1);
  const neckiness = arcCount === 0 ? 0 : clamp(report.neckPairs / arcCount, 0, 1);
  return clamp(
    0.35 * tightness + 0.3 * utilization + 0.2 * constrained + 0.15 * neckiness,
    0,
    1,
  );
}

/**
 * Hover copy for the score breakdown, keyed by the exact labels the `parts` array below writes.
 * It lives here so a renamed part and its description move together.
 */
export const PART_DESCRIPTIONS: Record<string, string> = {
  "Centroid offset":
    "How far the centre of area leans from the middle of the ground contact. It carries the most weight of any term: lean far enough and the shape falls.",
  "Contact narrowness":
    "How little of the shape's width rests on the ground. A broad base scores near 0, a shape balanced on one point near 1.",
  "Top heavy": "The share of the area sitting above the halfway line. Weight held high reads as ready to drop.",
  Slenderness:
    "How tall the shape stands for its width. It starts at 0 for a square shape and tops out at three times as tall as wide.",
  Asymmetry: "How unevenly the area splits either side of the centre. Matching halves score 0.",
  Overhang: "How far the shape juts out past its own footing, taken on whichever side reaches further.",
  "Dramatic bulges":
    "The share of edges that swell out further than their own length. It looks alarming rather than being unstable, so it counts for little.",
  "Geometric tension":
    "How hard the solver had to work: tight gaps, curves pressed against their limit, bulges cut short, and narrow necks all read as strain.",
};

export function computeBalance(
  silhouette: Vec[],
  arcs: ArcProps[],
  settings: Settings,
  report: ConstraintReport,
): BalanceMetrics {
  const box = bbox(silhouette);
  const area = Math.abs(signedArea(silhouette));
  const center = centroid(silhouette);
  const contact = contactRegion(silhouette, box, settings.contactTolerance);
  const width = Math.max(box.width, 1e-9);

  const supported = center.x >= contact.minX && center.x <= contact.maxX;
  const rawOffset = clamp(Math.abs(center.x - contact.centerX) / (width / 2), 0, 1);
  const centroidOffset = supported ? rawOffset : Math.min(1, rawOffset * 1.5);

  const contactNarrowness = clamp(1 - contact.width / width, 0, 1);
  const topHeavy = topHeavyScore(silhouette, box);
  // A tall, narrow shape reads as unstable; aspect 3:1 saturates the term.
  const slenderness = clamp((box.height / width - 1) / 2, 0, 1);
  const asym = asymmetry(silhouette, center.x);
  const overhang = clamp(
    Math.max(contact.minX - box.minX, box.maxX - contact.maxX) / width,
    0,
    1,
  );
  const dramaticBulges =
    arcs.length === 0 ? 0 : arcs.filter((arc) => arc.k > 1).length / arcs.length;
  const tension = geometricTension(report, settings, arcs.length);

  const parts: PrecariousnessPart[] = [
    { label: "Centroid offset", value: centroidOffset, weight: 29 },
    { label: "Contact narrowness", value: contactNarrowness, weight: 19 },
    { label: "Top heavy", value: topHeavy, weight: 14 },
    { label: "Slenderness", value: slenderness, weight: 12 },
    { label: "Asymmetry", value: asym, weight: 10 },
    { label: "Overhang", value: overhang, weight: 8 },
    { label: "Dramatic bulges", value: dramaticBulges, weight: 2 },
    { label: "Geometric tension", value: tension, weight: 6 },
  ];

  const precariousness = clamp(
    parts.reduce((sum, part) => sum + part.value * part.weight, 0),
    0,
    100,
  );

  return {
    area,
    centroid: center,
    bbox: box,
    contact,
    centroidOffset,
    supported,
    contactNarrowness,
    topHeavyScore: topHeavy,
    slenderness,
    asymmetry: asym,
    overhang,
    dramaticBulges,
    geometricTension: tension,
    precariousness,
    precariousnessParts: parts,
  };
}
