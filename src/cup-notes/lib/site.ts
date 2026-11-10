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

/** A run page. Keys are `{enforcement}-{note}-{traffic}-{staffing}`. */
export function runHref(key: string) {
  return `${BASE}/${key}`;
}
