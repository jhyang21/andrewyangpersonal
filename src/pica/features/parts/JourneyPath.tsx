"use client";

import type { MouseEvent } from "react";
import { StagePath } from "@/pica/components/kit";
import type { DecisionSession } from "@/pica/lib/types";
import type { JourneyStage } from "@/pica/features/shared/journey";
import { journeyPath } from "./journey-path-model";

export interface JourneyPathProps {
  session: DecisionSession;
  /** The stage on screen: `stageForView(ws.view)` in the workspace, "decide" on Decide. Null on Done. */
  current: JourneyStage | null;
  /** On Decide, the product on screen. Elsewhere leave it out: the checkout or decided product is used. */
  chosenProductId?: string;
  /**
   * The workspace's own handler for the Needs stage: a plain click or Enter
   * calls it, with the link, instead of following the link. A click with a
   * modifier key still opens the link as usual. Leave it out elsewhere.
   */
  onNeeds?: (link: HTMLAnchorElement) => void;
  className?: string;
}

/**
 * Needs · Options · Compare · Decide for one decision. Every stage is a link
 * at all times, with a fact (a count or an outcome), never a percent and
 * never a tick.
 */
export function JourneyPath({ session, current, chosenProductId, onNeeds, className }: JourneyPathProps) {
  const path = journeyPath(session, current, chosenProductId);
  const stages = <StagePath counts={path.counts} hrefs={path.hrefs} current={path.current} className={className} />;
  if (!onNeeds) return stages;

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as Element).closest("a");
    if (!link || link.getAttribute("href") !== path.hrefs.needs) return;
    // Next's Link leaves a click alone once it is prevented.
    e.preventDefault();
    onNeeds?.(link);
  }

  // `contents`: the wrapper only listens; the path lays out as it does without
  // it. The links inside take the keys, and Enter on a link fires this click.
  return (
    <div className="contents" onClickCapture={handleClick}>
      {stages}
    </div>
  );
}
