/**
 * The validity solver. Randomness proposes a bulge for every edge; this decides
 * how much of it fits. The skeleton is a simple polygon, every arc starts at its
 * chord, and each growth step is bounded by a feasibility search — so the
 * silhouette is a simple closed curve at every instant, not just at the end.
 */

import {
  clamp,
  type ArcProps,
  type ArcReport,
  type ConstraintReport,
  type Settings,
  type Vec,
} from "./types";
import { gaussian, rngFor, type Rng } from "./rng";
import { segmentIntersectionPoint, segmentIntersects } from "./path";
import { sampleArc } from "./silhouette";
import {
  boxesOverlap,
  pointInBox,
  pointPolylineDistance,
  pointSegmentDistance,
  polylineBox,
  segmentBox,
  segmentSegmentDistance,
  type Box,
} from "./geometry";

const K_MIN = 0.02;
const K_MAX = 2.5;
/** Solver samples are snapped to this grid before any comparison, so a last-ULP
 *  sin/cos difference between Node and the browser cannot flip a branch. */
const QUANTUM = 1e-7;
const INV_QUANTUM = 1e7;
const CLEARANCE_RELAX = 0.45;
/** A clearance target finer than the sample grid cannot be met, so it means none. */
const CLEARANCE_FLOOR = QUANTUM;
/** Rung 2 re-solves against a finer polyline than the one it will be judged by. */
const REFINE_FACTOR = 2;
const REFINE_RES_MAX = 96;
const JOIN_EXEMPT_FACTOR = 0.05;
const JOIN_CLEARANCE_MULT = 3;
/** Safety factor on the joint sliver, so the chord pair is always exempt. */
const SLIVER_MARGIN = 1.5;
/**
 * Growth stops this far short of the boundary it found. The margin is invisible
 * (1e-5 of the domain) but two orders of magnitude above the sample quantum, so
 * a decision taken on quantized coordinates still holds for the drawn curve.
 */
const SAFE_BACKOFF = 1e-4;
const START_FRACTION_LO = 0.2;
const START_FRACTION_SPAN = 0.15;
const VIABLE_MIN = 0.004;
const TIGHT_MIN_FRACTION = 0.25;
const REACH_BASE = 0.65;
const REACH_SPAN = 0.35;
const CEILING_FACTOR = 2;
const COARSE_STEPS = [0.25, 0.5, 0.75];
const SHRINK = 0.82;
const PAIR_SHRINK = 0.9;
const PAIR_SIMILAR = 0.15;
const FLIP_CHANCE = 0.7;
const GLOBAL_SHRINK = 0.75;
const GLOBAL_SHRINK_ROUNDS = 4;
const SAFE_FLOOR = 0.004;
const NECK_FACTOR = 0.06;
const BEZIER_REACH = 4 / 3;
const DOMAIN_CENTER: Vec = { x: 0.5, y: 0.5 };

export type Proposal = { kDesired: number; preferredSide: 1 | -1 };

function biasVector(direction: Settings["biasDirection"], midpoint: Vec): Vec {
  // Screen coordinates: up is negative y.
  switch (direction) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    default: {
      const dx = midpoint.x - DOMAIN_CENTER.x;
      const dy = midpoint.y - DOMAIN_CENTER.y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-9) return { x: 0, y: 0 };
      const sign = direction === "inward" ? -1 : 1;
      return { x: (sign * dx) / length, y: (sign * dy) / length };
    }
  }
}

function drawRadius(settings: Settings, rng: Rng): number {
  const lo = Math.min(settings.radiusMin, settings.radiusMax);
  const hi = Math.max(settings.radiusMin, settings.radiusMax);
  switch (settings.radiusMode) {
    case "fixed":
      return settings.radiusScale;
    case "gaussian":
      return settings.radiusMean + gaussian(rng) * settings.radiusVariation;
    case "heavyTail":
      return lo + Math.pow(rng(), Math.max(1, settings.radiusTailPower)) * (hi - lo);
    default:
      return lo + rng() * (hi - lo);
  }
}

/**
 * The proposal phase: what the distribution wants for each edge, before any
 * geometry gets a vote. Side-mode chains run on preferred sides only, so a
 * feasibility flip downstream never perturbs the next edge's draw.
 */
export function proposeArcs(
  order: number[],
  points: Vec[],
  settings: Settings,
  rng: Rng,
): Proposal[] {
  const n = order.length;
  const out: Proposal[] = [];
  let side: 1 | -1 = 1;

  for (let i = 0; i < n; i++) {
    const a = points[order[i]];
    const b = points[order[(i + 1) % n]];
    const k = clamp(drawRadius(settings, rng), K_MIN, K_MAX);

    if (settings.arcSideMode === "same") {
      if (i === 0) side = rng() < 0.5 ? 1 : -1;
    } else if (settings.arcSideMode === "alternate") {
      side = i % 2 === 0 ? 1 : -1;
    } else if (settings.arcSideMode === "random") {
      side = rng() < 0.5 ? 1 : -1;
    } else if (settings.arcSideMode === "switchProbability") {
      if (i === 0) side = rng() < 0.5 ? 1 : -1;
      else if (rng() < settings.switchProbability) side = side === 1 ? -1 : 1;
    } else {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      // Bulge direction for side +1 is the left normal of the edge.
      const normal: Vec = { x: -dy / length, y: dx / length };
      const midpoint: Vec = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const bias = biasVector(settings.biasDirection, midpoint);
      const dot = bias.x * normal.x + bias.y * normal.y;
      const probability = clamp(0.5 + 0.5 * settings.biasStrength * dot, 0, 1);
      side = rng() < probability ? 1 : -1;
    }

    out.push({ kDesired: k, preferredSide: side });
  }

  return out;
}

type Arc = {
  index: number;
  a: Vec;
  b: Vec;
  length: number;
  kDesired: number;
  preferredSide: 1 | -1;
  side: 1 | -1;
  k: number;
  ceiling: number;
  kSafe: number;
  kSafeOpposite: number;
  samples: Vec[];
  box: Box;
};

type Ctx = {
  n: number;
  order: number[];
  vertices: Vec[];
  arcs: Arc[];
  clearance: number;
  reportClearance: number;
  style: Settings["curveStyle"];
  resolution: number;
  safeIters: number;
  /** Indexed by vertex position: how far from that joint the clearance test is waived. */
  jointRadius: number[];
};

type Offence = { i: number; j: number; crossing: boolean; deficit: number };

type Validation = {
  ok: boolean;
  hits: Vec[];
  clearanceViolations: number;
  minClearance: number;
  neckPairs: number;
  arcMin: number[];
  worst: Offence | null;
};

function quantize(value: number): number {
  return Math.round(value * INV_QUANTUM) / INV_QUANTUM;
}

/** D7: every coordinate the growth loop compares is snapped to the sample grid. */
function buildSamples(
  a: Vec,
  b: Vec,
  k: number,
  side: 1 | -1,
  resolution: number,
  style: Settings["curveStyle"],
): Vec[] {
  const raw = sampleArc(a, b, k, side, resolution, style);
  const out: Vec[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = { x: quantize(raw[i].x), y: quantize(raw[i].y) };
  }
  // Joints must stay shared exactly or adjacent arcs would read as a gap.
  out[0] = { x: a.x, y: a.y };
  out[raw.length - 1] = { x: b.x, y: b.y };
  return out;
}

function refresh(arc: Arc, ctx: Ctx): void {
  arc.samples = buildSamples(arc.a, arc.b, arc.k, arc.side, ctx.resolution, ctx.style);
  arc.box = polylineBox(arc.samples);
}

/** Vertex position the two arcs share, or -1 when they are not neighbours. */
function sharedJoint(i: number, j: number, n: number): number {
  if ((i + 1) % n === j) return j;
  if ((j + 1) % n === i) return i;
  return -1;
}

function nearJoint(p1: Vec, p2: Vec, v: Vec, radius: number): boolean {
  if (radius === Infinity) return true;
  return Math.hypot(p1.x - v.x, p1.y - v.y) <= radius || Math.hypot(p2.x - v.x, p2.y - v.y) <= radius;
}

/**
 * Baseline gap in the skeleton: the tightest non-adjacent chord pair and the
 * tightest vertex-to-non-incident-chord distance.
 */
function skeletonBaseline(vertices: Vec[]): number {
  const n = vertices.length;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (sharedJoint(i, j, n) >= 0) continue;
      const d = segmentSegmentDistance(a1, a2, vertices[j], vertices[(j + 1) % n]);
      if (d < best) best = d;
    }
    for (let p = 0; p < n; p++) {
      if (p === i || p === (i + 1) % n) continue;
      const d = pointSegmentDistance(vertices[p], a1, a2);
      if (d < best) best = d;
    }
  }
  return best === Infinity ? 1 : best;
}

/**
 * Two chords meeting at a sharp joint run within any clearance of each other for
 * a while, so the exemption has to reach past that sliver — otherwise no radius,
 * not even zero, would be feasible and the fallback ladder would have no floor.
 */
function jointRadii(vertices: Vec[], clearance: number): number[] {
  const n = vertices.length;
  const out = new Array<number>(n);
  for (let p = 0; p < n; p++) {
    const v = vertices[p];
    const prev = vertices[(p - 1 + n) % n];
    const next = vertices[(p + 1) % n];
    const d1 = Math.hypot(prev.x - v.x, prev.y - v.y);
    const d2 = Math.hypot(next.x - v.x, next.y - v.y);
    const shorter = Math.min(d1, d2);
    let radius = Math.max(JOIN_CLEARANCE_MULT * clearance, JOIN_EXEMPT_FACTOR * shorter);
    if (d1 > 1e-12 && d2 > 1e-12) {
      const cos = clamp(
        ((prev.x - v.x) * (next.x - v.x) + (prev.y - v.y) * (next.y - v.y)) / (d1 * d2),
        -1,
        1,
      );
      const sinHalf = Math.sin(Math.acos(cos) / 2);
      const reach = sinHalf < 1e-9 ? Infinity : (SLIVER_MARGIN * clearance) / (2 * sinHalf);
      if (reach > radius) radius = reach;
    }
    out[p] = radius;
  }
  return out;
}

/** Crossing anywhere, or a clearance breach outside the joint balls. */
function pairConflict(x: Arc, y: Arc, ctx: Ctx): boolean {
  const clearance = ctx.clearance;
  if (!boxesOverlap(x.box, y.box, clearance)) return false;
  const jointPos = sharedJoint(x.index, y.index, ctx.n);
  const joint = jointPos >= 0 ? ctx.vertices[jointPos] : null;
  const jointR = jointPos >= 0 ? ctx.jointRadius[jointPos] : 0;
  const sx = x.samples;
  const sy = y.samples;

  for (let i = 0; i + 1 < sx.length; i++) {
    const p1 = sx[i];
    const p2 = sx[i + 1];
    const bx = segmentBox(p1, p2);
    if (!boxesOverlap(bx, y.box, clearance)) continue;
    const exemptX = joint !== null && nearJoint(p1, p2, joint, jointR);
    for (let j = 0; j + 1 < sy.length; j++) {
      const p3 = sy[j];
      const p4 = sy[j + 1];
      if (!boxesOverlap(bx, segmentBox(p3, p4), clearance)) continue;
      if (segmentIntersects(p1, p2, p3, p4)) return true;
      if (clearance <= 0) continue;
      if (exemptX && nearJoint(p3, p4, joint as Vec, jointR)) continue;
      if (segmentSegmentDistance(p1, p2, p3, p4) < clearance) return true;
    }
  }
  return false;
}

function vertexConflict(arc: Arc, ctx: Ctx, positions: number[]): boolean {
  if (ctx.clearance <= 0) return false;
  for (const p of positions) {
    const d = pointPolylineDistance(ctx.vertices[p], arc.samples, ctx.clearance, arc.box);
    if (d < ctx.clearance) return true;
  }
  return false;
}

/** Both samplers stay inside this band, so it bounds every candidate up to `k`. */
function bandBox(arc: Arc, k: number, side: 1 | -1, style: Settings["curveStyle"]): Box {
  const dx = arc.b.x - arc.a.x;
  const dy = arc.b.y - arc.a.y;
  const length = arc.length || 1;
  const reach = k * arc.length * (style === "bezier" ? BEZIER_REACH : 1);
  const nx = (side * -dy) / length;
  const ny = (side * dx) / length;
  return polylineBox([
    arc.a,
    arc.b,
    { x: arc.a.x + nx * reach, y: arc.a.y + ny * reach },
    { x: arc.b.x + nx * reach, y: arc.b.y + ny * reach },
  ]);
}

/**
 * Largest radius on `side` that keeps the arc legal against current geometry.
 * Feasibility is not monotone in k — a bulge can jump a gap — so the coarse scan
 * finds the feasible prefix before the bisection refines it.
 */
function safeRadius(arc: Arc, side: 1 | -1, ceiling: number, ctx: Ctx): number {
  if (ceiling <= 0) return 0;
  const band = bandBox(arc, ceiling, side, ctx.style);
  const obstacles = ctx.arcs.filter(
    (other) => other.index !== arc.index && boxesOverlap(band, other.box, ctx.clearance),
  );
  const posFrom = arc.index;
  const posTo = (arc.index + 1) % ctx.n;
  const positions: number[] = [];
  for (let p = 0; p < ctx.n; p++) {
    if (p === posFrom || p === posTo) continue;
    if (pointInBox(ctx.vertices[p], band, ctx.clearance)) positions.push(p);
  }
  if (obstacles.length === 0 && positions.length === 0) return ceiling;

  const probe: Arc = { ...arc, side, k: 0, samples: [], box: band };
  const feasible = (k: number): boolean => {
    probe.k = k;
    probe.samples = buildSamples(arc.a, arc.b, k, side, ctx.resolution, ctx.style);
    probe.box = polylineBox(probe.samples);
    for (const other of obstacles) {
      if (pairConflict(probe, other, ctx)) return false;
    }
    return !vertexConflict(probe, ctx, positions);
  };

  if (feasible(ceiling)) return ceiling * (1 - SAFE_BACKOFF);

  // k = 0 is the chord, which the simple skeleton guarantees is legal.
  let lo = 0;
  let hi = ceiling;
  for (const fraction of COARSE_STEPS) {
    const k = fraction * ceiling;
    if (!feasible(k)) {
      hi = k;
      break;
    }
    lo = k;
  }
  for (let it = 0; it < ctx.safeIters; it++) {
    const mid = (lo + hi) / 2;
    if (feasible(mid)) lo = mid;
    else hi = mid;
  }
  return lo * (1 - SAFE_BACKOFF);
}

function shuffled(n: number, rng: Rng): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

/**
 * Which side to bulge. Both sides fitting the draw means the bias has nothing to
 * decide, so the preferred side wins; at bias 0 the draw is never second-guessed.
 */
function chooseSide(arc: Arc, ctx: Ctx, bias: number, factor: number, jitter: number): void {
  const rPref = safeRadius(arc, arc.preferredSide, arc.ceiling, ctx);
  const oppositeSide = (arc.preferredSide === 1 ? -1 : 1) as 1 | -1;
  const rOpp = safeRadius(arc, oppositeSide, arc.ceiling, ctx);
  const capPref = factor * rPref;
  const capOpp = factor * rOpp;
  arc.side = arc.preferredSide;
  arc.kSafe = rPref;
  arc.kSafeOpposite = rOpp;

  const takeOpposite = () => {
    arc.side = oppositeSide;
    arc.kSafe = rOpp;
    arc.kSafeOpposite = rPref;
  };

  if (capPref >= arc.kDesired && capOpp >= arc.kDesired) return;
  if (capPref < VIABLE_MIN && capOpp < VIABLE_MIN) {
    if (capOpp > capPref) takeOpposite();
    return;
  }
  if (bias === 0) return;

  const larger = Math.max(capPref, capOpp);
  if (larger < 1e-12) return;
  const rho = (capOpp - capPref) / larger;
  let pSwitch = 0;
  if (bias < 0 && rho > 0) {
    pSwitch = -bias * rho;
  } else if (bias > 0 && rho < 0) {
    // Necks, not flat edges: the tighter side still has to carry a real bulge.
    const floor = Math.max(VIABLE_MIN, TIGHT_MIN_FRACTION * arc.kDesired);
    if (capOpp >= floor) pSwitch = bias * -rho;
  }
  if (jitter < pSwitch) takeOpposite();
}

function growthTarget(arc: Arc, cap: number, aggressiveness: number): number {
  const reach = REACH_BASE + REACH_SPAN * aggressiveness;
  const room = reach * cap;
  const target = Math.min(arc.kDesired, room) + aggressiveness * Math.max(0, room - arc.kDesired);
  return Math.max(target, arc.k);
}

function grow(
  ctx: Ctx,
  seed: number,
  settings: Settings,
  passes: number,
  sideJitter: number[],
  growthJitter: number[],
): void {
  const aggressiveness = clamp(settings.bulgeAggressiveness, 0, 1);
  const factor = clamp(settings.safeRadiusFactor, 0.5, 1);
  const bias = clamp(settings.sideSpaceBias, -1, 1);

  for (const arc of ctx.arcs) {
    arc.k = 0;
    arc.ceiling = clamp(CEILING_FACTOR * arc.kDesired * (1 + aggressiveness), K_MIN, K_MAX);
    refresh(arc, ctx);
  }

  for (let pass = 1; pass <= passes; pass++) {
    const orderOfPlay = shuffled(ctx.n, rngFor(seed, 5, pass));
    for (const index of orderOfPlay) {
      const arc = ctx.arcs[index];
      if (pass === 1) {
        chooseSide(arc, ctx, bias, factor, sideJitter[index]);
      } else {
        arc.kSafe = safeRadius(arc, arc.side, arc.ceiling, ctx);
      }
      const target = growthTarget(arc, factor * arc.kSafe, aggressiveness);
      let next: number;
      if (pass === 1) {
        const start =
          passes === 1 ? 1 : START_FRACTION_LO + START_FRACTION_SPAN * growthJitter[index];
        next = target * start;
      } else {
        next = arc.k + (target - arc.k) / (passes - pass + 1);
      }
      if (next > arc.k) {
        arc.k = next;
        refresh(arc, ctx);
      }
    }
  }
}

/**
 * The hard check. It runs on the unsnapped samples at the resolution the shape
 * is drawn with, because the certificate has to cover the polyline a viewer
 * actually sees rather than the solver's rounded picture of it. Arc-structured
 * and box-rejected, which is what makes it affordable inside the generate loop.
 */
function validateArcs(ctx: Ctx, resolution: number): Validation {
  const n = ctx.n;
  const samples: Vec[][] = [];
  const boxes: Box[] = [];
  for (const arc of ctx.arcs) {
    const s = sampleArc(arc.a, arc.b, arc.k, arc.side, resolution, ctx.style);
    samples.push(s);
    boxes.push(polylineBox(s));
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    if (box.minX < minX) minX = box.minX;
    if (box.minY < minY) minY = box.minY;
    if (box.maxX > maxX) maxX = box.maxX;
    if (box.maxY > maxY) maxY = box.maxY;
  }
  const neckThreshold = NECK_FACTOR * Math.hypot(maxX - minX, maxY - minY);
  // The clearance stat saturates here; anything farther only reads as "roomy".
  const measure = Math.max(ctx.clearance, ctx.reportClearance) * 4 + 1e-6;

  const hits: Vec[] = [];
  const arcMin = new Array<number>(n).fill(Infinity);
  let clearanceViolations = 0;
  let neckPairs = 0;
  let minClearance = measure;
  let crossing: Offence | null = null;
  let tightest: Offence | null = null;

  const record = (offence: Offence) => {
    if (offence.crossing) {
      if (crossing === null) crossing = offence;
      return;
    }
    if (tightest === null || offence.deficit > tightest.deficit) tightest = offence;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!boxesOverlap(boxes[i], boxes[j], Math.max(measure, neckThreshold))) continue;
      const jointPos = sharedJoint(i, j, n);
      const joint = jointPos >= 0 ? ctx.vertices[jointPos] : null;
      const jointR = jointPos >= 0 ? ctx.jointRadius[jointPos] : 0;
      const si = samples[i];
      const sj = samples[j];
      let pairMin = Infinity;
      let crossed = false;

      for (let p = 0; p + 1 < si.length; p++) {
        const p1 = si[p];
        const p2 = si[p + 1];
        const bp = segmentBox(p1, p2);
        if (!boxesOverlap(bp, boxes[j], measure)) continue;
        const exemptI = joint !== null && nearJoint(p1, p2, joint, jointR);
        for (let q = 0; q + 1 < sj.length; q++) {
          const p3 = sj[q];
          const p4 = sj[q + 1];
          if (!boxesOverlap(bp, segmentBox(p3, p4), measure)) continue;
          const hit = segmentIntersectionPoint(p1, p2, p3, p4);
          if (hit) {
            hits.push(hit);
            crossed = true;
            continue;
          }
          if (exemptI && nearJoint(p3, p4, joint as Vec, jointR)) continue;
          const d = segmentSegmentDistance(p1, p2, p3, p4);
          if (d < pairMin) pairMin = d;
        }
      }

      if (crossed) record({ i, j, crossing: true, deficit: Infinity });
      if (pairMin === Infinity) continue;
      if (pairMin < arcMin[i]) arcMin[i] = pairMin;
      if (pairMin < arcMin[j]) arcMin[j] = pairMin;
      if (pairMin < minClearance) minClearance = pairMin;
      if (pairMin < ctx.clearance) {
        clearanceViolations++;
        record({ i, j, crossing: false, deficit: ctx.clearance - pairMin });
      }
      if (jointPos < 0 && pairMin < neckThreshold) neckPairs++;
    }
  }

  for (let i = 0; i < n; i++) {
    const posFrom = i;
    const posTo = (i + 1) % n;
    for (let p = 0; p < n; p++) {
      if (p === posFrom || p === posTo) continue;
      const d = pointPolylineDistance(ctx.vertices[p], samples[i], measure, boxes[i]);
      if (d === Infinity) continue;
      if (d < arcMin[i]) arcMin[i] = d;
      if (d < minClearance) minClearance = d;
      if (d < ctx.clearance) {
        clearanceViolations++;
        record({ i, j: -1, crossing: false, deficit: ctx.clearance - d });
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (arcMin[i] === Infinity) arcMin[i] = measure;
  }

  return {
    ok: hits.length === 0 && clearanceViolations === 0,
    hits,
    clearanceViolations,
    minClearance,
    neckPairs,
    arcMin,
    worst: crossing ?? tightest,
  };
}

/**
 * Local repairs on the worst offence: flip the tighter arc when the other side
 * has more room, otherwise take radius off whichever arc is carrying it.
 */
function repair(
  ctx: Ctx,
  resolution: number,
  budget: number,
  factor: number,
  repairJitter: number[],
  start: Validation,
): { validation: Validation; repairs: number } {
  let validation = start;
  let repairs = 0;

  while (repairs < budget && !validation.ok && validation.worst !== null) {
    const { i, j } = validation.worst;
    const arcI = ctx.arcs[i];
    const arcJ = j >= 0 ? ctx.arcs[j] : null;
    const tighter = arcJ !== null && arcJ.k < arcI.k ? arcJ : arcI;
    let acted = false;

    if (repairJitter[repairs % repairJitter.length] < FLIP_CHANCE) {
      const other = (tighter.side === 1 ? -1 : 1) as 1 | -1;
      const room = factor * safeRadius(tighter, other, tighter.ceiling, ctx);
      if (room > tighter.k) {
        const previous = tighter.kSafe;
        tighter.side = other;
        tighter.kSafeOpposite = previous;
        tighter.kSafe = room / factor;
        refresh(tighter, ctx);
        acted = true;
      }
    }

    if (!acted) {
      if (arcJ === null) {
        arcI.k *= SHRINK;
        refresh(arcI, ctx);
      } else if (Math.abs(arcI.k - arcJ.k) <= PAIR_SIMILAR * Math.max(arcI.k, arcJ.k)) {
        arcI.k *= PAIR_SHRINK;
        arcJ.k *= PAIR_SHRINK;
        refresh(arcI, ctx);
        refresh(arcJ, ctx);
      } else {
        const larger = arcI.k > arcJ.k ? arcI : arcJ;
        larger.k *= SHRINK;
        refresh(larger, ctx);
      }
    }

    repairs++;
    validation = validateArcs(ctx, resolution);
  }

  return { validation, repairs };
}

function setAll(ctx: Ctx, k: number): void {
  for (const arc of ctx.arcs) {
    arc.k = k;
    refresh(arc, ctx);
  }
}

function scaleAll(ctx: Ctx, factor: number): void {
  for (const arc of ctx.arcs) {
    arc.k *= factor;
    refresh(arc, ctx);
  }
}

export type SolveResult = {
  arcs: ArcProps[];
  report: ConstraintReport;
  hits: Vec[];
  attempts: number;
};

export function solveArcs(
  seed: number,
  points: Vec[],
  order: number[],
  settings: Settings,
): SolveResult {
  const n = order.length;
  const vertices = order.map((index) => points[index]);
  const proposals = proposeArcs(order, points, settings, rngFor(seed, 3, 0));

  const jitterRng = rngFor(seed, 4, 0);
  const sideJitter = new Array<number>(n);
  const growthJitter = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    sideJitter[i] = jitterRng();
    growthJitter[i] = jitterRng();
  }

  const repairBudget = Math.max(1, Math.round(settings.maxArcRepairAttempts));
  const repairRng = rngFor(seed, 6, 0);
  const repairJitter = new Array<number>(repairBudget);
  for (let i = 0; i < repairBudget; i++) repairJitter[i] = repairRng();

  // D4: one shape-wide threshold, relaxed when the skeleton itself is tight.
  const baseline = skeletonBaseline(vertices);
  const requested = Math.max(0, Math.min(settings.minimumClearance, CLEARANCE_RELAX * baseline));
  const clearance = requested < CLEARANCE_FLOOR ? 0 : requested;
  // The polyline the solver reasons about has to be the one that gets drawn:
  // two arcs can leave a shared joint without crossing at one sample count and
  // cross at a finer one, which no radius margin can anticipate.
  const renderResolution = Math.max(4, Math.round(settings.arcResolution));
  const solveResolution = renderResolution;
  const passes = clamp(Math.round(settings.curveGrowthPasses), 1, 12);
  const factor = clamp(settings.safeRadiusFactor, 0.5, 1);

  const arcs: Arc[] = [];
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    arcs.push({
      index: i,
      a,
      b,
      length: Math.hypot(b.x - a.x, b.y - a.y),
      kDesired: proposals[i].kDesired,
      preferredSide: proposals[i].preferredSide,
      side: proposals[i].preferredSide,
      k: 0,
      ceiling: 0,
      kSafe: 0,
      kSafeOpposite: 0,
      samples: [],
      box: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    });
  }

  const ctx: Ctx = {
    n,
    order,
    vertices,
    arcs,
    clearance,
    reportClearance: Math.max(0, settings.minimumClearance),
    style: settings.curveStyle,
    resolution: solveResolution,
    safeIters: clamp(Math.round(settings.safeRadiusSearchIterations), 4, 20),
    jointRadius: jointRadii(vertices, clearance),
  };

  grow(ctx, seed, settings, passes, sideJitter, growthJitter);
  let validation = validateArcs(ctx, renderResolution);
  let fallbackLevel = 0;
  let repairs = 0;
  let attempts = 1;
  let usedResolution = solveResolution;

  if (!validation.ok) {
    fallbackLevel = 1;
    const first = repair(ctx, renderResolution, repairBudget, factor, repairJitter, validation);
    validation = first.validation;
    repairs += first.repairs;
  }

  if (!validation.ok) {
    // D6: an invalid result is a sampling artifact, so re-solve against a finer
    // polyline rather than re-drawing the proposals.
    fallbackLevel = 2;
    attempts = 2;
    usedResolution = Math.min(REFINE_FACTOR * renderResolution, REFINE_RES_MAX);
    ctx.resolution = usedResolution;
    grow(ctx, seed, settings, passes, sideJitter, growthJitter);
    validation = validateArcs(ctx, renderResolution);
    if (!validation.ok) {
      const second = repair(ctx, renderResolution, repairBudget, factor, repairJitter, validation);
      validation = second.validation;
      repairs += second.repairs;
    }
  }

  if (!validation.ok) {
    fallbackLevel = 3;
    for (let round = 0; round < GLOBAL_SHRINK_ROUNDS && !validation.ok; round++) {
      scaleAll(ctx, GLOBAL_SHRINK);
      validation = validateArcs(ctx, renderResolution);
    }
  }

  if (!validation.ok) {
    fallbackLevel = 4;
    setAll(ctx, SAFE_FLOOR);
    validation = validateArcs(ctx, renderResolution);
  }

  if (!validation.ok) {
    // The silhouette is the skeleton polygon, which is simple by construction.
    fallbackLevel = 5;
    setAll(ctx, 0);
    validation = validateArcs(ctx, renderResolution);
  }

  const reports: ArcReport[] = [];
  let utilizationSum = 0;
  let maxUtilization = 0;
  let constrainedCount = 0;
  let sideFlipCount = 0;

  for (let i = 0; i < n; i++) {
    const arc = arcs[i];
    const cap = factor * arc.kSafe;
    const utilization = cap > 1e-9 ? clamp(arc.k / cap, 0, 1) : arc.k > 1e-9 ? 1 : 0;
    const constrained = arc.k < arc.kDesired - 1e-9;
    const flipped = arc.side !== arc.preferredSide;
    utilizationSum += utilization;
    if (utilization > maxUtilization) maxUtilization = utilization;
    if (constrained) constrainedCount++;
    if (flipped) sideFlipCount++;
    reports.push({
      edge: i,
      from: order[i],
      to: order[(i + 1) % n],
      length: arc.length,
      side: arc.side,
      preferredSide: arc.preferredSide,
      sideFlipped: flipped,
      kDesired: arc.kDesired,
      kActual: arc.k,
      kSafe: arc.kSafe,
      kSafeOpposite: arc.kSafeOpposite,
      utilization,
      constrained,
      minClearance: validation.arcMin[i],
    });
  }

  return {
    arcs: arcs.map((arc) => ({ k: arc.k, side: arc.side })),
    hits: validation.hits,
    attempts,
    report: {
      arcs: reports,
      effectiveClearance: clearance,
      minClearance: validation.minClearance,
      meanUtilization: n === 0 ? 0 : utilizationSum / n,
      maxUtilization,
      constrainedCount,
      sideFlipCount,
      neckPairs: validation.neckPairs,
      repairs,
      fallbackLevel,
      untangleIterations: 0,
      pointRetries: 0,
      growthPasses: passes,
      solveResolution: usedResolution,
      clearanceViolations: validation.clearanceViolations,
      valid: validation.ok,
    },
  };
}
