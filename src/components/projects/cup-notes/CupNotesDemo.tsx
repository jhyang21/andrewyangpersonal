"use client";

import { useCallback, useEffect, useState } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { TriangleAlert } from "lucide-react";
import type {
  CupNotesIndex,
  LeverKey,
  LeverSelection,
  ScenarioDetail,
} from "@/lib/cup-notes/types";
import { ChainStage } from "./ChainStage";
import { LeverPanel, type Phase } from "./LeverPanel";
import { compareSentence } from "./OutcomeTiles";
import { StoreDrilldown } from "./StoreDrilldown";
import { TradeoffChart } from "./TradeoffChart";
import {
  DEFAULT_SELECTION,
  LEVER_ORDER,
  T,
  leverLabel,
  scenarioKey,
  scenarioName,
} from "./shared";
import "./cup-notes.css";

type Props = { index: CupNotesIndex };

/* A scenario file is loaded, absent (404, or not in the index), or failed for some other reason. */
type Entry = ScenarioDetail | "missing" | "error";

/*
 * The clock only re-renders the chain every other frame. Thirty steps a second is smooth enough for
 * cups landing and words appearing, and halves the work on a phone.
 */
const FRAME_MS = 33;

export function CupNotesDemo({ index }: Props) {
  const reduce = useReducedMotion();
  const [selection, setSelection] = useState<LeverSelection>(DEFAULT_SELECTION);
  const [cache, setCache] = useState<Map<string, Entry>>(() => new Map());
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [runId, setRunId] = useState(0);
  const [pinned, setPinned] = useState<LeverSelection | null>(null);
  const [openStore, setOpenStore] = useState<string | null>(null);
  const [lastGood, setLastGood] = useState<string | null>(null);

  const key = scenarioKey(selection);
  const summaries = new Map(index.scenarios.map((s) => [s.key, s]));
  const inIndex = summaries.has(key);
  const entry: Entry | undefined = inIndex ? cache.get(key) : "missing";
  const loaded = typeof entry === "object" ? entry : null;

  /* Remember the last scenario that loaded, so a pending fetch dims the old one instead of blanking. */
  if (loaded && lastGood !== key) setLastGood(key);

  useEffect(() => {
    if (!inIndex || cache.has(key)) return;
    let live = true;
    fetch(`/cup-notes/scenarios/${key}.json`)
      .then(async (res): Promise<Entry> => {
        if (res.status === 404) return "missing";
        if (!res.ok) return "error";
        return (await res.json()) as ScenarioDetail;
      })
      .catch((): Entry => "error")
      .then((value) => {
        if (live) setCache((prev) => new Map(prev).set(key, value));
      });
    return () => {
      live = false;
    };
  }, [key, inIndex, cache]);

  const lastEntry = lastGood ? cache.get(lastGood) : undefined;
  const stale = !loaded && entry === undefined && typeof lastEntry === "object";
  const detail = loaded ?? (stale && typeof lastEntry === "object" ? lastEntry : null);

  /* The clock runs only once the scenario is in hand; until then "Run" waits on the fetch. */
  useEffect(() => {
    if (phase !== "playing" || !loaded) return;
    let raf = 0;
    let last = -1;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      if (t >= T.end) {
        setElapsed(T.end);
        setPhase("done");
        return;
      }
      const step = Math.floor(t / FRAME_MS) * FRAME_MS;
      if (step !== last) {
        last = step;
        setElapsed(step);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, loaded, runId]);

  const run = useCallback(() => {
    if (reduce) {
      setElapsed(T.end);
      setPhase("done");
      return;
    }
    setElapsed(0);
    setPhase("playing");
    setRunId((n) => n + 1);
  }, [reduce]);

  const skip = useCallback(() => {
    setElapsed(T.end);
    setPhase("done");
  }, []);

  const onLever = useCallback((lever: LeverKey, value: string) => {
    setSelection((s) => ({ ...s, [lever]: value }));
  }, []);

  const toggleCompare = useCallback(() => {
    setPinned((p) => (p ? null : selection));
  }, [selection]);

  const t = phase === "idle" ? -1 : phase === "done" ? T.end : elapsed;
  const name = scenarioName(index, selection);
  const pinnedKey = pinned ? scenarioKey(pinned) : null;
  const pinnedSummary = pinnedKey ? (summaries.get(pinnedKey) ?? null) : null;
  const currentSummary = summaries.get(key) ?? null;

  /* Name the two sides by the one lever that differs when only one does; otherwise call them A and B. */
  let sentence: string | null = null;
  if (pinned && pinnedSummary && currentSummary && pinnedKey !== key && phase === "done") {
    const diff = LEVER_ORDER.filter((l) => pinned[l] !== selection[l]);
    const [nameA, nameB] =
      diff.length === 1
        ? [leverLabel(index, diff[0], pinned[diff[0]]), leverLabel(index, diff[0], selection[diff[0]])]
        : ["A", "B"];
    sentence = compareSentence(nameA, nameB, pinnedSummary.outcomes, currentSummary.outcomes);
  }

  const missing = entry === "missing";
  const failed = entry === "error";

  return (
    <MotionConfig reducedMotion="user">
      <div className="cn-root">
        {index.meta.source === "fixture" && (
          <p className="cn-fixture" role="status">
            <TriangleAlert size={16} aria-hidden="true" />
            FIXTURE DATA — placeholder answers, not model output
          </p>
        )}

        <header className="cn-head">
          <div className="cn-head-row">
            <p className="cn-label">Policy simulation · Simile method</p>
            <p className="cn-badge">Synthetic and illustrative. Not Starbucks data.</p>
          </div>
          {pinned ? (
            <div className="cn-head-ab">
              <p className="cn-head-scenario">
                <span className="cn-ab cn-ab-a">A</span>
                {scenarioName(index, pinned)}
              </p>
              <p className="cn-head-scenario">
                <span className="cn-ab cn-ab-b">B</span>
                {name}
              </p>
            </div>
          ) : (
            <p className="cn-head-scenario" aria-live="polite">
              {name}
            </p>
          )}
        </header>

        <LeverPanel
          index={index}
          selection={selection}
          onLever={onLever}
          phase={phase}
          onRun={run}
          onSkip={skip}
          onCompare={toggleCompare}
          pinnedName={pinned ? scenarioName(index, pinned) : null}
        />

        {sentence && (
          <p className="cn-compare-line" aria-live="polite">
            {sentence}
          </p>
        )}
        {pinned && pinnedKey === key && (
          <p className="cn-compare-line cn-compare-line-quiet">
            B is the same as A. Change a lever to pick a different scenario.
          </p>
        )}

        {missing ? (
          <div className="cn-card cn-missing" role="status">
            <p className="cn-missing-title">This combination was not simulated</p>
            <p className="cn-dim">
              There is no saved run for {name}. Pick another combination; nothing here is made up to
              fill the gap.
            </p>
          </div>
        ) : failed ? (
          <div className="cn-card cn-missing" role="status">
            <p className="cn-missing-title">This scenario did not load</p>
            <p className="cn-dim">Check the connection and pick the combination again.</p>
          </div>
        ) : (
          <div className={stale ? "cn-stale" : undefined} aria-busy={!loaded}>
            {phase === "playing" && !loaded && <p className="cn-hint">Loading the scenario…</p>}
            {loaded?.has_fallback && (
              <p className="cn-fallback-note">
                Some shifts in this scenario came back malformed from the model and were filled from
                the rule-based fixture. They are marked “Fallback”.
              </p>
            )}
            <ChainStage
              index={index}
              selection={selection}
              detail={detail}
              phase={phase}
              t={t}
              pinned={pinnedSummary?.outcomes ?? null}
              onOpenStore={setOpenStore}
            />
          </div>
        )}

        <section className="cn-section" aria-labelledby="cn-tradeoff-title">
          <h3 id="cn-tradeoff-title" className="cn-section-title">
            The tradeoff, across every run
          </h3>
          <TradeoffChart index={index} selection={selection} pinnedKey={pinnedKey} />
        </section>

        <StoreDrilldown
          index={index}
          detail={detail}
          storeKey={openStore}
          scenarioLabel={name}
          onClose={() => setOpenStore(null)}
        />
      </div>
    </MotionConfig>
  );
}
