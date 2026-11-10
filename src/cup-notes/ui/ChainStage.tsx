"use client";

import type { ReactNode } from "react";
import type { CupAction, CupNotesIndex, LeverKey, ScenarioDetail } from "@/cup-notes/lib/types";
import { ACTION_LABELS, HINTS, STEPS, type Stage } from "@/cup-notes/lib/words";
import { CupGlyph } from "./Glyphs";
import { ManagerCard } from "./ManagerCard";
import { OutcomeTiles } from "./OutcomeTiles";
import { ReactionWall } from "./ReactionWall";
import { ShiftStrip } from "./ShiftStrip";
import { STAGES, stageAt, type Phase } from "./timeline";

type Props = {
  index: CupNotesIndex;
  detail: ScenarioDetail;
  memo: Record<LeverKey, string>;
  phase: Phase;
  t: number;
};

type StepState = "wait" | "live" | "done";

function stepState(stage: Stage, phase: Phase, t: number): StepState {
  if (phase === "done") return "done";
  const now = STAGES.indexOf(stageAt(t));
  const me = STAGES.indexOf(stage);
  return me < now ? "done" : me === now ? "live" : "wait";
}

function Step({
  n,
  stage,
  state,
  children,
}: {
  n: number;
  stage: Stage;
  state: StepState;
  children: ReactNode;
}) {
  return (
    <li className={`cn-step cn-step-${state}`}>
      <div className="cn-step-head">
        <span className="cn-step-n" aria-hidden="true">
          {n}
        </span>
        <h3 className="cn-step-title">{STEPS[stage].title}</h3>
        <span className="cn-step-sub">{STEPS[stage].sub}</span>
      </div>
      <div>{children}</div>
    </li>
  );
}

const CUP_LEGEND: CupAction[] = ["skip", "smiley", "generic", "personal"];

export function ChainStage({ index, detail, memo, phase, t }: Props) {
  const opt = (lever: LeverKey) => index.levers[lever].find((o) => o.key === detail.levers[lever]);
  const enforcement = opt("enforcement");
  const note = opt("note");
  const traffic = opt("traffic");
  const staffing = opt("staffing");

  return (
    <ol className="cn-chain">
      <Step n={1} stage="policy" state={stepState("policy", phase, t)}>
        <div className="cn-card cn-policy">
          <div>
            <p className="cn-policy-tag">The rule</p>
            <p className="cn-policy-main">
              {enforcement?.label}: {enforcement?.short}.
            </p>
            <p className="cn-policy-main">
              {note?.label}: {note?.short}.
            </p>
            <p className="cn-policy-memo">
              {memo.enforcement} {memo.note}
            </p>
          </div>
          <div>
            <p className="cn-policy-tag">The shift</p>
            <p className="cn-policy-cond">
              {traffic?.label} · {traffic?.short}
            </p>
            <p className="cn-policy-cond">
              {staffing?.label} · {staffing?.short}
            </p>
            <p className="cn-policy-memo">
              {memo.traffic} {memo.staffing}
            </p>
          </div>
        </div>
      </Step>

      <Step n={2} stage="managers" state={stepState("managers", phase, t)}>
        <div className="cn-mgr-grid">
          {index.stores.map((store, i) => (
            <ManagerCard
              key={store.key}
              store={store}
              order={i}
              t={t}
              manager={detail.managers.find((m) => m.store === store.key) ?? null}
            />
          ))}
        </div>
        <p className="cn-hint">{HINTS.managers}</p>
      </Step>

      <Step n={3} stage="shifts" state={stepState("shifts", phase, t)}>
        <ul className="cn-legend" aria-label="Cup key">
          {CUP_LEGEND.map((a) => (
            <li key={a}>
              <CupGlyph action={a} />
              <span>{ACTION_LABELS[a]}</span>
            </li>
          ))}
        </ul>
        <ShiftStrip index={index} detail={detail} t={t} />
        <p className="cn-hint">{HINTS.cups}</p>
      </Step>

      <Step n={4} stage="customers" state={stepState("customers", phase, t)}>
        <ReactionWall index={index} detail={detail} t={t} />
      </Step>

      <Step n={5} stage="outcomes" state={stepState("outcomes", phase, t)}>
        <OutcomeTiles outcomes={detail.outcomes} t={t} />
      </Step>
    </ol>
  );
}
