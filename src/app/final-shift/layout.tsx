import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import "./final-shift.css";

/*
 * Fonts are scoped to this subtree. `next/font/google` can be called from any server file, so the
 * root layout's Inter + Fraunces stay exactly as they are on `/`, `/memos`, and `/theses` — those
 * pages never load or preload these three families.
 *
 * Neither family ships as a variable font on Google Fonts, so every weight is a separate file.
 * Keep this list minimal; don't add italics without a reason.
 */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  // latin-ext carries the diacritics the handoff asks us to support in guest names.
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Andrew's Final Shift",
  description: "Clock in. One last time.",
  // Unlisted: never indexed, never linked from the nav or sitemap.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  // The link gets pasted into group chats — a bare unfurl inheriting the root layout's
  // "Andrew Yang / Startup founder, builder, barista" undercuts the invitation. Static only:
  // never render roster data into an unfurl.
  openGraph: {
    type: "website",
    title: "Andrew's Final Shift",
    description: "Clock in. One last time.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Mandatory: without it every env(safe-area-inset-*) silently evaluates to 0px.
  viewportFit: "cover",
  themeColor: "#1C1714",
};

export default function FinalShiftLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`fs-root ${instrumentSerif.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      {children}
    </div>
  );
}
