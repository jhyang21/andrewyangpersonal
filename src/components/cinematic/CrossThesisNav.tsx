"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { stateColor, stateLabel } from "@/lib/cinematic-utils";
import type { CinematicThesis } from "@/types/cinematic";

type Props = {
  relatedTheses: CinematicThesis[];
};

export function CrossThesisNav({ relatedTheses }: Props) {
  if (relatedTheses.length === 0) return null;

  return (
    <div className="mt-20 border-t border-[var(--color-border-warm)] pt-12">
      <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-6">
        Connected ideas
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {relatedTheses.map((thesis, i) => (
          <motion.div
            key={thesis.slug}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <Link
              href={`/cinematic/thesis/${thesis.slug}`}
              className="group block rounded-xl border border-[var(--color-border-warm)] bg-[var(--color-surface)] p-5 transition-all duration-300 hover:border-[var(--color-accent)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: stateColor(thesis.state) }}
                />
                <span
                  className="text-[9px] uppercase tracking-widest"
                  style={{ color: stateColor(thesis.state) }}
                >
                  {stateLabel(thesis.state)}
                </span>
              </div>
              <h3 className="font-serif text-base text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                {thesis.title}
              </h3>
              <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">
                {thesis.versions[thesis.versions.length - 1].body}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
