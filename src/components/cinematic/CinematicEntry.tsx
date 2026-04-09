"use client";

import { useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useCinematicStore } from "@/lib/cinematic-store";
import { useReducedMotion } from "./ReducedMotionProvider";

type Props = {
  slug: string;
  children: ReactNode;
};

export function CinematicEntry({ slug, children }: Props) {
  const entryRect = useCinematicStore((s) => s.entryRect);
  const clearEntryRect = useCinematicStore((s) => s.clearEntryRect);
  const reduced = useReducedMotion();

  // Clear stored rect after entry animation
  useEffect(() => {
    const timer = setTimeout(clearEntryRect, 1000);
    return () => clearTimeout(timer);
  }, [clearEntryRect]);

  const hasRect = entryRect && entryRect.slug === slug;

  // Calculate starting transform from the stored rect
  const initialScale = hasRect
    ? Math.min(entryRect.rect.width / entryRect.viewportWidth, 0.4)
    : 0.95;

  const initialX = hasRect
    ? entryRect.rect.x + entryRect.rect.width / 2 - entryRect.viewportWidth / 2
    : 0;

  const initialY = hasRect
    ? entryRect.rect.y + entryRect.rect.height / 2 - entryRect.viewportHeight / 2
    : 20;

  if (reduced) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: initialScale,
        x: initialX,
        y: initialY,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
      }}
      transition={{
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1], // custom ease-out
      }}
    >
      {children}
    </motion.div>
  );
}
