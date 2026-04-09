"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CinematicThesis } from "@/types/cinematic";

type Props = {
  thesis: CinematicThesis;
  visible: boolean;
  color: string;
};

export function ThesisNodeDetail({ thesis, visible, color }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="absolute left-0 right-0 -bottom-2 translate-y-full z-10 rounded-xl border border-[var(--color-border-warm)] bg-[var(--color-surface)] p-4 shadow-lg pointer-events-none"
          style={{ borderTopColor: color }}
        >
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            {thesis.versions.length} version{thesis.versions.length !== 1 ? "s" : ""}
            {thesis.contradictions.length > 0 && (
              <>
                {" "}&middot;{" "}
                <span style={{ color: "var(--color-contradiction)" }}>
                  {thesis.contradictions.length} contradiction{thesis.contradictions.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
            {thesis.relatedTheses.length > 0 && (
              <>
                {" "}&middot;{" "}
                {thesis.relatedTheses.length} connected
              </>
            )}
          </p>
          <p className="mt-2 text-[10px] text-[var(--color-muted)] italic">
            Click to enter this idea
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
