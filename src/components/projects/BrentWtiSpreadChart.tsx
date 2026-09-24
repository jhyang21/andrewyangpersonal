"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BrentWtiSeries } from "@/lib/projects";
import "./brent-wti-spread-chart.css";

export type ChartEvent = { date: string; label: string };

type Props = {
  series: BrentWtiSeries;
  events: ChartEvent[];
};

const RANGES = [
  { key: "full", label: "Full range", from: "2021-01-01", to: "2099-01-01" },
  { key: "ukraine", label: "Ukraine era", from: "2021-09-01", to: "2023-03-31" },
  { key: "mideast", label: "Mideast era", from: "2023-08-01", to: "2025-09-30" },
  { key: "iranwar", label: "2026 Iran war", from: "2026-01-01", to: "2099-01-01" },
] as const;

const UNITS = [
  { key: "usd", label: "$ / bbl" },
  { key: "pct", label: "% of WTI" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];
type UnitKey = (typeof UNITS)[number]["key"];

/*
 * Margins and panel heights are fixed; only the width tracks the container. The right margin is wide
 * because the series are labelled at their ends rather than in a legend the eye has to travel to.
 */
const M = { l: 44, r: 72, gapY: 26, xAxis: 24 };
const H_PRICE = 260;
const H_SPREAD = 190;

/*
 * Below this the two panels stop being readable, so the SVG stops shrinking its viewBox and scales
 * down instead — the chart gets smaller on a narrow phone rather than illegibly cramped.
 */
const MIN_WIDTH = 480;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const utc = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);

const money = (v: number) => `$${v.toFixed(2)}`;

function formatDay(ms: number) {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Round tick steps to 1/2/2.5/5 × a power of ten, so the axis reads in numbers people say aloud. */
function niceTicks(lo: number, hi: number, count: number): number[] {
  const step0 = (hi - lo) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  let step = mag;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * mag >= step0) {
      step = m * mag;
      break;
    }
  }
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

/** Nearest sample to a timestamp, searched within the visible window only. */
function bisect(time: number[], t: number, lo0: number, hi0: number) {
  let lo = lo0;
  let hi = hi0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (time[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > lo0 && Math.abs(time[lo - 1] - t) < Math.abs(time[lo] - t)) lo--;
  return lo;
}

type Hover = { i: number; x: number; y: number; ev: number | null };

export function BrentWtiSpreadChart({ series, events }: Props) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("full");
  const [unit, setUnit] = useState<UnitKey>("usd");
  const [width, setWidth] = useState(MIN_WIDTH);
  const [hover, setHover] = useState<Hover | null>(null);
  const [hotEvent, setHotEvent] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  const plotRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const groupId = useId();

  const time = useMemo(
    () => series.dates.map((d) => utc(d)),
    [series.dates],
  );

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.max(MIN_WIDTH, entries[0].contentRect.width));
      setHover(null);
    });
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    const N = series.dates.length;
    const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0];
    const t0 = utc(range.from);
    const t1 = utc(range.to);

    let idxLo = 0;
    while (idxLo < N - 1 && time[idxLo] < t0) idxLo++;
    let idxHi = N - 1;
    while (idxHi > 0 && time[idxHi] > t1) idxHi--;

    const x0 = M.l;
    const x1 = width - M.r;
    const tMin = time[idxLo];
    const tMax = time[idxHi];
    const X = (t: number) => x0 + ((t - tMin) / (tMax - tMin)) * (x1 - x0);

    /*
     * Chips are laid out before anything else, because the band they need is what pushes the price
     * panel down. Each chip drops to the next row if it would land within 22px of the last chip on
     * the current one — clustered events stack instead of overprinting.
     */
    const rowEnds: number[] = [];
    const visEvents = events.flatMap((ev, k) => {
      const t = utc(ev.date);
      if (t < tMin || t > tMax) return [];
      const x = X(t);
      let row = 0;
      while (row < rowEnds.length && x - rowEnds[row] < 22) row++;
      rowEnds[row] = x;
      return [{ ...ev, k, x, t, row }];
    });
    const chipBand = 4 + Math.max(1, rowEnds.length) * 21 + 6;

    const height = chipBand + H_PRICE + M.gapY + H_SPREAD + M.xAxis;
    const yP0 = chipBand;
    const yP1 = chipBand + H_PRICE;
    const yS0 = yP1 + M.gapY;
    const yS1 = yS0 + H_SPREAD;

    const spreadVal = (i: number) =>
      unit === "usd" ? series.spread[i] : series.pct[i];
    const baseVal = (i: number) => {
      const b = series.baseline[i];
      if (b === null) return null;
      return unit === "usd" ? b : (b / series.wti[i]) * 100;
    };

    let pLo = Infinity;
    let pHi = -Infinity;
    let sLo = Infinity;
    let sHi = -Infinity;
    for (let i = idxLo; i <= idxHi; i++) {
      pLo = Math.min(pLo, series.wti[i], series.brent[i]);
      pHi = Math.max(pHi, series.wti[i], series.brent[i]);
      sLo = Math.min(sLo, spreadVal(i));
      sHi = Math.max(sHi, spreadVal(i));
    }
    const pPad = (pHi - pLo) * 0.06;
    const sPad = (sHi - sLo) * 0.08;
    pLo -= pPad;
    pHi += pPad;
    sLo = Math.min(0, sLo - sPad);
    sHi += sPad;

    const YP = (v: number) => yP1 - ((v - pLo) / (pHi - pLo)) * (yP1 - yP0);
    const YS = (v: number) => yS1 - ((v - sLo) / (sHi - sLo)) * (yS1 - yS0);

    const priceTicks = niceTicks(pLo, pHi, 5)
      .map((v) => ({ v, y: YP(v) }))
      .filter((t) => t.y >= yP0 - 1 && t.y <= yP1 + 1);
    const spreadTicks = niceTicks(sLo, sHi, 4)
      .map((v) => ({ v, y: YS(v) }))
      .filter((t) => t.y >= yS0 - 1 && t.y <= yS1 + 1);

    // Years once the window is wide; quarters when it is short enough for them to fit.
    const xTicks: { x: number; label: string }[] = [];
    const spanYears = (tMax - tMin) / 3.15e10;
    const dStart = new Date(tMin);
    const dEnd = new Date(tMax);
    if (spanYears > 2.5) {
      const first = dStart.getUTCFullYear() + (dStart.getUTCMonth() > 0 ? 1 : 0);
      for (let y = first; y <= dEnd.getUTCFullYear(); y++) {
        xTicks.push({ x: X(Date.UTC(y, 0, 1)), label: `${y}` });
      }
    } else {
      let y = dStart.getUTCFullYear();
      let m = Math.ceil(dStart.getUTCMonth() / 3) * 3;
      for (;;) {
        if (m > 11) {
          m = 0;
          y++;
        }
        const t = Date.UTC(y, m, 1);
        if (t > tMax) break;
        if (t >= tMin) {
          const label = MONTHS[m] + (m === 0 ? ` ${y}` : ` ${String(y).slice(2)}`);
          xTicks.push({ x: X(t), label });
        }
        m += 3;
      }
    }

    const pathFor = (get: (i: number) => number | null, Y: (v: number) => number) => {
      let d = "";
      for (let i = idxLo; i <= idxHi; i++) {
        const v = get(i);
        if (v === null) continue;
        d += `${d ? "L" : "M"}${X(time[i]).toFixed(1)} ${Y(v).toFixed(1)}`;
      }
      return d;
    };

    const spreadPath = pathFor(spreadVal, YS);
    const zeroY = YS(0);
    const areaPath = spreadPath
      ? `${spreadPath}L${X(time[idxHi]).toFixed(1)} ${zeroY.toFixed(1)}L${X(
          time[idxLo],
        ).toFixed(1)} ${zeroY.toFixed(1)}Z`
      : "";

    // Direct end labels, nudged apart when the two price lines finish on top of each other.
    let brentLabelY = YP(series.brent[idxHi]);
    let wtiLabelY = YP(series.wti[idxHi]);
    if (Math.abs(brentLabelY - wtiLabelY) < 14) {
      const mid = (brentLabelY + wtiLabelY) / 2;
      const brentAbove = series.brent[idxHi] >= series.wti[idxHi];
      brentLabelY = mid + (brentAbove ? -4 : 12);
      wtiLabelY = mid + (brentAbove ? 12 : -4);
    }

    let medianLabelY: number | null = null;
    for (let i = idxHi; i >= idxLo; i--) {
      const b = baseVal(i);
      if (b === null) continue;
      const y = YS(b);
      if (Math.abs(y - YS(spreadVal(idxHi))) > 13) medianLabelY = y;
      break;
    }

    return {
      width,
      height,
      idxLo,
      idxHi,
      x0,
      x1,
      yP0,
      yP1,
      yS1,
      X,
      YP,
      YS,
      spreadVal,
      baseVal,
      priceTicks,
      spreadTicks,
      xTicks,
      visEvents,
      brentPath: pathFor((i) => series.brent[i], YP),
      wtiPath: pathFor((i) => series.wti[i], YP),
      baselinePath: pathFor(baseVal, YS),
      spreadPath,
      areaPath,
      brentLabelY,
      wtiLabelY,
      spreadLabelY: YS(spreadVal(idxHi)) + 4,
      medianLabelY,
    };
  }, [series, time, events, width, rangeKey, unit]);

  /*
   * The tooltip is positioned imperatively: flipping it to the left of the crosshair needs its own
   * measured width, and measuring it through state would cost a second render on every pointer move.
   */
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const plot = plotRef.current;
    const svg = svgRef.current;
    if (!tip || !plot || !svg || !hover) return;
    const plotRect = plot.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const cssX = (hover.x / layout.width) * svgRect.width;
    let left = cssX + 14;
    if (left + tip.offsetWidth > plotRect.width - 8) {
      left = cssX - tip.offsetWidth - 14;
    }
    const top = Math.min(
      (hover.y / layout.height) * svgRect.height,
      svgRect.height - tip.offsetHeight - 8,
    );
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, top)}px`;
  }, [hover, layout]);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGRectElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = layout.width / rect.width;
      const px = (e.clientX - rect.left) * scale;
      const { x0, x1, idxLo, idxHi } = layout;
      const t =
        ((px - x0) / (x1 - x0)) * (time[idxHi] - time[idxLo]) + time[idxLo];
      const i = bisect(
        time,
        Math.max(time[idxLo], Math.min(time[idxHi], t)),
        idxLo,
        idxHi,
      );
      // A marker within a day and a half of the hovered point gets named in the tooltip.
      const near = layout.visEvents.find(
        (ev) => Math.abs(ev.t - time[i]) < 36 * 3600 * 1000,
      );
      setHover({
        i,
        x: layout.X(time[i]),
        y: (e.clientY - rect.top) * scale,
        ev: near ? near.k : null,
      });
    },
    [layout, time],
  );

  const showEvent = useCallback(
    (k: number) => {
      setHotEvent(k);
      const t = utc(events[k].date);
      const { idxLo, idxHi } = layout;
      if (t < time[idxLo] || t > time[idxHi]) return;
      setHover({
        i: bisect(time, t, idxLo, idxHi),
        x: layout.X(t),
        y: layout.yP0 + 30,
        ev: k,
      });
    },
    [events, layout, time],
  );

  const clearEvent = useCallback(() => {
    setHotEvent(null);
    setHover(null);
  }, []);

  const last = series.dates.length - 1;
  const hoverRows = hover
    ? [
        { color: "var(--bw-brent)", name: "Brent", value: money(series.brent[hover.i]) },
        { color: "var(--bw-wti)", name: "WTI", value: money(series.wti[hover.i]) },
        {
          color: "var(--bw-spread)",
          name: "Spread",
          value:
            unit === "usd"
              ? money(series.spread[hover.i])
              : `${series.pct[hover.i].toFixed(1)}%`,
        },
        ...(layout.baseVal(hover.i) !== null
          ? [
              {
                color: "var(--color-muted)",
                name: "1-yr median",
                value:
                  unit === "usd"
                    ? money(layout.baseVal(hover.i) as number)
                    : `${(layout.baseVal(hover.i) as number).toFixed(1)}%`,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="bw-root">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <fieldset>
          <legend className="bw-seg-legend">Date range</legend>
          <div className="bw-seg-track">
            {RANGES.map((r) => (
              <label
                key={r.key}
                className={`bw-seg ${rangeKey === r.key ? "bw-seg-on" : ""}`}
              >
                <input
                  type="radio"
                  name={`${groupId}-range`}
                  value={r.key}
                  checked={rangeKey === r.key}
                  onChange={() => {
                    setRangeKey(r.key);
                    setHover(null);
                    setHotEvent(null);
                  }}
                  className="sr-only"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="bw-seg-legend">Spread unit</legend>
          <div className="bw-seg-track">
            {UNITS.map((u) => (
              <label
                key={u.key}
                className={`bw-seg ${unit === u.key ? "bw-seg-on" : ""}`}
              >
                <input
                  type="radio"
                  name={`${groupId}-unit`}
                  value={u.key}
                  checked={unit === u.key}
                  onChange={() => {
                    setUnit(u.key);
                    setHover(null);
                    setHotEvent(null);
                  }}
                  className="sr-only"
                />
                <span>{u.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="paper-card mt-4 px-4 pt-5 pb-3 sm:px-5">
        <p className="ml-11 text-[13px] font-semibold text-[var(--color-muted)]">
          Spot prices, $ per barrel
        </p>
        <div className="mt-1 mb-1.5 ml-11 flex gap-4 text-xs text-[var(--color-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-0 w-3.5 rounded-sm border-t-[2.5px] border-[var(--bw-brent)]"
            />
            Brent (Europe)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-0 w-3.5 rounded-sm border-t-[2.5px] border-[var(--bw-wti)]"
            />
            WTI (Cushing)
          </span>
        </div>

        <div className="bw-plot" ref={plotRef}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label="Two aligned panels: Brent and WTI spot prices on top, the Brent minus WTI spread with its one-year rolling median below. Numbered markers flag war events. Every value is listed in the daily data table below the chart."
          >
            {layout.priceTicks.map((t) => (
              <g key={`p${t.v}`}>
                <line
                  className="bw-gridline"
                  x1={layout.x0}
                  x2={layout.x1}
                  y1={t.y}
                  y2={t.y}
                />
                <text
                  className="bw-tick"
                  x={layout.x0 - 8}
                  y={t.y + 3.5}
                  textAnchor="end"
                >
                  {t.v}
                </text>
              </g>
            ))}
            {layout.spreadTicks.map((t) => (
              <g key={`s${t.v}`}>
                <line
                  className="bw-gridline"
                  x1={layout.x0}
                  x2={layout.x1}
                  y1={t.y}
                  y2={t.y}
                />
                <text
                  className="bw-tick"
                  x={layout.x0 - 8}
                  y={t.y + 3.5}
                  textAnchor="end"
                >
                  {unit === "usd" ? t.v : `${t.v}%`}
                </text>
              </g>
            ))}

            {layout.xTicks.map((t) => (
              <g key={`x${t.label}`}>
                <line
                  className="bw-axisline"
                  x1={t.x}
                  x2={t.x}
                  y1={layout.yS1}
                  y2={layout.yS1 + 5}
                />
                <text
                  className="bw-tick"
                  x={t.x}
                  y={layout.yS1 + 18}
                  textAnchor="middle"
                >
                  {t.label}
                </text>
              </g>
            ))}
            <line
              className="bw-axisline"
              x1={layout.x0}
              x2={layout.x1}
              y1={layout.yP1}
              y2={layout.yP1}
            />
            <line
              className="bw-axisline"
              x1={layout.x0}
              x2={layout.x1}
              y1={layout.yS1}
              y2={layout.yS1}
            />

            {layout.visEvents.map((ev) => (
              <line
                key={`ev${ev.k}`}
                className={`bw-event-line ${hotEvent === ev.k ? "is-hot" : ""}`}
                x1={ev.x}
                x2={ev.x}
                y1={13 + ev.row * 21 + 9}
                y2={layout.yS1}
              />
            ))}

            {layout.areaPath && (
              <path className="bw-fill-spread" d={layout.areaPath} />
            )}
            <path className="bw-series bw-series-brent" d={layout.brentPath} />
            <path className="bw-series bw-series-wti" d={layout.wtiPath} />
            <path className="bw-baseline" d={layout.baselinePath} />
            <path className="bw-series bw-series-spread" d={layout.spreadPath} />

            <text
              className="bw-endlabel"
              x={layout.x1 + 6}
              y={layout.brentLabelY + 4}
              fill="var(--bw-brent)"
            >
              Brent
            </text>
            <text
              className="bw-endlabel"
              x={layout.x1 + 6}
              y={layout.wtiLabelY + 4}
              fill="var(--bw-wti)"
            >
              WTI
            </text>
            <text
              className="bw-endlabel"
              x={layout.x1 + 6}
              y={layout.spreadLabelY}
            >
              Spread
            </text>
            {layout.medianLabelY !== null && (
              <text
                className="bw-endlabel-muted"
                x={layout.x1 + 6}
                y={layout.medianLabelY + 4}
              >
                1-yr median
              </text>
            )}

            {layout.visEvents.map((ev) => {
              const cy = 13 + ev.row * 21;
              return (
                <g
                  key={`chip${ev.k}`}
                  className={`bw-chip ${hotEvent === ev.k ? "is-hot" : ""}`}
                  tabIndex={0}
                  role="img"
                  aria-label={`Event ${ev.k + 1}: ${ev.label}, ${ev.date}`}
                  onPointerEnter={() => showEvent(ev.k)}
                  onPointerLeave={clearEvent}
                  onFocus={() => showEvent(ev.k)}
                  onBlur={clearEvent}
                >
                  <circle cx={ev.x} cy={cy} r={9} />
                  <text x={ev.x} y={cy + 3.3}>
                    {ev.k + 1}
                  </text>
                </g>
              );
            })}

            {hover && (
              <>
                <line
                  className="bw-crosshair"
                  x1={hover.x}
                  x2={hover.x}
                  y1={layout.yP0}
                  y2={layout.yS1}
                />
                <circle
                  cx={hover.x}
                  cy={layout.YP(series.brent[hover.i])}
                  r={4.5}
                  fill="var(--bw-brent)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
                <circle
                  cx={hover.x}
                  cy={layout.YP(series.wti[hover.i])}
                  r={4.5}
                  fill="var(--bw-wti)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
                <circle
                  cx={hover.x}
                  cy={layout.YS(layout.spreadVal(hover.i))}
                  r={4.5}
                  fill="var(--bw-spread)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              </>
            )}

            <rect
              x={layout.x0}
              y={layout.yP0}
              width={layout.x1 - layout.x0}
              height={layout.yS1 - layout.yP0}
              fill="transparent"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>

          {hover && (
            <div className="bw-tooltip" ref={tipRef}>
              <div className="bw-tt-date">{formatDay(time[hover.i])}</div>
              {hoverRows.map((row) => (
                <div className="bw-tt-row" key={row.name}>
                  <span
                    className="bw-tt-key"
                    style={{ borderTopColor: row.color }}
                  />
                  <span className="bw-tt-val">{row.value}</span>
                  <span className="bw-tt-name">{row.name}</span>
                </div>
              ))}
              {hover.ev !== null && (
                <div className="bw-tt-event">
                  {hover.ev + 1} · {events[hover.ev].label}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-serif text-lg text-[var(--color-ink)]">
          Numbered events
        </h2>
        <ol className="bw-events mt-3">
          {events.map((ev, k) => (
            <li
              key={ev.date}
              className={hotEvent === k ? "is-hot" : ""}
              onPointerEnter={() => setHotEvent(k)}
              onPointerLeave={() => setHotEvent(null)}
            >
              <span className="bw-num" aria-hidden="true">
                {k + 1}
              </span>
              <span className="bw-ev-date">{ev.date}</span>
              <span>{ev.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <details
        className="mt-8"
        onToggle={(e) => setTableOpen(e.currentTarget.open)}
      >
        <summary className="bw-table-toggle">Data table — daily values</summary>
        <div className="bw-table-wrap">
          <table className="bw-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Brent $</th>
                <th scope="col">WTI $</th>
                <th scope="col">Spread $</th>
                <th scope="col">Spread %</th>
              </tr>
            </thead>
            {/*
              1,368 rows is a fifth of a second of layout work on a mid-range phone, so they are
              built the first time the section opens rather than on load.
            */}
            <tbody>
              {tableOpen &&
                series.dates.map((d, i) => (
                  <tr key={d}>
                    <td>{d}</td>
                    <td>{series.brent[i].toFixed(2)}</td>
                    <td>{series.wti[i].toFixed(2)}</td>
                    <td>{series.spread[i].toFixed(2)}</td>
                    <td>{series.pct[i].toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mt-3 text-xs text-[var(--color-muted)]">
        {series.dates.length.toLocaleString()} trading days, {series.dates[0]} to{" "}
        {series.dates[last]}.
      </p>
    </div>
  );
}
