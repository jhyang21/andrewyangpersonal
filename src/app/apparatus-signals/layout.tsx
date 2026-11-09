import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import {
  BASE,
  SITE_BYLINE,
  SITE_FOOTER,
  SITE_NAME,
  SITE_QUESTION,
} from "@/apparatus-signals/lib/site";
import "@/apparatus-signals/styles.css";

// The microsite keeps its own font, tokens and nav on purpose; it does not use SiteNav.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} ${SITE_BYLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: `${SITE_QUESTION}, state by state, from public records.`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a19" },
  ],
};

export default function ApparatusSignalsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`apparatus-signals ${geistSans.variable} flex min-h-screen flex-col`}>
      <a href="#main" className="sr-only-focusable bg-as-bg p-2">
        Skip to content
      </a>
      <header className="border-b border-as-rule">
        <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3">
          <p className="font-semibold">
            <Link href={BASE} className="text-as-ink no-underline">
              {SITE_NAME}
            </Link>{" "}
            <span className="font-normal text-as-muted">{SITE_BYLINE}</span>
          </p>
          <nav aria-label="Site">
            <ul className="flex gap-4 text-sm">
              <li>
                <Link href={BASE}>Map</Link>
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
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-as-rule">
        <p className="mx-auto max-w-5xl px-4 py-4 text-sm text-as-muted">
          {SITE_NAME} by <Link href="/">Andrew Yang</Link>. {SITE_FOOTER}
        </p>
      </footer>
    </div>
  );
}
