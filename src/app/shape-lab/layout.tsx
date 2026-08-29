import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

/*
 * Fonts are scoped to this subtree, the same arrangement `/final-shift` uses. `next/font/google` can
 * be called from any server file, so the root layout's Inter + Fraunces stay untouched and `/`,
 * `/memos`, and `/theses` never load or preload either family below.
 *
 * Space Grotesk carries the interface; IBM Plex Mono carries every number, because the readouts
 * update while a slider is dragged and proportional digits make the value jitter sideways.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Unconventional Shape Lab",
  description: "A seeded generator for closed silhouettes that look hard to balance.",
  // Unlisted: never indexed, never linked from the nav or the sitemap.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

// The page is dark edge to edge; without this the mobile browser chrome stays paper-white above it.
export const viewport: Viewport = {
  themeColor: "#111114",
};

export default function ShapeLabLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`sl-root ${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      {children}
    </div>
  );
}
