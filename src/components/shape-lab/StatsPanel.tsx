import type { Shape } from "@/lib/shape-lab/types";

type Props = {
  shape: Shape;
  onExport: () => void;
  onCopy: () => void;
  copied: boolean;
};

/** Perimeter of the straight-line tour, before the edges are bulged into half-ellipses. */
function skeletonLength(shape: Shape): number {
  const order = shape.pathOrder;
  const n = order.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = shape.points[order[i]];
    const b = shape.points[order[(i + 1) % n]];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

const dec = (value: number, places = 4) => value.toFixed(places);

export function StatsPanel({ shape, onExport, onCopy, copied }: Props) {
  const m = shape.metrics;
  const c = shape.constraints;
  const maxWeight = m.precariousnessParts.reduce((best, part) => Math.max(best, part.weight), 1);
  const aspect = m.bbox.height / Math.max(m.bbox.width, 1e-9);

  // Third slot flags a row for warn styling — reserved for the crossing counts, which should
  // always read zero; a non-zero value here means the solver's hard guarantee didn't hold.
  const rows: [string, string, boolean?][] = [
    ["Seed", String(shape.seed)],
    ["Points", String(shape.points.length)],
    ["Path length", dec(skeletonLength(shape))],
    ["Path crossings", String(shape.pathIntersections), !c.valid],
    ["Self-intersections", String(shape.silhouetteIntersections.length), !c.valid],
    ["Min clearance", dec(c.minClearance)],
    ["Clearance target", dec(c.effectiveClearance)],
    ["Avg utilization", dec(c.meanUtilization, 3)],
    ["Max utilization", dec(c.maxUtilization, 3)],
    ["Constrained arcs", `${c.constrainedCount} / ${c.arcs.length}`],
    ["Side flips", String(c.sideFlipCount)],
    ["Arc repairs", String(c.repairs)],
    ["Attempts used", String(shape.attemptsUsed)],
    ["Area", dec(m.area)],
    ["Width", dec(m.bbox.width)],
    ["Height", dec(m.bbox.height)],
    ["Aspect (h/w)", dec(aspect, 3)],
    ["Centroid x", dec(m.centroid.x)],
    ["Centroid y", dec(m.centroid.y)],
    ["Contact width", dec(m.contact.width)],
    ["Centroid offset", dec(m.centroidOffset, 3)],
    ["Asymmetry", dec(m.asymmetry, 3)],
    ["Top heavy", dec(m.topHeavyScore, 3)],
  ];

  return (
    <section className="sl-stats" aria-label="Shape readout">
      <div className="sl-score">
        <span className="sl-field-label">Precariousness</span>
        <div className="sl-score-value">{m.precariousness.toFixed(1)}</div>
        <p className="sl-score-note">
          out of 100 · centre of area {m.supported ? "over" : "outside"} the contact span
        </p>
        <div className="sl-score-actions">
          <button type="button" className="sl-btn" onClick={onExport}>
            Export SVG
          </button>
          <button type="button" className="sl-btn" onClick={onCopy}>
            {copied ? "Copied" : "Copy SVG path"}
          </button>
        </div>
      </div>

      <div className="sl-parts">
        <span className="sl-field-label">Score components</span>
        {m.precariousnessParts.map((part) => (
          <div className="sl-part" key={part.label}>
            <span className="sl-part-label">{part.label}</span>
            <span className="sl-part-value">
              {(part.value * part.weight).toFixed(1)} / {part.weight}
            </span>
            {/* Track width carries the weight, fill carries how much of it this shape earned. */}
            <div className="sl-bar">
              <div
                className="sl-bar-track"
                style={{ width: `${(part.weight / maxWeight) * 100}%` }}
              >
                <div className="sl-bar-fill" style={{ width: `${part.value * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sl-measures">
        <span className="sl-field-label">Measurements</span>
        <dl className="sl-statlist">
          {rows.map(([label, value, warn]) => (
            <div className={"sl-stat" + (warn ? " is-warn" : "")} key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
