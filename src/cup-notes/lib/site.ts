export const SITE_NAME = "The cup note";
export const SITE_BYLINE = "by Andrew Yang";
export const SITE_QUESTION = "What actually hits the cup";

/** Path prefix of the microsite inside the personal site. Every internal link starts with it. */
export const BASE = "/projects/cup-notes";

/** Reporting on the real policy. */
export const SOURCES = [
  {
    href: "https://www.nrn.com/top-500-restaurants/starbucks-baristas-are-writing-more-than-just-names-on-cups-and-not-everyone-is-happy-about-it",
    label: "Nation’s Restaurant News",
  },
  {
    href: "https://bostonglobe.com/2026/05/06/lifestyle/starbucks-baristas-cup-affirmations-union",
    label: "The Boston Globe",
  },
];

/**
 * Open Graph fields for a page below the home. A page's openGraph replaces the layout's whole
 * object, file-based image included, so siteName, type and the home's image are repeated here.
 */
export function pageOpenGraph(title: string, path: string, description: string) {
  return {
    title: `${title} · ${SITE_NAME}`,
    description,
    url: path,
    siteName: SITE_NAME,
    type: "article" as const,
    images: [{ url: `${BASE}/opengraph-image`, width: 1200, height: 630, alt: `${SITE_NAME}: ${SITE_QUESTION}` }],
  };
}

/** A run page. Keys are `{enforcement}-{note}-{traffic}-{staffing}`. */
export function runHref(key: string) {
  return `${BASE}/${key}`;
}
