"use client";

import { useRef, useState } from "react";
import { useScroll, useMotionValueEvent } from "framer-motion";
import { getVersionAtScroll } from "@/lib/cinematic-utils";
import { VersionedText } from "./VersionedText";
import { GhostLayer } from "./GhostLayer";
import { ContradictionMarker } from "./ContradictionMarker";
import { ScrollProgress } from "./ScrollProgress";
import { ChangeReasonReveal } from "./ChangeReasonReveal";
import type { CinematicThesis } from "@/types/cinematic";

type Props = {
  thesis: CinematicThesis;
};

export function TimelineScroller({ thesis }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const versionCount = thesis.versions.length;
  const [versionIdx, setVersionIdx] = useState(0);
  const [transitionProg, setTransitionProg] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const { index, transitionProgress } = getVersionAtScroll(progress, versionCount);
    setVersionIdx(index);
    setTransitionProg(transitionProgress);
  });

  const current = thesis.versions[versionIdx];
  const previous = versionIdx > 0 ? thesis.versions[versionIdx - 1] : null;

  // Find contradiction active in current version's timeframe
  const activeContradiction = thesis.contradictions.find((c) => {
    const cDate = new Date(c.date);
    const currentDate = new Date(current.date);
    const prevDate = previous ? new Date(previous.date) : new Date(0);
    return cDate >= prevDate && cDate <= currentDate;
  });

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ minHeight: `${versionCount * 100}vh` }}
    >
      <ScrollProgress
        scrollProgress={scrollYProgress}
        versionCount={versionCount}
        versions={thesis.versions}
      />

      {/* Sticky content area */}
      <div className="sticky top-0 flex min-h-screen items-center">
        <div className="mx-auto w-full max-w-2xl px-6 py-20">
          {/* Version indicator */}
          <div className="mb-6 flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-[var(--color-accent)]">
              Version {current.version}
            </span>
            <span className="text-[10px] text-[var(--color-muted)]">
              {current.date}
            </span>
          </div>

          {/* Thesis text with ghost layer */}
          <div className="relative font-serif text-lg md:text-xl leading-relaxed text-[var(--color-ink)]">
            {previous && transitionProg > 0 && (
              <GhostLayer text={previous.body} opacity={1 - transitionProg} />
            )}
            <div className="relative z-10">
              <VersionedText
                text={current.body}
                versionKey={current.version}
              />
            </div>
          </div>

          {/* Change reason */}
          <ChangeReasonReveal reason={current.changeReason} version={current.version} />

          {/* Contradiction marker */}
          {activeContradiction && (
            <ContradictionMarker
              contradiction={activeContradiction}
              active={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
