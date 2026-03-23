"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "./ReducedMotionProvider";

type Props = {
  reason: string;
  version: number;
};

export function ChangeReasonReveal({ reason, version }: Props) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  if (version === 1) return null; // No reason for first version

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
        aria-expanded={open}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] transition-transform group-hover:scale-125"
        />
        Why it changed
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="inline-block text-xs"
        >
          &#9662;
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)] border-l-2 border-[var(--color-accent)] pl-3 italic">
              {reason}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
