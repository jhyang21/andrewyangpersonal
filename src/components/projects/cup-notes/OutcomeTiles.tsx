"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { Outcomes } from "@/lib/cup-notes/types";
import { type Metric, T, clamp01, pct, secs, whole } from "./shared";

type Tile = {
  key: Metric;
  label: string;
  format: (v: number) => string;
  /* The unit a delta is read in: points for percentages and 0–100 scores, seconds for time. */
  deltaUnit: string;
  decimals: number;
  note: (o: Outcomes) => string;
};

const TILES: Tile[] = [
  {
    key: "compliance_pct",
    label: "Compliance",
    format: pct,
    deltaUnit: " pts",
    decimals: 0,
    note: (o) => `${pct(o.personal_pct)} personal · ${pct(o.skip_pct)} skipped`,
  },
  {
    key: "avg_seconds_added",
    label: "Added wait per cup",
    format: secs,
    deltaUnit: " s",
    decimals: 1,
    note: (o) => `${o.avg_wait_min.toFixed(1)} min average wait`,
  },
  {
    key: "barista_sentiment",
    label: "Barista sentiment",
    format: whole,
    deltaUnit: "",
    decimals: 0,
    note: (o) => `0 to 100 · stress ${whole(o.barista_stress)}`,
  },
  {
    key: "customer_satisfaction",
    label: "Customer satisfaction",
    format: whole,
    deltaUnit: "",
    decimals: 0,
    note: (o) => `${pct(o.delighted_pct)} delighted · ${pct(o.annoyed_pct)} annoyed`,
  },
  {
    key: "connection",
    label: "Connection",
    format: whole,
    deltaUnit: "",
    decimals: 0,
    note: (o) => `${pct(o.noticed_pct)} noticed the note`,
  },
];

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** Signed difference of the two values as shown, so the delta always matches the numbers beside it. */
function delta(tile: Tile, a: number, b: number) {
  return round(round(b, tile.decimals) - round(a, tile.decimals), tile.decimals);
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

type Props = {
  outcomes: Outcomes | null;
  pinned: Outcomes | null;
  t: number;
};

export function OutcomeTiles({ outcomes, pinned, t }: Props) {
  /*
   * The counters run off the playback clock like everything else, so Skip and reduced motion land on
   * the saved value at once, and a lever change after a run swaps numbers without replaying.
   */
  const p = easeOut(clamp01((t - T.outcomes) / T.outcomesDur));
  const live = outcomes !== null && t >= T.outcomes;

  return (
    <div className="cn-tiles">
      {TILES.map((tile) => {
        const v = outcomes?.[tile.key];
        const a = pinned?.[tile.key];
        const d = v !== undefined && a !== undefined ? delta(tile, a, v) : null;
        return (
          <div className={`cn-card cn-tile ${live ? "" : "cn-card-wait"}`} key={tile.key}>
            <p className="cn-tile-label">{tile.label}</p>
            {a !== undefined && (
              <p className="cn-tile-a">
                <span className="cn-ab cn-ab-a">A</span> {tile.format(a)}
              </p>
            )}
            <p className="cn-tile-value">
              {pinned && <span className="cn-ab cn-ab-b">B</span>}
              {live && v !== undefined ? tile.format(v * p) : "–"}
            </p>
            {live && d !== null && p === 1 && (
              <p className="cn-tile-delta">
                {d > 0 ? (
                  <ArrowUp size={13} aria-hidden="true" />
                ) : d < 0 ? (
                  <ArrowDown size={13} aria-hidden="true" />
                ) : (
                  <Minus size={13} aria-hidden="true" />
                )}
                {d > 0 ? "+" : d < 0 ? "−" : "±"}
                {Math.abs(d).toFixed(tile.decimals)}
                {tile.deltaUnit} vs A
              </p>
            )}
            {live && outcomes && <p className="cn-tile-note">{tile.note(outcomes)}</p>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * One plain sentence comparing B with A, built only from the saved numbers. When a single lever
 * differs the scenarios are named by that lever ("Adaptive", "Strict"); otherwise as A and B.
 */
export function compareSentence(nameA: string, nameB: string, a: Outcomes, b: Outcomes) {
  const ca = Math.round(a.compliance_pct);
  const cb = Math.round(b.compliance_pct);
  const wa = a.avg_seconds_added.toFixed(1);
  const wb = b.avg_seconds_added.toFixed(1);
  const sa = Math.round(a.customer_satisfaction);
  const sb = Math.round(b.customer_satisfaction);

  const wait =
    wb === wa
      ? `with added wait per cup level at ${wb} s`
      : Number(wb) < Number(wa)
        ? `while cutting added wait per cup from ${wa} s to ${wb} s`
        : `while raising added wait per cup from ${wa} s to ${wb} s`;
  const sat =
    sa === sb
      ? `Customer satisfaction held at ${sb}.`
      : `Customer satisfaction ${sb > sa ? "rose" : "fell"} from ${sa} to ${sb}.`;

  return `${nameB} noted ${cb}% of cups against ${ca}% under ${nameA}, ${wait}. ${sat}`;
}
