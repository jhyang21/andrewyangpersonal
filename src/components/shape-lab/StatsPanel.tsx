import { useId } from "react";
import { PART_DESCRIPTIONS } from "@/lib/shape-lab/balance";
import type { Shape } from "@/lib/shape-lab/types";
import { Info } from "./controls";

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

/** One measurement row: `warn` styling is reserved for the two crossing counts. */
type Row = { label: string; value: string; tip: string; warn?: boolean };

export function StatsPanel({ shape, onExport, onCopy, copied }: Props) {
  const m = shape.metrics;
  const c = shape.constraints;
  const tipId = useId();
  const maxWeight = m.precariousnessParts.reduce((best, part) => Math.max(best, part.weight), 1);
  const aspect = m.bbox.height / Math.max(m.bbox.width, 1e-9);

  // The two crossing counts should always read zero; a non-zero value there means the solver's
  // hard guarantee didn't hold, which is what the warn styling says out loud.
  const rows: Row[] = [
    {
      label: "Seed",
      value: String(shape.seed),
      tip: "The number the whole shape is built from. The same seed and the same settings always redraw the same shape.",
    },
    {
      label: "Points",
      value: String(shape.points.length),
      tip: "How many points the outline visits. Locking the points holds this steady while the other dials move.",
    },
    {
      label: "Path length",
      value: dec(skeletonLength(shape)),
      tip: "The distance around the straight-line tour through the points, before any edge bulges out.",
    },
    {
      label: "Path crossings",
      value: String(shape.pathIntersections),
      tip: "How many times the straight-line tour cuts across itself. It must read 0 — every tour is untangled before its edges are curved.",
      warn: !c.valid,
    },
    {
      label: "Self-intersections",
      value: String(shape.silhouetteIntersections.length),
      tip: "How many times the finished outline cuts across itself. It must read 0, which is what the cap on every bulge guarantees.",
      warn: !c.valid,
    },
    {
      label: "Min clearance",
      value: dec(c.minClearance),
      tip: "The narrowest gap anywhere between two stretches of the outline.",
    },
    {
      label: "Clearance target",
      value: dec(c.effectiveClearance),
      tip: "The gap the solver aimed to keep. It falls below the dial when the points sit too close together to honour it.",
    },
    {
      label: "Avg utilization",
      value: dec(c.meanUtilization, 3),
      tip: "How much of its available room the average curve took, from 0 to 1. Near 1 the curves are pressed to their limit.",
    },
    {
      label: "Max utilization",
      value: dec(c.maxUtilization, 3),
      tip: "How much of its available room the single tightest curve took, rather than the average.",
    },
    {
      label: "Constrained arcs",
      value: `${c.constrainedCount} / ${c.arcs.length}`,
      tip: "How many edges were held short of the bulge they asked for, out of all the edges.",
    },
    {
      label: "Side flips",
      value: String(c.sideFlipCount),
      tip: "How many edges bulged the opposite way from the one they drew, because that side had more room.",
    },
    {
      label: "Arc repairs",
      value: String(c.repairs),
      tip: "How many times the solver stepped in to part two curves that had run into each other.",
    },
    {
      label: "Attempts used",
      value: String(shape.attemptsUsed),
      tip: "How many scatters of points it took to reach a clean tour. 1 means the first scatter worked.",
    },
    {
      label: "Area",
      value: dec(m.area),
      tip: "The area the outline encloses. The square the points fall in has an area of 1.",
    },
    { label: "Width", value: dec(m.bbox.width), tip: "How wide the shape is at its widest." },
    { label: "Height", value: dec(m.bbox.height), tip: "How tall the shape is at its tallest." },
    {
      label: "Aspect (h/w)",
      value: dec(aspect, 3),
      tip: "Height divided by width. Above 1 the shape stands; below 1 it lies down.",
    },
    {
      label: "Centroid x",
      value: dec(m.centroid.x),
      tip: "Where the centre of area sits across the shape.",
    },
    {
      label: "Centroid y",
      value: dec(m.centroid.y),
      tip: "Where the centre of area sits up the shape. The number grows downward, so a larger value means lower.",
    },
    {
      label: "Contact width",
      value: dec(m.contact.width),
      tip: "The span the shape stands on. A small number is a small foot.",
    },
    {
      label: "Centroid offset",
      value: dec(m.centroidOffset, 3),
      tip: "How far the centre of area leans from the middle of the span the shape stands on, from 0 to 1.",
    },
    {
      label: "Asymmetry",
      value: dec(m.asymmetry, 3),
      tip: "How unevenly the area splits either side of the centre, from 0 for matching halves to 1.",
    },
    {
      label: "Top heavy",
      value: dec(m.topHeavyScore, 3),
      tip: "The share of the area above the halfway line, from 0 to 1.",
    },
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
            {/* Label and icon share one grid cell, so the bar below still spans both columns. */}
            <span className="sl-part-head">
              <span className="sl-part-label">{part.label}</span>
              <Info label={part.label} description={PART_DESCRIPTIONS[part.label]} />
            </span>
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
          {/*
            No icon here — the row itself is the target. It is tabbable so a phone tap and a Tab
            both reach the description, which hover alone would not give them.
          */}
          {rows.map((row, index) => (
            <div
              className={"sl-stat" + (row.warn ? " is-warn" : "")}
              key={row.label}
              tabIndex={0}
              aria-describedby={`${tipId}-${index}`}
            >
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
              <span id={`${tipId}-${index}`} role="tooltip" className="sl-tip">
                {row.tip}
              </span>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
