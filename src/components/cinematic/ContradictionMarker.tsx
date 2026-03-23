"use client";

import { motion } from "framer-motion";
import type { ContradictionMoment } from "@/types/cinematic";
import { useReducedMotion } from "./ReducedMotionProvider";

type Props = {
  contradiction: ContradictionMoment;
  active: boolean;
};

export function ContradictionMarker({ contradiction, active }: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.8 }}
      animate={
        active
          ? { opacity: 1, scaleX: 1 }
          : { opacity: 0, scaleX: 0.8 }
      }
      transition={{ duration: reduced ? 0.15 : 0.6, ease: "easeOut" }}
      className="my-8 overflow-hidden rounded-xl border border-[var(--color-contradiction)] bg-[rgba(255,107,107,0.05)]"
      style={{ transformOrigin: "left center" }}
    >
      {/* Crack line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[var(--color-contradiction)] to-transparent" />

      <div className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-contradiction)]" />
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-contradiction)]">
            Contradiction
          </span>
          <span className="text-[10px] text-[var(--color-muted)] ml-auto">
            {contradiction.date}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">
          {contradiction.description}
        </p>
        {contradiction.resolvedVersion && (
          <p className="mt-2 text-[10px] text-[var(--color-accent)]">
            Resolved in v{contradiction.resolvedVersion}
          </p>
        )}
      </div>
    </motion.div>
  );
}
