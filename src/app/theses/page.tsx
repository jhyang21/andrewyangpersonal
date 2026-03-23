import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { getAllTheses } from "@/lib/theses";
import { getAllManifestos } from "@/lib/manifestos";

export const metadata = {
  title: "Theses | Andrew Yang",
  description: "What I believe about startups, life, and building.",
};

export default function ThesesPage() {
  const theses = getAllTheses();
  const manifestos = getAllManifestos();

  // Map thesis slugs to manifesto slugs for linking
  const manifestoByThesis = new Map(
    manifestos
      .filter((m) => m.thesisSlug)
      .map((m) => [m.thesisSlug, m.slug])
  );

  return (
    <div className="min-h-screen">
      <SiteNav current="theses" />
      <main className="mx-auto w-full max-w-2xl px-6 pb-20">
        <h1 className="font-serif text-4xl text-[var(--color-ink)]">Theses</h1>
        <p className="mt-3 text-base text-[var(--color-muted)]">
          Things I believe. Updated as I learn.
        </p>

        {theses.length === 0 ? (
          <p className="mt-12 text-sm text-[var(--color-muted)]">
            Nothing here yet. Check back soon.
          </p>
        ) : (
          <ul className="mt-10 space-y-10">
            {theses.map((thesis) => {
              const manifestoSlug = manifestoByThesis.get(thesis.slug);

              return (
                <li
                  key={thesis.title}
                  className="border-b border-[var(--color-border-warm)] pb-10 last:border-0"
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--color-accent)]">
                    {thesis.category}
                  </p>
                  <h2 className="mt-2 font-serif text-xl text-[var(--color-ink)]">
                    {thesis.title}
                  </h2>
                  <div className="mt-3 space-y-4 text-sm leading-7 text-[var(--color-muted)]">
                    {thesis.body.split("\n\n").map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    {manifestoSlug && (
                      <Link
                        href={`/manifestos/${manifestoSlug}`}
                        className="text-xs text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-ink)]"
                      >
                        Read the full manifesto &rarr;
                      </Link>
                    )}
                  </div>

                  {/* Revision history */}
                  {thesis.revisions.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-dashed border-[var(--color-border-warm)]">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--color-accent)]">
                        Updates
                      </p>
                      <ul className="mt-1 space-y-1">
                        {thesis.revisions.map((rev, i) => (
                          <li key={i} className="text-xs text-[var(--color-muted)]">
                            <span className="font-medium">{rev.date}</span>
                            {rev.note && <span> &mdash; {rev.note}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
