"use client";

import { CinematicEntry } from "@/components/cinematic/CinematicEntry";
import { TimelineScroller } from "@/components/cinematic/TimelineScroller";
import { CrossThesisNav } from "@/components/cinematic/CrossThesisNav";
import { stateColor, stateLabel } from "@/lib/cinematic-utils";
import type { CinematicThesis } from "@/types/cinematic";

type Props = {
  thesis: CinematicThesis;
  essayHtml: string | null;
  relatedTheses: CinematicThesis[];
};

export function ThesisExperience({ thesis, essayHtml, relatedTheses }: Props) {
  const color = stateColor(thesis.state);

  return (
    <CinematicEntry slug={thesis.slug}>
      <div className="pb-32">
        {/* Hero section */}
        <section className="flex min-h-[60vh] items-center justify-center px-6">
          <div className="mx-auto max-w-2xl text-center">
            {/* State + category */}
            <div className="mb-4 flex items-center justify-center gap-3">
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
              <span className="text-[10px] text-[var(--color-muted)]">
                &middot;
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                {thesis.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-serif text-3xl md:text-5xl text-[var(--color-ink)] leading-tight">
              {thesis.title}
            </h1>

            {/* Version range */}
            <p className="mt-4 text-xs text-[var(--color-muted)]">
              {thesis.versions.length} version{thesis.versions.length !== 1 ? "s" : ""}
              {" "}&middot;{" "}
              {thesis.versions[0].date} &mdash; {thesis.versions[thesis.versions.length - 1].date}
            </p>

            {/* Scroll hint */}
            <p className="mt-12 text-[10px] uppercase tracking-widest text-[var(--color-muted)] animate-pulse">
              Scroll to move through time
            </p>
          </div>
        </section>

        {/* Timeline scroller — the core time-lapse experience */}
        <TimelineScroller thesis={thesis} />

        {/* Essay section */}
        {essayHtml && (
          <section className="mx-auto max-w-2xl px-6 mt-20">
            <div className="border-t border-[var(--color-border-warm)] pt-12">
              <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-8">
                The full essay
              </p>
              <div
                className="prose-cinematic"
                dangerouslySetInnerHTML={{ __html: essayHtml }}
              />
            </div>
          </section>
        )}

        {/* Cross-thesis navigation */}
        <div className="mx-auto max-w-2xl px-6">
          <CrossThesisNav relatedTheses={relatedTheses} />
        </div>
      </div>
    </CinematicEntry>
  );
}
