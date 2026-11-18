"use client";

import { BASE } from "@/pica/lib/base";
import Link from "next/link";
import { useState } from "react";
import { Button, cn } from "@/pica/components/kit";
import { sessionReducer, type CanvasEdit } from "@/pica/lib/session";
import { CompareStage } from "@/pica/features/workspace/CompareStage";
import { OptionsStage } from "@/pica/features/workspace/OptionsStage";
import { SEED_ID } from "../seed/fixture";
import { previewWorkspace } from "./preview-workspace";
import { STAGES, pickState, type StageKey, type StageState } from "./stage-states";

/**
 * The Options and Compare stages on the seed decision, one state at a time,
 * since each stage owns fixed element ids. The URL names the state
 * (`?stage=compare&state=four`), so a browser check can open it directly.
 * The stages run inactive and on a stand-in workspace: nothing here sends a
 * message, checks prices, sends analytics or saves anything.
 */

const LINK =
  "inline-flex min-h-11 items-center rounded-[1.375rem] px-4 text-body font-medium text-ink underline-offset-4 hover:underline";
const CURRENT = "bg-purple-soft inset-ring-2 inset-ring-ink";

function StateLinks({ stage, current }: { stage: StageKey; current: StageState }) {
  return (
    <nav aria-label={`${STAGES[stage].title} states`}>
      <ul className="flex flex-wrap gap-2">
        {STAGES[stage].states.map((state) => {
          const on = state.key === current.key;
          return (
            <li key={state.key}>
              <Link
                href={`${BASE}/kit/stages?stage=${stage}&state=${state.key}`}
                aria-current={on ? "page" : undefined}
                className={cn(LINK, on ? CURRENT : "bg-surface")}
              >
                {state.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Stage({ stage, state }: { stage: StageKey; state: StageState }) {
  const [session, setSession] = useState(state.session);
  const [picks, setPicks] = useState(state.picks);
  const [busy, setBusy] = useState(state.busy ?? false);
  const [line, setLine] = useState("Nothing pressed yet.");

  const ws = previewWorkspace(session, {
    busy,
    picks,
    picksLocked: busy,
    togglePick: (id) => {
      if (busy) return;
      setPicks((was) => (was.includes(id) ? was.filter((pick) => pick !== id) : was.length < 5 ? [...was, id] : was));
    },
    send: (text) => {
      if (busy) return false;
      setBusy(true);
      setLine(`Sent: ${text} Press "Pica is replying" to end the reply.`);
      return true;
    },
    editCanvas: (edit: CanvasEdit) => {
      const next = sessionReducer(session, { type: "canvas_edited", edit, at: session.updatedAt + 1 });
      if (next === session) return false;
      setSession(next);
      setLine(`Applied ${edit.kind}. On a real screen this sends requirement_edited.`);
      return true;
    },
    // The workspace passes a state setter here; the stages pass a product id.
    openEvidence: (id) => {
      if (typeof id === "string") setLine(`Open the evidence sheet for ${session.products[id]?.title ?? id}.`);
    },
    goToChat: () => setLine("Go to chat, with focus on the composer."),
    decline: () => setLine("End without buying, confirmed: the screen ends the decision, then goes to Done."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 px-1">
        <div>
          <Button
            pressed={busy}
            onClick={() => {
              // A reply ending stands in for Pica's answer: a stale comparison comes back fresh.
              if (busy && session.comparison?.stale) {
                setSession({ ...session, comparison: { ...session.comparison, stale: false } });
                setLine("Pica replied. The comparison now uses your needs as they are.");
              }
              setBusy(!busy);
            }}
          >
            Pica is replying
          </Button>
        </div>
        <p role="status" className="text-caption text-ink-soft">
          {line}
        </p>
      </div>
      {stage === "options" ? <OptionsStage ws={ws} active={false} /> : <CompareStage ws={ws} active={false} />}
    </div>
  );
}

/** `stage` and `state` come from the URL; anything unknown falls back to the first. */
export function StagesPreview(props: { stage?: string; state?: string }) {
  const { stage, state } = pickState(props.stage, props.state);
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2 px-1">
        <h1 className="text-display font-semibold">Stages</h1>
        <p className="max-w-prose text-body-lg">
          Options and Compare on the seed decision, in each state, at the full width of the window. Nothing here sends
          analytics or saves anything.
        </p>
        <p className="max-w-prose text-body text-ink-soft">
          To see them inside the workspace, open <Link className="underline underline-offset-4" href={`${BASE}/kit/seed`}>/kit/seed</Link>,
          then the decision <code>{SEED_ID}</code>.
        </p>
      </header>
      <nav aria-label="Stages">
        <ul className="flex flex-wrap gap-2">
          {(Object.keys(STAGES) as StageKey[]).map((key) => (
            <li key={key}>
              <Link
                href={`${BASE}/kit/stages?stage=${key}`}
                aria-current={key === stage ? "page" : undefined}
                className={cn(LINK, key === stage ? CURRENT : "bg-surface")}
              >
                {STAGES[key].title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <StateLinks stage={stage} current={state} />
      <Stage key={`${stage}-${state.key}`} stage={stage} state={state} />
    </main>
  );
}
