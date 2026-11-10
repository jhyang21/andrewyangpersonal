import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import Link from "next/link";
import { getIndex } from "@/cup-notes/lib/data";
import { BASE, SITE_BYLINE, SITE_NAME, SOURCES } from "@/cup-notes/lib/site";
import { getProjectBySlug } from "@/lib/projects";
import "@/cup-notes/styles.css";

/*
 * The microsite keeps its own font, tokens and nav on purpose; it does not use SiteNav. There is no
 * src/app/projects/layout.tsx, and there must not be one: it would wrap this shell too.
 */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  const project = getProjectBySlug("cup-notes");
  return {
    title: {
      default: `${SITE_NAME} ${SITE_BYLINE}`,
      template: `%s · ${SITE_NAME}`,
    },
    description: project?.summary,
    openGraph: {
      title: SITE_NAME,
      description: project?.summary,
      type: "article",
      publishedTime: project?.date,
      url: BASE,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F1E8" },
    { media: "(prefers-color-scheme: dark)", color: "#171512" },
  ],
};

export default function CupNotesLayout({ children }: { children: React.ReactNode }) {
  const { meta } = getIndex();
  return (
    <div className={`cup-notes ${dmSans.variable} flex min-h-screen flex-col`}>
      <a href="#main" className="sr-only-focusable bg-cn-ground p-2">
        Skip to content
      </a>
      {meta.source === "fixture" && (
        <p className="cn-fixture" role="status">
          FIXTURE DATA: placeholder answers, not the model
        </p>
      )}
      <header className="border-b border-cn-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3">
          <p className="font-semibold">
            <Link href={BASE} className="text-cn-ink no-underline">
              {SITE_NAME}
            </Link>{" "}
            <span className="font-normal text-cn-muted">{SITE_BYLINE}</span>
          </p>
          <nav aria-label="Site">
            <ul className="flex gap-4 text-sm">
              <li>
                <Link href={BASE}>Runs</Link>
              </li>
              <li>
                <Link href={`${BASE}/method`}>Method</Link>
              </li>
              <li>
                <Link href={`${BASE}/changelog`}>Changelog</Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-cn-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-cn-muted">
          {SITE_NAME} by <Link href="/">Andrew Yang</Link>. Sources on the real policy:{" "}
          {SOURCES.map((s, i) => (
            <span key={s.href}>
              {i > 0 && " and "}
              <a href={s.href} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </span>
          ))}
          . {meta.disclaimer}
        </p>
      </footer>
    </div>
  );
}
