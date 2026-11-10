"use client";

import { clamp01, pct, secs, whole } from "@/cup-notes/lib/format";
import type { Outcomes } from "@/cup-notes/lib/types";
import { METRICS, METRIC_ORDER, type Metric } from "@/cup-notes/lib/words";
import { T } from "./timeline";

const FORMAT: Record<Metric, (v: number) => string> = {
  compliance_pct: pct,
  avg_seconds_added: secs,
  barista_sentiment: whole,
  customer_satisfaction: whole,
  connection: whole,
};

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

type Props = {
  outcomes: Outcomes;
  t: number;
};

export function OutcomeTiles({ outcomes, t }: Props) {
  /*
   * The counters run off the playback clock like everything else, so Skip and reduced motion land on
   * the saved value at once.
   */
  const p = easeOut(clamp01((t - T.outcomes) / T.outcomesDur));
  const live = t >= T.outcomes;

  return (
    <div className="cn-tiles">
      {METRIC_ORDER.map((key) => (
        <div className={`cn-card cn-tile ${live ? "" : "cn-card-wait"}`} key={key}>
          <p className="cn-tile-label">{METRICS[key].label}</p>
          <p className="cn-tile-value">{live ? FORMAT[key](outcomes[key] * p) : "–"}</p>
          {live && <p className="cn-tile-note">{METRICS[key].note(outcomes)}</p>}
        </div>
      ))}
    </div>
  );
}
