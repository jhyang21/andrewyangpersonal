"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCinematicStore } from "@/lib/cinematic-store";
import { stateToVisualClass, stateLabel, stateColor } from "@/lib/cinematic-utils";
import { useReducedMotion } from "./ReducedMotionProvider";
import { ThesisNodeDetail } from "./ThesisNodeDetail";
import type { CinematicThesis } from "@/types/cinematic";

type Props = {
  thesis: CinematicThesis;
  index: number;
};

export function ThesisNode({ thesis, index }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const setEntryRect = useCinematicStore((s) => s.setEntryRect);
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const visualClass = stateToVisualClass(thesis.state);
  const color = stateColor(thesis.state);

  function handleClick() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setEntryRect({
        slug: thesis.slug,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    }
    router.push(`/cinematic/thesis/${thesis.slug}`);
  }

  // Staggered drift animation per node
  const driftDuration = 6 + (index % 3) * 2;
  const driftX = 4 + (index % 4) * 2;
  const driftY = 3 + (index % 3) * 2;

  return (
    <motion.div
      ref={ref}
      className="relative cursor-pointer"
      initial={{ opacity: 0, y: 30 }}
      animate={{
        opacity: 1,
        y: 0,
        x: reducedMotion ? 0 : [0, driftX, -driftX / 2, 0],
        ...(reducedMotion ? {} : { y: [0, -driftY, driftY / 2, 0] }),
      }}
      transition={{
        opacity: { duration: 0.6, delay: index * 0.15 },
        y: reducedMotion
          ? { duration: 0.6, delay: index * 0.15 }
          : { duration: driftDuration, repeat: Infinity, ease: "easeInOut" },
        x: reducedMotion
          ? undefined
          : { duration: driftDuration * 1.1, repeat: Infinity, ease: "easeInOut" },
      }}
      whileHover={reducedMotion ? {} : { scale: 1.05, transition: { duration: 0.3 } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Enter thesis: ${thesis.title}`}
    >
      <div
        className={`${visualClass} rounded-2xl border border-[var(--color-border-warm)] bg-[var(--color-surface)] p-6 transition-all duration-300 md:p-8`}
        style={{
          borderColor: hovered ? color : undefined,
        }}
      >
        {/* State indicator dot */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color }}
          >
            {stateLabel(thesis.state)}
          </span>
          <span className="text-[10px] text-[var(--color-muted)] ml-auto">
            v{thesis.versions.length}
          </span>
        </div>

        {/* Category */}
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">
          {thesis.category}
        </p>

        {/* Title */}
        <h2 className="font-serif text-xl md:text-2xl text-[var(--color-ink)] leading-tight">
          {thesis.title}
        </h2>

        {/* Current version preview */}
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)] line-clamp-3">
          {thesis.versions[thesis.versions.length - 1].body}
        </p>

        {/* Last updated */}
        <p className="mt-4 text-[10px] text-[var(--color-muted)]">
          {thesis.versions[thesis.versions.length - 1].date}
        </p>
      </div>

      {/* Detail overlay on hover */}
      <ThesisNodeDetail thesis={thesis} visible={hovered} color={color} />
    </motion.div>
  );
}
