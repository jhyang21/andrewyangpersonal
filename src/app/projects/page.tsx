import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { getAllProjects } from "@/lib/projects";

export const metadata = {
  title: "Projects | Andrew Yang",
  description: "Things I built to answer a question I had.",
};

export default function ProjectsPage() {
  const projects = getAllProjects();

  return (
    <div className="min-h-screen">
      <SiteNav current="projects" />
      <main className="mx-auto w-full max-w-2xl px-6 pb-20">
        <h1 className="font-serif text-4xl text-[var(--color-ink)]">Projects</h1>
        <p className="mt-3 text-base text-[var(--color-muted)]">
          Things I built to answer a question I had. Most of them are a chart and
          the reasoning behind it.
        </p>

        {projects.length === 0 ? (
          <p className="mt-12 text-sm text-[var(--color-muted)]">
            Nothing here yet. Check back soon.
          </p>
        ) : (
          <ul className="mt-10 space-y-8">
            {projects.map((p) => (
              <li
                key={p.slug}
                className="border-b border-[var(--color-border-warm)] pb-8 last:border-0"
              >
                <Link href={`/projects/${p.slug}`} className="group block">
                  <p className="text-xs text-[var(--color-muted)]">{p.date}</p>
                  <h2 className="mt-1 font-serif text-xl text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                    {p.title}
                  </h2>
                  {p.summary && (
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                      {p.summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
