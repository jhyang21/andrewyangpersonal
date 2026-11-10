"use client";

import { useCallback, useEffect, useState } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { RotateCcw, SkipForward } from "lucide-react";
import type { CupNotesIndex, LeverKey, ScenarioDetail } from "@/cup-notes/lib/types";
import { FALLBACK_NOTE } from "@/cup-notes/lib/words";
import { ChainStage } from "./ChainStage";
import { T, type Phase } from "./timeline";

type Props = {
  index: CupNotesIndex;
  detail: ScenarioDetail;
  /** The memo text the managers saw for this run's four options. */
  memo: Record<LeverKey, string>;
};

/*
 * The clock only re-renders the chain every other frame. Thirty steps a second is smooth enough for
 * cups landing and words appearing, and halves the work on a phone.
 */
const FRAME_MS = 33;

/*
 * The whole chain for one run. It starts finished, so the server HTML holds every manager line, cup
 * and outcome (readable without JavaScript); Replay plays it back from the memo.
 */
export function RunChain({ index, detail, memo }: Props) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("done");
  const [elapsed, setElapsed] = useState<number>(T.end);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (phase !== "playing") return;
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
  }, [phase, runId]);

  const replay = useCallback(() => {
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

  const t = phase === "done" ? T.end : elapsed;

  return (
    <MotionConfig reducedMotion="user">
      <div>
        <div className="cn-actions">
          <button type="button" className="cn-btn cn-btn-primary" onClick={replay}>
            <RotateCcw size={16} aria-hidden="true" />
            Replay
          </button>
          {phase === "playing" && (
            <button type="button" className="cn-btn cn-btn-ghost" onClick={skip}>
              <SkipForward size={16} aria-hidden="true" />
              Skip
            </button>
          )}
        </div>

        {detail.has_fallback && <p className="cn-fallback-note">{FALLBACK_NOTE}</p>}

        <ChainStage index={index} detail={detail} memo={memo} phase={phase} t={t} />
      </div>
    </MotionConfig>
  );
}
