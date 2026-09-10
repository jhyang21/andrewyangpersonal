import type { MetadataRoute } from "next";

const SITE_URL = "https://www.andrewyangpersonal.com";

/*
 * Note the absence of a `disallow` for /shape-lab, which is deliberate.
 *
 * robots.txt is a public file, so a Disallow line is an advertisement: it tells anyone reading that
 * the path exists and that someone wanted it hidden. Scrapers mine Disallow lists precisely to find
 * unlisted pages. The `noindex` in the page's own metadata does the actual work, and it does not say
 * anything out loud.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
