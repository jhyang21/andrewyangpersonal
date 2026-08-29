import { toPolylinePathD, toSvgPathD } from "@/lib/shape-lab/engine";
import { restPose, rotateAbout } from "@/lib/shape-lab/rest";
import { sampleArc } from "@/lib/shape-lab/silhouette";
import type { Shape, Vec, VizToggles } from "@/lib/shape-lab/types";

type Props = { shape: Shape; viz: VizToggles };

/** Free space around the drawn extent, as a fraction of the larger viewBox dimension. */
const PAD = 0.08;
/** How far below the lowest silhouette point the contact bar is drawn. */
const CONTACT_DROP = 0.04;
/** How far past the drawing each end of the ground line runs. Kept under PAD so it never clips. */
const GROUND_OVERHANG = 0.05;

/*
 * A knotted silhouette can self-cross in the hundreds, and every hit is one more circle in the DOM
 * for no extra information. The count is reported exactly in the stats panel; only the drawing is
 * capped.
 */
const MAX_HIT_MARKERS = 400;

/** The corners of the domain square, needed as points once the drawing can be turned. */
const UNIT_SQUARE: Vec[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function midpoint(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/*
 * Every coordinate that reaches the markup goes through this. Math.sin/cos may differ in the last
 * ULP between the server's and the browser's JS engine, and React flags that one-digit difference
 * as a hydration mismatch. Rounding to the silhouette path's own precision makes SSR and client
 * output byte-identical.
 */
function f(value: number): number {
  return Number(value.toFixed(4));
}

export function Viewport({ shape, viz }: Props) {
  const box = shape.metrics.bbox;
  const contact = shape.metrics.contact;
  const pivot = shape.metrics.centroid;

  /*
   * The resting pose turns the whole drawing about the centroid, so every extent below has to be
   * measured on the turned copy rather than on the stored bounding box. The angle is rounded up
   * front because the markup carries the rounded one: measure against the angle actually drawn.
   */
  const pose = viz.balancedPose ? restPose(shape.silhouette, pivot) : null;
  const angle = pose ? f(pose.angleDeg) : 0;

  let minX = box.minX;
  let minY = box.minY;
  let maxX = box.maxX;
  let maxY = box.maxY;

  const extend = (p: Vec) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };

  if (pose) {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (const p of shape.silhouette) extend(rotateAbout(p, pivot, angle));
  }

  if (viz.domainSquare) {
    if (pose) {
      // The square is drawn inside the turned group, so it is the turned corners that must fit.
      for (const corner of UNIT_SQUARE) extend(rotateAbout(corner, pivot, angle));
    } else {
      minX = Math.min(minX, 0);
      minY = Math.min(minY, 0);
      maxX = Math.max(maxX, 1);
      maxY = Math.max(maxY, 1);
    }
  }

  // The bar hangs below the shape, so the room for it is measured against the extent so far.
  const reach = Math.max(maxX - minX, maxY - minY, 1e-6);
  const contactY = contact.y + CONTACT_DROP * reach;
  if (viz.contactRegion) {
    if (pose) {
      // The bar turns with the scene, so room under the shape is room on the wrong side.
      extend(rotateAbout({ x: contact.minX, y: contactY }, pivot, angle));
      extend(rotateAbout({ x: contact.maxX, y: contactY }, pivot, angle));
    } else {
      maxY = Math.max(maxY, contactY);
    }
  }

  /*
   * The ground sits the same drop below the centroid at any angle: the turn is about the centroid,
   * which moves neither it nor its distance to the resting edge.
   */
  const groundY = pose ? pivot.y + pose.height : 0;
  if (pose) maxY = Math.max(maxY, groundY);

  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  // One length that every marker and label is sized against, so they stay proportionate at any zoom.
  const unit = Math.max(width, height);
  const pad = PAD * unit;
  const viewBox = [minX - pad, minY - pad, width + 2 * pad, height + 2 * pad].map(f).join(" ");

  const dot = f(0.009 * unit);
  const hit = f(0.014 * unit);
  const arm = f(0.035 * unit);
  const tick = f(0.014 * unit);
  const labelSize = f(0.028 * unit);

  const pathD = toSvgPathD(shape.silhouette);
  const order = shape.pathOrder;
  const n = order.length;

  const skeleton = order
    .map((index) => `${shape.points[index].x.toFixed(4)},${shape.points[index].y.toFixed(4)}`)
    .join(" ");

  const axes = order.map((index, i) => {
    const a = shape.points[index];
    const b = shape.points[order[(i + 1) % n]];
    const arc = shape.arcs[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    // Side +1 bulges along the left normal of the edge; the engine builds the ellipse the same way.
    const normal: Vec = { x: -dy / length, y: dx / length };
    const centre = midpoint(a, b);
    const reachOut = arc.k * length * arc.side;
    return {
      key: `${index}-${i}`,
      a: { x: f(a.x), y: f(a.y) },
      b: { x: f(b.x), y: f(b.y) },
      centre: { x: f(centre.x), y: f(centre.y) },
      tip: { x: f(centre.x + normal.x * reachOut), y: f(centre.y + normal.y * reachOut) },
    };
  });

  const construction = order.map((index, i) => {
    const a = shape.points[index];
    const b = shape.points[order[(i + 1) % n]];
    const arc = shape.constraints.arcs[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    // Side +1 bulges along the left normal of the edge; the engine builds the ellipse the same way.
    const normal: Vec = { x: -dy / length, y: dx / length };
    const centre = midpoint(a, b);
    const desiredReach = arc.side * arc.kDesired * length;
    const actualReach = arc.side * arc.kActual * length;
    const envelope = sampleArc(a, b, arc.kSafe, arc.side, 16, shape.settings.curveStyle);
    return {
      key: `${index}-${i}`,
      saturated: arc.utilization >= 0.95,
      envelope: toPolylinePathD(envelope),
      centre: { x: f(centre.x), y: f(centre.y) },
      desiredTip: {
        x: f(centre.x + normal.x * desiredReach),
        y: f(centre.y + normal.y * desiredReach),
      },
      actualTip: {
        x: f(centre.x + normal.x * actualReach),
        y: f(centre.y + normal.y * actualReach),
      },
    };
  });

  const centroid = { x: f(pivot.x), y: f(pivot.y) };
  const hits = shape.silhouetteIntersections.slice(0, MAX_HIT_MARKERS);

  // The overhang stays inside the pad, so the line always ends short of the viewBox edge.
  const ground = pose
    ? {
        y: f(groundY),
        x1: f(minX - GROUND_OVERHANG * unit),
        x2: f(maxX + GROUND_OVERHANG * unit),
      }
    : null;
  const poseTransform = pose ? `rotate(${angle} ${centroid.x} ${centroid.y})` : undefined;

  const scene = (
    <>
      {viz.domainSquare && (
        <g className="sl-layer-domain">
          <rect x={0} y={0} width={1} height={1} />
        </g>
      )}

      {viz.boundingBox && (
        <g className="sl-layer-bbox">
          <rect x={f(box.minX)} y={f(box.minY)} width={f(box.width)} height={f(box.height)} />
        </g>
      )}

      {viz.ellipseAxes && (
        <g className="sl-layer-axes">
          {axes.map((axis) => (
            <g key={axis.key}>
              <line
                className="sl-axis-major"
                x1={axis.a.x}
                y1={axis.a.y}
                x2={axis.b.x}
                y2={axis.b.y}
              />
              <line
                className="sl-axis-minor"
                x1={axis.centre.x}
                y1={axis.centre.y}
                x2={axis.tip.x}
                y2={axis.tip.y}
              />
            </g>
          ))}
        </g>
      )}

      {viz.construction && (
        <g className="sl-layer-construction">
          {construction.map((c) => (
            <g key={c.key} className={c.saturated ? "is-saturated" : undefined}>
              <path className="sl-safe-envelope" d={c.envelope} />
              <line
                className="sl-desired"
                x1={c.centre.x}
                y1={c.centre.y}
                x2={c.desiredTip.x}
                y2={c.desiredTip.y}
              />
              <circle cx={c.desiredTip.x} cy={c.desiredTip.y} r={dot} />
              <line
                className="sl-actual"
                x1={c.centre.x}
                y1={c.centre.y}
                x2={c.actualTip.x}
                y2={c.actualTip.y}
              />
              <circle className="sl-actual-dot" cx={c.actualTip.x} cy={c.actualTip.y} r={dot} />
            </g>
          ))}
        </g>
      )}

      {viz.skeleton && (
        <g className="sl-layer-skeleton">
          <polygon points={skeleton} />
        </g>
      )}

      {viz.fillSilhouette && (
        <g className="sl-layer-fill">
          <path d={pathD} fillRule="evenodd" />
        </g>
      )}

      {viz.silhouette && (
        <g className="sl-layer-outline">
          <path d={pathD} />
        </g>
      )}

      {viz.contactRegion && (
        <g className="sl-layer-contact">
          <line x1={f(contact.minX)} y1={f(contactY)} x2={f(contact.maxX)} y2={f(contactY)} />
          <line
            x1={f(contact.minX)}
            y1={f(contactY - tick)}
            x2={f(contact.minX)}
            y2={f(contactY + tick)}
          />
          <line
            x1={f(contact.maxX)}
            y1={f(contactY - tick)}
            x2={f(contact.maxX)}
            y2={f(contactY + tick)}
          />
        </g>
      )}

      {viz.centroid && (
        <g className="sl-layer-centroid">
          <line x1={f(centroid.x - arm)} y1={centroid.y} x2={f(centroid.x + arm)} y2={centroid.y} />
          <line x1={centroid.x} y1={f(centroid.y - arm)} x2={centroid.x} y2={f(centroid.y + arm)} />
          <circle cx={centroid.x} cy={centroid.y} r={dot} />
        </g>
      )}

      {viz.points && (
        <g className="sl-layer-points">
          {shape.points.map((point, index) => (
            <g key={index}>
              <circle cx={f(point.x)} cy={f(point.y)} r={dot} />
              {viz.pointLabels && (
                <text x={f(point.x + dot * 1.8)} y={f(point.y - dot * 1.4)} fontSize={labelSize}>
                  {index}
                </text>
              )}
            </g>
          ))}
        </g>
      )}

      {viz.intersections && hits.length > 0 && (
        <g className="sl-layer-hits">
          {hits.map((point, index) => (
            <circle key={index} cx={f(point.x)} cy={f(point.y)} r={hit} />
          ))}
        </g>
      )}
    </>
  );

  return (
    <svg
      className="sl-viewport"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Generated silhouette from seed ${shape.seed}, precariousness ${shape.metrics.precariousness.toFixed(
        1,
      )} out of 100. Every number behind the drawing is listed in the readout below it.`}
    >
      {/* Remounted on every new shape, which is what restarts the fade. Geometry never interpolates. */}
      <g className="sl-scene">
        {poseTransform ? <g transform={poseTransform}>{scene}</g> : scene}

        {ground && (
          <g className="sl-layer-ground">
            <line x1={ground.x1} y1={ground.y} x2={ground.x2} y2={ground.y} />
          </g>
        )}
      </g>
    </svg>
  );
}
