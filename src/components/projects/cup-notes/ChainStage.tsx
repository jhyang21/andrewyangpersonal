"use client";

import type { ReactNode } from "react";
import type {
  CupAction,
  CupNotesIndex,
  LeverSelection,
  Outcomes,
  ScenarioDetail,
} from "@/lib/cup-notes/types";
import { CupGlyph } from "./Glyphs";
import { ManagerCard } from "./ManagerCard";
import { OutcomeTiles } from "./OutcomeTiles";
import { ReactionWall } from "./ReactionWall";
import { ShiftStrip } from "./ShiftStrip";
import type { Phase } from "./LeverPanel";
import { ACTION_LABELS, STAGES, type Stage, stageAt } from "./shared";

type Props = {
  index: CupNotesIndex;
  selection: LeverSelection;
  detail: ScenarioDetail | null;
  phase: Phase;
  t: number;
  pinned: Outcomes | null;
  onOpenStore: (storeKey: string) => void;
};

type StepState = "wait" | "live" | "done";

function stepState(stage: Stage, phase: Phase, t: number): StepState {
  if (phase === "idle") return "wait";
  if (phase === "done") return "done";
  const now = STAGES.indexOf(stageAt(t));
  const me = STAGES.indexOf(stage);
  return me < now ? "done" : me === now ? "live" : "wait";
}

function Step({
  n,
  title,
  sub,
  state,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  state: StepState;
  children: ReactNode;
}) {
  return (
    <li className={`cn-step cn-step-${state}`}>
      <div className="cn-step-head">
        <span className="cn-step-n" aria-hidden="true">
          {n}
        </span>
        <h3 className="cn-step-title">{title}</h3>
        <span className="cn-step-sub">{sub}</span>
      </div>
      <div>{children}</div>
    </li>
  );
}

const CUP_LEGEND: CupAction[] = ["skip", "smiley", "generic", "personal"];

export function ChainStage({ index, selection, detail, phase, t, pinned, onOpenStore }: Props) {
  const opt = (lever: keyof LeverSelection) =>
    index.levers[lever].find((o) => o.key === selection[lever]);
  const enforcement = opt("enforcement");
  const note = opt("note");
  const traffic = opt("traffic");
  const staffing = opt("staffing");

  return (
    <ol className="cn-chain">
      <Step n={1} title="Policy" sub="One memo, sent to six stores" state={stepState("policy", phase, t)}>
        <div className="cn-card cn-policy">
          <div>
            <p className="cn-policy-tag">The rule</p>
            <p className="cn-policy-main">
              {enforcement?.label}: {enforcement?.short}.
            </p>
            <p className="cn-policy-main">
              {note?.label}: {note?.short}.
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
          </div>
        </div>
      </Step>

      <Step
        n={2}
        title="Store managers"
        sub="Each reads the memo through their own job"
        state={stepState("managers", phase, t)}
      >
        <div className="cn-mgr-grid">
          {index.stores.map((store, i) => (
            <ManagerCard
              key={store.key}
              store={store}
              order={i}
              t={t}
              manager={detail?.managers.find((m) => m.store === store.key) ?? null}
              onOpen={onOpenStore}
            />
          ))}
        </div>
        <p className="cn-hint">
          Hover or focus a card to see what the manager thinks but does not say. Open a store for
          the whole shift.
        </p>
      </Step>

      <Step
        n={3}
        title="Baristas"
        sub="Twelve people, eight customers each"
        state={stepState("shifts", phase, t)}
      >
        <ul className="cn-legend" aria-label="Cup key">
          {CUP_LEGEND.map((a) => (
            <li key={a}>
              <CupGlyph action={a} />
              <span>{ACTION_LABELS[a]}</span>
            </li>
          ))}
        </ul>
        <ShiftStrip index={index} detail={detail} t={t} />
        <p className="cn-hint">
          Hover, tap or arrow through the cups to read each note and how that customer took it.
        </p>
      </Step>

      <Step
        n={4}
        title="Customers"
        sub="96 people react to the cup and the wait"
        state={stepState("customers", phase, t)}
      >
        <ReactionWall index={index} detail={detail} t={t} />
      </Step>

      <Step
        n={5}
        title="Outcomes"
        sub="Averages over all 96 cups"
        state={stepState("outcomes", phase, t)}
      >
        <OutcomeTiles outcomes={detail?.outcomes ?? null} pinned={pinned} t={t} />
      </Step>
    </ol>
  );
}
