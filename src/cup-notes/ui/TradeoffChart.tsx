"use client";

import { memo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { ScatterShapeProps } from "recharts/types/util/ScatterUtils";
import { pct, whole } from "@/cup-notes/lib/format";
import { DEFAULT_SELECTION, leverLabel, scenarioKey, scenarioName } from "@/cup-notes/lib/levers";
import type { CupNotesIndex, LeverSelection, ScenarioSummary } from "@/cup-notes/lib/types";
import { METRICS as WORDS, type Metric } from "@/cup-notes/lib/words";

type Props = {
  index: CupNotesIndex;
  /** The run on screen, ringed in the scatter; null on the home page, where no dot is ringed. */
  selection: LeverSelection | null;
};

const ENFORCEMENT = ["strict", "flexible", "adaptive"] as const;

/*
 * Seconds added per cup is the one metric not already on a 0–100 scale. It is drawn as a share of
 * the 45-second cap the barista schema allows, and every bar is labelled with its raw value.
 */
const SECONDS_CAP = 45;

const METRICS: {
  key: Metric;
  raw: (v: number) => string;
  scale: (v: number) => number;
}[] = [
  { key: "compliance_pct", raw: pct, scale: (v) => v },
  { key: "avg_seconds_added", raw: (v) => `${v.toFixed(1)}s`, scale: (v) => (v / SECONDS_CAP) * 100 },
  { key: "barista_sentiment", raw: whole, scale: (v) => v },
  { key: "customer_satisfaction", raw: whole, scale: (v) => v },
  { key: "connection", raw: whole, scale: (v) => v },
];

type BarRow = { metric: string } & Record<string, number | string | null>;

type Point = { key: string; name: string; x: number; y: number; z: number };

/* Recharts tooltips carry the hovered datum at `payload[0].payload`; this reads it without `any`. */
function first<T>(payload: unknown): T | null {
  const list = payload as { payload?: T }[] | undefined;
  return list?.[0]?.payload ?? null;
}

const tick = { fill: "var(--cn-muted)", fontSize: 11 };

/*
 * Five metric names do not fit on one line at phone width, so each word gets its own line. The
 * longest single word ("Connection") still fits a category at 390px.
 */
function MetricTick({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
  const words = String(payload?.value ?? "").split(" ");
  return (
    <text x={Number(x)} y={Number(y) + 4} textAnchor="middle" fill="var(--cn-muted)" fontSize={10}>
      {words.map((w, i) => (
        <tspan key={w} x={Number(x)} dy={i === 0 ? "0.71em" : "1.15em"}>
          {w}
        </tspan>
      ))}
    </text>
  );
}

function TradeoffChartImpl({ index, selection }: Props) {
  const byKey = new Map(index.scenarios.map((s) => [s.key, s]));
  /* With no run on screen, the bar chart shows the default run's shift. */
  const scope = selection ?? DEFAULT_SELECTION;
  const current = selection ? scenarioKey(selection) : null;
  const scopeName = [
    leverLabel(index, "note", scope.note),
    leverLabel(index, "traffic", scope.traffic),
    leverLabel(index, "staffing", scope.staffing),
  ].join(" · ");

  const trio: Record<string, ScenarioSummary | undefined> = {};
  for (const e of ENFORCEMENT) trio[e] = byKey.get(scenarioKey({ ...scope, enforcement: e }));

  const bars: BarRow[] = METRICS.map((m) => {
    const row: BarRow = { metric: WORDS[m.key].short };
    for (const e of ENFORCEMENT) {
      const s = trio[e];
      row[e] = s ? m.scale(s.outcomes[m.key]) : null;
      row[`${e}Raw`] = s ? m.raw(s.outcomes[m.key]) : null;
    }
    return row;
  });

  const points = (e: string): Point[] =>
    index.scenarios
      .filter((s) => s.levers.enforcement === e)
      .map((s) => ({
        key: s.key,
        name: scenarioName(index, s.levers),
        x: s.outcomes.compliance_pct,
        y: s.outcomes.customer_satisfaction,
        z: s.outcomes.avg_wait_min,
      }));

  const dot = (props: ScatterShapeProps, colour: string) => {
    const { cx, cy, size, payload } = props;
    if (cx === undefined || cy === undefined) return <g />;
    const r = Math.sqrt(size / Math.PI);
    const p = payload as Point;
    const isNow = p.key === current;
    return (
      <g>
        {/* A 2px card ring keeps overlapping dots apart without drawing a border round each. */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={colour}
          fillOpacity={0.88}
          stroke="var(--cn-card)"
          strokeWidth={2}
        />
        {isNow && (
          <>
            <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="var(--cn-ink)" strokeWidth={1.5} />
            <text x={cx + r + 7} y={cy + 4} className="cn-chart-tag">
              This run
            </text>
          </>
        )}
      </g>
    );
  };

  return (
    <div>
      <ul className="cn-legend" aria-label="Enforcement">
        {ENFORCEMENT.map((e) => (
          <li key={e}>
            <span className={`cn-swatch cn-swatch-${e}`} />
            <span>{leverLabel(index, "enforcement", e)}</span>
          </li>
        ))}
      </ul>

      <div className="cn-chart-grid">
        <figure className="cn-card cn-chart-card">
          <figcaption className="cn-chart-title">
            Three ways to enforce the same rule
            <span className="cn-chart-scope">{scopeName}</span>
          </figcaption>
          <BarChart
            responsive
            style={{ width: "100%", height: 300 }}
            data={bars}
            margin={{ top: 22, right: 8, bottom: 4, left: 0 }}
            barGap={2}
            barCategoryGap="22%"
          >
            <CartesianGrid vertical={false} stroke="var(--cn-line)" />
            <XAxis
              dataKey="metric"
              tickLine={false}
              axisLine={{ stroke: "var(--cn-line)" }}
              tick={(props) => <MetricTick {...props} />}
              height={40}
              interval={0}
            />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={tick} width={26} />
            <Tooltip
              cursor={{ fill: "var(--cn-tint)", fillOpacity: 0.6 }}
              content={({ active, payload }) => {
                const row = active ? first<BarRow>(payload) : null;
                if (!row) return null;
                return (
                  <div className="cn-chart-tip">
                    <p className="cn-chart-tip-head">{row.metric}</p>
                    {ENFORCEMENT.map((e) => (
                      <p key={e} className="cn-chart-tip-row">
                        <span className={`cn-swatch cn-swatch-${e}`} />
                        {leverLabel(index, "enforcement", e)}
                        <strong>{row[`${e}Raw`] ?? "no run"}</strong>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            {ENFORCEMENT.map((e) => (
              <Bar
                key={e}
                dataKey={e}
                name={leverLabel(index, "enforcement", e)}
                fill={`var(--cn-${e})`}
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              >
                {/* Only the mode on screen carries labels: three per group collide on a phone. */}
                {e === scope.enforcement && (
                  <LabelList dataKey={`${e}Raw`} position="top" className="cn-chart-label" />
                )}
              </Bar>
            ))}
          </BarChart>
          <p className="cn-chart-foot">
            Scores run 0 to 100. Added wait is drawn against the {SECONDS_CAP}-second cap. The labels
            give the raw values for {leverLabel(index, "enforcement", scope.enforcement)}. Hover, or
            see the table, for the rest.
          </p>
        </figure>

        <figure className="cn-card cn-chart-card">
          <figcaption className="cn-chart-title">
            All {index.scenarios.length} runs
            <span className="cn-chart-scope">Notes kept against customer satisfaction</span>
          </figcaption>
          <ScatterChart
            responsive
            style={{ width: "100%", height: 300 }}
            margin={{ top: 12, right: 28, bottom: 18, left: -12 }}
          >
            <CartesianGrid stroke="var(--cn-line)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Cups with a note"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              unit="%"
              tickLine={false}
              axisLine={{ stroke: "var(--cn-line)" }}
              tick={tick}
              label={{
                value: "Cups with a note",
                position: "insideBottom",
                offset: -12,
                fill: "var(--cn-muted)",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Satisfaction"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickLine={false}
              axisLine={false}
              tick={tick}
            />
            <ZAxis type="number" dataKey="z" range={[50, 420]} name="Average wait" />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                const p = active ? first<Point>(payload) : null;
                if (!p) return null;
                return (
                  <div className="cn-chart-tip">
                    <p className="cn-chart-tip-head">{p.name}</p>
                    <p className="cn-chart-tip-row">
                      Cups with a note <strong>{p.x.toFixed(1)}%</strong>
                    </p>
                    <p className="cn-chart-tip-row">
                      Satisfaction <strong>{p.y.toFixed(1)}</strong>
                    </p>
                    <p className="cn-chart-tip-row">
                      Average wait <strong>{p.z.toFixed(1)} min</strong>
                    </p>
                  </div>
                );
              }}
            />
            {ENFORCEMENT.map((e) => (
              <Scatter
                key={e}
                name={leverLabel(index, "enforcement", e)}
                data={points(e)}
                isAnimationActive={false}
                shape={(props: ScatterShapeProps) => dot(props, `var(--cn-${e})`)}
              />
            ))}
          </ScatterChart>
          <p className="cn-chart-foot">
            Up and to the right means more notes and happier customers. A bigger dot means a longer
            average wait.{current ? " The ringed dot is this run." : ""}
          </p>
        </figure>
      </div>

    </div>
  );
}

/* The chart never reads the playback clock, so it should not redraw thirty times a second with it. */
export const TradeoffChart = memo(TradeoffChartImpl);
