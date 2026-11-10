import type { MetadataRoute } from "next";
import { getAllMemos } from "@/lib/memos";
import { getAllProjects } from "@/lib/projects";
import { departmentHref, getDepartments, getMeta, getStates } from "@/apparatus-signals/lib/data";
import { BASE } from "@/apparatus-signals/lib/site";
import { getIndex as getCupNotesData, getRunKeys } from "@/cup-notes/lib/data";
import { BASE as CUP_NOTES_BASE, runHref } from "@/cup-notes/lib/site";

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

  // Entries with their own href are not /projects pages, so they are left out here; the Apparatus
  // Signals microsite has its own section below. The cup-notes home is listed here like any project,
  // and its sub-pages in their own section.
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
    ...cupNotes(),
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

/** The cup-notes sub-pages: method, changelog and every run. The home is in the projects list above. */
function cupNotes(): MetadataRoute.Sitemap {
  const lastModified = new Date(getCupNotesData().meta.generated_at);
  const paths = [`${CUP_NOTES_BASE}/method`, `${CUP_NOTES_BASE}/changelog`, ...getRunKeys().map(runHref)];
  return paths.map((p) => ({ url: `${SITE_URL}${p}`, lastModified }));
}
