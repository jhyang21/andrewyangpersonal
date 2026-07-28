import type { MetadataRoute } from "next";
import { getAllMemos } from "@/lib/memos";

const SITE_URL = "https://www.andrewyangpersonal.com";

/*
 * Lists every public route. `/final-shift` is intentionally absent and must stay that way — with an
 * explicit sitemap the omission is meaningful, and it stops crawlers guessing at paths.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const memos = getAllMemos().map((memo) => ({
    url: `${SITE_URL}/memos/${memo.slug}`,
    lastModified: memo.date ? new Date(memo.date) : undefined,
  }));

  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/theses` },
    { url: `${SITE_URL}/memos` },
    ...memos,
  ];
}
