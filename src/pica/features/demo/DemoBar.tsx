"use client";

import { BASE } from "@/pica/lib/base";
import { useEffect, useRef } from "react";
import { Button, cn } from "@/pica/components/kit";
import type { WorkspaceView } from "@/pica/features/workspace/views";
import { DEMO, DEMO_STEPS, demoProgress, type MessageLike } from "./demo-script";

export interface DemoBarProps {
  messages: readonly MessageLike[];
  /** Pica is replying: Next waits. */
  busy: boolean;
  /** Sends a buyer message. False when nothing was sent. */
  send: (text: string) => boolean;
  /** Shows a view, as the Views bar does. */
  go: (view: WorkspaceView) => void;
  className?: string;
}

/** "Step 2 of 4", or "Done" once every scripted turn is sent. */
export function demoStepLabel(progress: number): string {
  return progress >= DEMO_STEPS.length ? "Done" : `Step ${progress + 1} of ${DEMO_STEPS.length}`;
}

/**
 * The demo's controls, over the workspace. Next sends the next scripted turn,
 * then shows that step's view once Pica's reply is in. The step comes from
 * the messages, so a reload picks up where the demo stopped.
 */
export function DemoBar({ messages, busy, send, go, className }: DemoBarProps) {
  const progress = demoProgress(messages);
  const done = progress >= DEMO_STEPS.length;
  // The view to show once the reply to this many scripted turns is in.
  const pending = useRef<{ after: number; view: WorkspaceView } | null>(null);

  const replied = !busy && messages.at(-1)?.role === "assistant";
  useEffect(() => {
    const target = pending.current;
    if (!target || !replied || progress < target.after) return;
    pending.current = null;
    go(target.view);
  }, [replied, progress, go]);

  function next() {
    const step = DEMO_STEPS[progress];
    if (!step || busy) return;
    if (send(step.buyer)) pending.current = { after: progress + 1, view: step.view };
  }

  return (
    <section
      aria-label={DEMO.bar}
      className={cn(
        "z-30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-hairline bg-surface px-4 py-3 shadow-float",
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-body text-ink">
        <span className="font-semibold">
          {DEMO.bar} · {demoStepLabel(progress)}
        </span>
        <span aria-hidden> · </span>
        <span className="sr-only">. </span>
        <span className="text-ink-soft">{done ? DEMO.done : DEMO_STEPS[progress].caption}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" href={BASE}>
          {DEMO.leave}
        </Button>
        {done ? null : (
          <Button variant="primary" size="md" onClick={next} held={busy}>
            {DEMO.next}
          </Button>
        )}
      </div>
    </section>
  );
}
