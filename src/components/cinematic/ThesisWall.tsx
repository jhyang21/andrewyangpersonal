"use client";

import { ThesisNode } from "./ThesisNode";
import type { CinematicThesis } from "@/types/cinematic";

type Props = {
  theses: CinematicThesis[];
};

export function ThesisWall({ theses }: Props) {
  return (
    <div className="relative mx-auto w-full max-w-6xl px-6">
      {/* Header */}
      <div className="mb-16 text-center">
        <h1 className="font-serif text-3xl md:text-5xl text-[var(--color-ink)] leading-tight">
          A wall of living theses
        </h1>
        <p className="mt-4 text-sm md:text-base text-[var(--color-muted)] max-w-md mx-auto">
          Each idea evolves over time. Click one to enter its world.
        </p>
      </div>

      {/* Thesis grid — asymmetric on desktop for visual interest */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
        {theses.map((thesis, i) => (
          <div
            key={thesis.slug}
            className={`${
              // Offset odd items on desktop for staggered feel
              i % 2 === 1 ? "md:mt-12" : ""
            }`}
          >
            <ThesisNode thesis={thesis} index={i} />
          </div>
        ))}
      </div>

      {/* Ambient background elements */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
      >
        {/* Subtle radial gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(78, 205, 196, 0.04) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(192, 132, 252, 0.03) 0%, transparent 60%)",
          }}
        />
        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    </div>
  );
}
