import {
  clamp,
  PARAM_KEYS,
  PARAM_RANGES,
  type NumericParamMeta,
  type Settings,
  type Shape,
  type Vec,
} from "./types";
import { gaussian, rngFor, type Rng } from "./rng";
import { generatePoints } from "./points";
import { buildPath, countPathIntersections, untangle } from "./path";
import { buildSilhouette } from "./silhouette";
import { solveArcs } from "./constraints";
import { computeBalance } from "./balance";

export type Locks = null | { points: Vec[] } | { points: Vec[]; pathOrder: number[] };

/** Resolution used while scoring search candidates; the winner is rebuilt in full. */
const SEARCH_RESOLUTION = 8;
const SEARCH_PASSES = 3;
const SEARCH_SAFE_ITERATIONS = 6;
const SEARCH_REPAIRS = 8;
const SEARCH_UNTANGLE = 200;
const POINT_RETRIES = 4;
const LOCKED_UNTANGLE_ROUNDS = 8;
const SVG_PADDING = 0.08;
const SVG_MAX_DIMENSION = 512;

function clonePoints(points: Vec[]): Vec[] {
  return points.map((p) => ({ x: p.x, y: p.y }));
}

type Skeleton = {
  points: Vec[];
  order: number[];
  untangleIterations: number;
  pointRetries: number;
};

/**
 * A simple closed polygon, which the whole validity guarantee rests on. 2-opt
 * always converges at these sizes, so the retries are a budget backstop rather
 * than an expected path.
 */
function buildSkeleton(seed: number, settings: Settings, locks: Locks): Skeleton {
  const budget = settings.maxUntangleIterations;
  let last: Skeleton | null = null;

  for (let retry = 0; retry < POINT_RETRIES; retry++) {
    const points = locks ? clonePoints(locks.points) : generatePoints(settings, rngFor(seed, 1, retry));
    const seedOrder =
      locks && "pathOrder" in locks
        ? [...locks.pathOrder]
        : buildPath(points, settings, rngFor(seed, 2, retry)).order;

    const first = untangle(seedOrder, points, budget);
    if (first.converged) {
      return { points, order: first.order, untangleIterations: first.iterations, pointRetries: retry };
    }

    if (locks) {
      // Locked points are never regenerated; only the budget can fail here.
      let order = first.order;
      let iterations = first.iterations;
      for (let round = 0; round < LOCKED_UNTANGLE_ROUNDS; round++) {
        const again = untangle(order, points, budget);
        order = again.order;
        iterations += again.iterations;
        if (again.converged) break;
      }
      return { points, order, untangleIterations: iterations, pointRetries: retry };
    }

    last = { points, order: first.order, untangleIterations: first.iterations, pointRetries: retry };
  }

  return last as Skeleton;
}

export function generateShape(seed: number, settings: Settings, locks: Locks): Shape {
  const snapshot: Settings = { ...settings };
  const skeleton = buildSkeleton(seed, snapshot, locks);
  const { points, order } = skeleton;

  const solved = solveArcs(seed, points, order, snapshot);
  solved.report.untangleIterations = skeleton.untangleIterations;
  solved.report.pointRetries = skeleton.pointRetries;

  const silhouette = buildSilhouette(
    points,
    order,
    solved.arcs,
    snapshot.arcResolution,
    snapshot.curveStyle,
  );

  return {
    seed,
    settings: snapshot,
    points,
    pathOrder: order,
    arcs: solved.arcs,
    constraints: solved.report,
    silhouette,
    pathIntersections: countPathIntersections(order, points),
    silhouetteIntersections: solved.hits,
    attemptsUsed: 1 + skeleton.pointRetries,
    metrics: computeBalance(silhouette, solved.arcs, snapshot, solved.report),
  };
}

type MutableSettings = Record<string, number | string>;

function snap(value: number, meta: NumericParamMeta): number {
  const steps = Math.round((clamp(value, meta.min, meta.max) - meta.min) / meta.step);
  const snapped = meta.min + steps * meta.step;
  return clamp(Number(snapped.toFixed(6)), meta.min, meta.max);
}

export function mutateSettings(settings: Settings, amount: number, rng: Rng): Settings {
  const next: Settings = { ...settings };
  const target = next as unknown as MutableSettings;
  const source = settings as unknown as MutableSettings;

  for (const key of PARAM_KEYS) {
    const meta = PARAM_RANGES[key];
    if (meta.randomizable === false) continue;
    if (meta.kind === "number") {
      const current = source[key] as number;
      target[key] = snap(current + gaussian(rng) * amount * (meta.max - meta.min), meta);
    } else if (rng() < 0.2 * amount) {
      const options = meta.options;
      target[key] = options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
    }
  }

  return next;
}

export function randomizeSettings(base: Settings, rng: Rng): Settings {
  const next: Settings = { ...base };
  const target = next as unknown as MutableSettings;

  for (const key of PARAM_KEYS) {
    const meta = PARAM_RANGES[key];
    if (meta.randomizable === false) continue;
    if (meta.kind === "number") {
      target[key] = snap(meta.min + rng() * (meta.max - meta.min), meta);
    } else {
      const options = meta.options;
      target[key] = options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
    }
  }

  return next;
}

export type SearchResult = { bestSeed: number; bestScore: number };

/**
 * Scores seeds baseSeed+startIndex .. baseSeed+endIndex-1 at a low arc
 * resolution. Synchronous and bounded so a caller can chunk it across timeouts.
 */
export function scoreCandidateRange(
  baseSeed: number,
  settings: Settings,
  locks: Locks,
  startIndex: number,
  endIndex: number,
): SearchResult {
  // Budgets only — every dial that changes what the shape looks like is untouched,
  // so the winning seed still means the same thing at the user's real settings.
  const scoring: Settings = {
    ...settings,
    arcResolution: SEARCH_RESOLUTION,
    curveGrowthPasses: Math.min(settings.curveGrowthPasses, SEARCH_PASSES),
    safeRadiusSearchIterations: Math.min(
      settings.safeRadiusSearchIterations,
      SEARCH_SAFE_ITERATIONS,
    ),
    maxArcRepairAttempts: Math.min(settings.maxArcRepairAttempts, SEARCH_REPAIRS),
    maxUntangleIterations: Math.min(settings.maxUntangleIterations, SEARCH_UNTANGLE),
  };
  let bestSeed = baseSeed + startIndex;
  let bestScore = -Infinity;
  for (let i = startIndex; i < endIndex; i++) {
    const seed = baseSeed + i;
    const score = generateShape(seed, scoring, locks).metrics.precariousness;
    if (score > bestScore) {
      bestScore = score;
      bestSeed = seed;
    }
  }
  return { bestSeed, bestScore };
}

/** Open path — the construction layer draws arcs that must not close. */
export function toPolylinePathD(silhouette: Vec[], decimals = 4): string {
  if (silhouette.length === 0) return "";
  const format = (value: number) => Number(value.toFixed(decimals)).toString();
  const parts: string[] = [`M${format(silhouette[0].x)} ${format(silhouette[0].y)}`];
  for (let i = 1; i < silhouette.length; i++) {
    parts.push(`L${format(silhouette[i].x)} ${format(silhouette[i].y)}`);
  }
  return parts.join("");
}

export function toSvgPathD(silhouette: Vec[], decimals = 4): string {
  const d = toPolylinePathD(silhouette, decimals);
  return d === "" ? "" : `${d}Z`;
}

export function toStandaloneSvg(shape: Shape): string {
  const box = shape.metrics.bbox;
  const pad = Math.max(box.width, box.height, 1e-6) * SVG_PADDING;
  const x = box.minX - pad;
  const y = box.minY - pad;
  const width = box.width + 2 * pad;
  const height = box.height + 2 * pad;
  const scale = SVG_MAX_DIMENSION / Math.max(width, height);
  const format = (value: number) => Number(value.toFixed(4)).toString();
  const viewBox = `${format(x)} ${format(y)} ${format(width)} ${format(height)}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"`,
    ` width="${Math.round(width * scale)}" height="${Math.round(height * scale)}">`,
    `<path d="${toSvgPathD(shape.silhouette)}" fill="#111114" fill-rule="evenodd"/>`,
    `</svg>`,
  ].join("");
}
