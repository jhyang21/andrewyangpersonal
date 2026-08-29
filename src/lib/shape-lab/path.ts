import type { Settings, Vec } from "./types";
import type { Rng } from "./rng";

const ORIENT_EPSILON = 1e-12;

function orientation(a: Vec, b: Vec, c: Vec): number {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (value > ORIENT_EPSILON) return 1;
  if (value < -ORIENT_EPSILON) return -1;
  return 0;
}

/**
 * Proper crossings only. Segments that merely share an endpoint produce a zero
 * orientation, so consecutive path edges never count as intersecting.
 */
export function segmentIntersects(p1: Vec, p2: Vec, p3: Vec, p4: Vec): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function segmentIntersectionPoint(p1: Vec, p2: Vec, p3: Vec, p4: Vec): Vec | null {
  if (!segmentIntersects(p1, p2, p3, p4)) return null;
  const r = { x: p2.x - p1.x, y: p2.y - p1.y };
  const s = { x: p4.x - p3.x, y: p4.y - p3.y };
  const denom = r.x * s.y - r.y * s.x;
  if (denom === 0) return null;
  const t = ((p3.x - p1.x) * s.y - (p3.y - p1.y) * s.x) / denom;
  return { x: p1.x + t * r.x, y: p1.y + t * r.y };
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function countPathIntersections(order: number[], points: Vec[]): number {
  const n = order.length;
  if (n < 4) return 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const a1 = points[order[i]];
    const a2 = points[order[(i + 1) % n]];
    for (let j = i + 1; j < n; j++) {
      const b1 = points[order[j]];
      const b2 = points[order[(j + 1) % n]];
      if (segmentIntersects(a1, a2, b1, b2)) count++;
    }
  }
  return count;
}

function crossingsForCandidate(edges: [Vec, Vec][], from: Vec, to: Vec): number {
  let count = 0;
  for (const [a, b] of edges) {
    if (segmentIntersects(from, to, a, b)) count++;
  }
  return count;
}

function isBetterStart(mode: Settings["startMode"], candidate: Vec, best: Vec): boolean {
  switch (mode) {
    // Screen coordinates grow downwards, so the lowest point is the largest y.
    case "lowest":
      return candidate.y > best.y;
    case "highest":
      return candidate.y < best.y;
    case "leftmost":
      return candidate.x < best.x;
    default:
      return candidate.x > best.x; // rightmost
  }
}

function pickStart(points: Vec[], settings: Settings, rng: Rng): number {
  if (settings.startMode === "random") {
    return Math.min(points.length - 1, Math.floor(rng() * points.length));
  }
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (isBetterStart(settings.startMode, points[i], points[best])) best = i;
  }
  return best;
}

/**
 * 2-opt repair, run until no pair of edges crosses. Reversing the span between
 * two crossing edges always shortens a Euclidean tour, so this terminates
 * rather than cycling; `maxIterations` only bounds the wait.
 */
export function untangle(
  order: number[],
  points: Vec[],
  maxIterations: number,
): { order: number[]; iterations: number; converged: boolean } {
  const n = order.length;
  const result = [...order];
  if (n < 4) return { order: result, iterations: 0, converged: true };
  const limit = Math.max(1, Math.round(maxIterations));
  let iterations = 0;

  while (iterations < limit) {
    let found = false;
    for (let i = 0; i < n - 1 && !found; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const crosses = segmentIntersects(
          points[result[i]],
          points[result[i + 1]],
          points[result[j]],
          points[result[(j + 1) % n]],
        );
        if (!crosses) continue;
        for (let l = i + 1, r = j; l < r; l++, r--) {
          const swap = result[l];
          result[l] = result[r];
          result[r] = swap;
        }
        found = true;
        break;
      }
    }
    if (!found) return { order: result, iterations, converged: true };
    iterations++;
  }

  return { order: result, iterations, converged: countPathIntersections(result, points) === 0 };
}

/**
 * Greedy nearest-neighbour traversal that prefers candidates adding no
 * crossing. The tour it returns is only the untangler's starting point, so the
 * crossing count is not the guarantee — it just makes 2-opt's job short.
 */
export function buildPath(points: Vec[], settings: Settings, rng: Rng): { order: number[] } {
  const n = points.length;
  const start = pickStart(points, settings, rng);
  const order: number[] = [start];
  const visited = new Array<boolean>(n).fill(false);
  visited[start] = true;
  const edges: [Vec, Vec][] = [];

  while (order.length < n) {
    const current = points[order[order.length - 1]];
    const progress = (order.length / n) ** 2;
    let bestIndex = -1;
    let bestScore = Infinity;
    let bestCrossings = Infinity;

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const candidate = points[i];
      let score = distance(current, candidate);
      if (settings.closingEdgeWeight > 0) {
        score += settings.closingEdgeWeight * 0.3 * distance(candidate, points[start]) * progress;
      }
      // Fewest crossings wins outright; distance only breaks the tie.
      const crossings = crossingsForCandidate(edges, current, candidate);
      if (crossings < bestCrossings || (crossings === bestCrossings && score < bestScore)) {
        bestCrossings = crossings;
        bestScore = score;
        bestIndex = i;
      }
    }

    const next = bestIndex === -1 ? visited.findIndex((v) => !v) : bestIndex;
    edges.push([current, points[next]]);
    visited[next] = true;
    order.push(next);
  }

  return { order };
}
