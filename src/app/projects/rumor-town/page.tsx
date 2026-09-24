import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { getProjectBySlug } from "@/lib/projects";

const SLUG = "rumor-town";

export function generateMetadata(): Metadata {
  const project = getProjectBySlug(SLUG);
  const title = project?.title ?? "Rumor Town";
  const description = project?.summary;
  return {
    title: `${title} | Andrew Yang`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: project?.date,
      url: `/projects/${SLUG}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function RumorTownPage() {
  const project = getProjectBySlug(SLUG);
  if (!project) notFound();

  return (
    <div className="min-h-screen">
      <SiteNav current="projects" />
      <main className="mx-auto w-full max-w-2xl px-6 pb-20">
        <Link
          href="/projects"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          &larr; Back to projects
        </Link>

        <article className="mt-8">
          <p className="text-xs text-[var(--color-muted)]">{project.date}</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-[var(--color-ink)]">
            {project.title}
          </h1>

          <div className="prose-post mt-8">
            <p>
              Rumor Town is a small town of fifty people and one rumor. Pick
              how it starts, then watch one day play out, from eight in the
              morning to eight at night.
            </p>
            <p>
              Each person hears the rumor from someone else and decides for
              themselves what to do with it. They can pass it on, doubt it, or
              go check whether it&rsquo;s true. Every time it moves from one
              person to the next, the words can shift a little, so the story
              you hear by evening may not match the one that started the day.
            </p>
            <p>
              Watch for a few things as the day runs: the story changing for
              the first time, someone finding out the truth, whether the
              correction takes over, and the talk dying down as the town
              settles for the night.
            </p>
          </div>

          {/*
            The embed is the one thing on the page that earns more than the 42rem measure. It widens
            to 56rem from `lg` up, where the viewport has the room to give it, and below that it sits
            in the same column as the prose.
          */}
          <section className="mt-10 lg:-mx-[8.5rem]">
            <iframe
              src="https://rumor-town.vercel.app/play"
              title="Rumor Town"
              loading="lazy"
              allow="clipboard-write"
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full rounded-md border border-neutral-200 bg-[#231f1c]"
              style={{ height: "min(85vh, 900px)", minHeight: 560 }}
            />
            <p className="mt-3 flex gap-4 text-sm">
              <a
                href="https://rumor-town.vercel.app/play"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              >
                Open it full screen
              </a>
              <a
                href="https://github.com/jhyang21/rumor-town"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              >
                Source
              </a>
            </p>
          </section>

          <div className="prose-post mt-12">
            <h2>How to read it</h2>
            <p>
              Pick a rumor and a town size, then press{" "}
              <strong>Start the day</strong>. A counter at the top tracks how
              many people have heard the rumor, how many believe it, and how
              many have told someone else.
            </p>
            <p>
              When the day ends, you get a results panel with three parts: a
              spread chart showing how many heard, believed, and told over
              the day; a family tree of every version of the story, with the
              most-heard one marked; and a list of key moments with the time
              each one happened. <strong>Share</strong> makes a link to that
              day, so you can send someone the exact run you just watched.
            </p>
          </div>

          <p className="mt-10 border-t border-[var(--color-border-warm)] pt-6 text-xs leading-6 text-[var(--color-muted)]">
            This is a fictional simulation. What the characters do is not a
            prediction of real human behavior.
          </p>
        </article>
      </main>
    </div>
  );
}
