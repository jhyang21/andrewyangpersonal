import type { MetadataRoute } from "next";
import { getAllMemos } from "@/lib/memos";
import { getAllProjects } from "@/lib/projects";
import { departmentHref, getDepartments, getMeta, getStates } from "@/apparatus-signals/lib/data";
import { BASE } from "@/apparatus-signals/lib/site";

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

  // Entries that link elsewhere (the Apparatus Signals microsite) are listed by their own section.
  const projects = getAllProjects()
    .filter((project) => !project.href)
    .map((project) => ({
      url: `${SITE_URL}/projects/${project.slug}`,
      lastModified: project.date ? new Date(project.date) : undefined,
    }));

  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/memos` },
    ...memos,
    { url: `${SITE_URL}/projects` },
    ...projects,
    ...apparatusSignals(),
  ];
}

/** The Apparatus Signals microsite: map, method, changelog, every state and every department. */
function apparatusSignals(): MetadataRoute.Sitemap {
  const lastModified = new Date(getMeta().updated);
  const paths = [BASE, `${BASE}/method`, `${BASE}/changelog`];
  for (const s of getStates()) {
    paths.push(`${BASE}/${s.code.toLowerCase()}`);
    for (const d of getDepartments(s.code)) paths.push(departmentHref(s.code, d));
  }
  return paths.map((p) => ({ url: `${SITE_URL}${p}`, lastModified }));
}
