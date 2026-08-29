import { clamp, type Settings, type Vec } from "./types";
import { gaussian, type Rng } from "./rng";

/** Exponent below 1 pushes a centred draw outwards, thickening both edges. */
const EDGE_POWER = 0.45;
const CLUSTER_SIGMA = 0.07;
const COINCIDENT_EPSILON = 1e-6;
const NUDGE = 1e-4;

function draw(rng: Rng, lo: number, span: number): number {
  return lo + rng() * span;
}

function pushOutward(u: number): number {
  const centred = 2 * u - 1;
  const pushed = Math.sign(centred) * Math.pow(Math.abs(centred), EDGE_POWER);
  return (pushed + 1) / 2;
}

export function generatePoints(settings: Settings, rng: Rng): Vec[] {
  const margin = clamp(settings.margin, 0, 0.45);
  const lo = margin;
  const span = Math.max(1 - 2 * margin, 1e-6);
  const count = Math.max(3, Math.round(settings.pointCount));
  const points: Vec[] = [];

  if (settings.pointDistribution === "clustered") {
    const clusters = Math.max(1, Math.round(settings.clusterCount));
    const centers: Vec[] = [];
    for (let i = 0; i < clusters; i++) {
      centers.push({ x: draw(rng, lo, span), y: draw(rng, lo, span) });
    }
    for (let i = 0; i < count; i++) {
      const center = centers[Math.min(clusters - 1, Math.floor(rng() * clusters))];
      points.push({
        x: clamp(center.x + gaussian(rng) * CLUSTER_SIGMA, lo, lo + span),
        y: clamp(center.y + gaussian(rng) * CLUSTER_SIGMA, lo, lo + span),
      });
    }
  } else {
    for (let i = 0; i < count; i++) {
      if (settings.pointDistribution === "center") {
        points.push({
          x: lo + ((rng() + rng()) / 2) * span,
          y: lo + ((rng() + rng()) / 2) * span,
        });
      } else if (settings.pointDistribution === "edge") {
        points.push({
          x: lo + pushOutward(rng()) * span,
          y: lo + pushOutward(rng()) * span,
        });
      } else {
        points.push({ x: draw(rng, lo, span), y: draw(rng, lo, span) });
      }
    }
  }

  // Zero-length edges break the half-ellipse frame, so separate coincident points.
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      if (Math.hypot(dx, dy) < COINCIDENT_EPSILON) {
        points[j] = { x: points[j].x + NUDGE, y: points[j].y + NUDGE };
      }
    }
  }

  return points;
}
