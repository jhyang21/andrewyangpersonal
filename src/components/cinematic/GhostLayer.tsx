"use client";

import { motion } from "framer-motion";

type Props = {
  text: string;
  opacity: number;
};

export function GhostLayer({ text, opacity }: Props) {
  if (opacity <= 0.01) return null;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ opacity }}
      aria-hidden="true"
    >
      <p
        className="font-serif text-lg md:text-xl leading-relaxed"
        style={{
          color: "var(--color-ghost)",
          filter: `blur(${Math.max(0, 1 - opacity * 3)}px)`,
        }}
      >
        {text}
      </p>
    </motion.div>
  );
}
