import type { MetadataRoute } from "next";
import { getAllMemos } from "@/lib/memos";
import { getAllProjects } from "@/lib/projects";

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

  const projects = getAllProjects().map((project) => ({
    url: `${SITE_URL}/projects/${project.slug}`,
    lastModified: project.date ? new Date(project.date) : undefined,
  }));

  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/memos` },
    ...memos,
    { url: `${SITE_URL}/projects` },
    ...projects,
  ];
}
