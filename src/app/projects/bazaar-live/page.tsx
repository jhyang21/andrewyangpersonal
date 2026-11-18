import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProjectBySlug } from "@/lib/projects";

const SLUG = "bazaar-live";

/*
 * The demo is a static Vite bundle in public/bazaar-live-app, built from its own repo with
 * base /bazaar-live-app/ and VITE_NARRATION=off. It draws a fixed 1440 x 900 stage and scales
 * it to fit the frame, so this page only gives it the whole screen under a thin bar.
 */
const APP_SRC = "/bazaar-live-app/index.html";

export function generateMetadata(): Metadata {
  const project = getProjectBySlug(SLUG);
  const title = project?.title ?? "Bazaar Live";
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
    twitter: { card: "summary", title, description },
  };
}

export default function BazaarLivePage() {
  const project = getProjectBySlug(SLUG);
  if (!project) notFound();

  return (
    <div className="flex h-dvh flex-col bg-[#1d1916]">
      <header className="flex shrink-0 items-center gap-4 px-4 py-2 text-xs text-neutral-300">
        <Link href="/projects" className="shrink-0 hover:text-white">
          &larr; Projects
        </Link>
        <p className="min-w-0 truncate text-neutral-400">
          <span className="text-neutral-200">{project.title}</span> &middot; a
          concept prototype I built for a Shopify take-home. Not a Shopify
          product. Every person, shop, product and order here is made up.
        </p>
        <p className="ml-auto hidden shrink-0 text-neutral-400 md:block">
          Click the arrows, or use &larr; and &rarr;
        </p>
      </header>
      <iframe
        src={APP_SRC}
        title={project.title}
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
