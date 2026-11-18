import type { Metadata, Viewport } from "next";
import { getProjectBySlug } from "@/lib/projects";
import { BASE } from "@/pica/lib/base";
import "@/pica/styles.css";

/*
 * Pica keeps its own tokens, type and header on purpose; it does not use
 * SiteNav. Its styles reach the page only through the .pica wrapper (see
 * src/pica/styles.css). The root layout already loads Inter as --font-inter.
 */
export function generateMetadata(): Metadata {
  const project = getProjectBySlug("pica");
  return {
    // No title template: Pica's screens give whole titles, such as "Saved decisions · Pica".
    title: "Pica",
    applicationName: "Pica",
    description: project?.summary,
    openGraph: {
      title: "Pica",
      description: project?.summary,
      siteName: "Pica",
      type: "website",
      url: BASE,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#f2f4f5",
};

export default function PicaLayout({ children }: LayoutProps<"/projects/pica">) {
  return (
    // A workspace marked data-fit holds the page to the screen on desktop, so its panes scroll, not the page.
    <div className="pica flex min-h-dvh flex-col lg:has-[[data-fit]]:h-dvh">{children}</div>
  );
}
