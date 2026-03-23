"use client";

import { motion, type MotionValue } from "framer-motion";
import type { ThesisVersion } from "@/types/cinematic";

type Props = {
  scrollProgress: MotionValue<number>;
  versionCount: number;
  versions: ThesisVersion[];
};

export function ScrollProgress({ scrollProgress, versionCount, versions }: Props) {
  return (
    <div
      className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-1"
      aria-hidden="true"
    >
      {/* Rail */}
      <div className="relative h-40 w-[2px] bg-[var(--color-border-warm)] rounded-full overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 w-full bg-[var(--color-accent)] rounded-full origin-top"
          style={{ scaleY: scrollProgress, height: "100%" }}
        />
      </div>

      {/* Version tick marks */}
      <div className="relative h-40 -mt-40 w-6 flex flex-col justify-between py-0">
        {versions.map((v, i) => (
          <div
            key={i}
            className="flex items-center gap-1"
            style={{
              position: "absolute",
              top: `${(i / (versionCount - 1 || 1)) * 100}%`,
              right: 0,
              transform: "translateY(-50%)",
            }}
          >
            <span className="text-[8px] text-[var(--color-muted)] whitespace-nowrap">
              v{v.version}
            </span>
            <span className="block h-[2px] w-2 bg-[var(--color-border-warm)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
