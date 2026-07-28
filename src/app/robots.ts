import type { MetadataRoute } from "next";

const SITE_URL = "https://www.andrewyangpersonal.com";

/*
 * Note the absence of a `disallow` for /final-shift, which is deliberate.
 *
 * robots.txt is a public file, so a Disallow line is an advertisement: it tells anyone reading that
 * the path exists and that someone wanted it hidden. Scrapers mine Disallow lists precisely to find
 * unlisted pages. The `noindex` in the feature layout's metadata and the `X-Robots-Tag` header in
 * next.config.ts do the actual work, and neither of them says anything out loud.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
