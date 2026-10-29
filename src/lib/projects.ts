import fs from "fs";
import path from "path";
import type { CupNotesIndex } from "@/lib/cup-notes/types";

export type Project = {
  title: string;
  slug: string;
  date: string;
  summary: string;
};

/**
 * The Brent–WTI dataset, stored as parallel arrays rather than a row per day.
 *
 * 1,368 rows of six fields is roughly a third the size this way, and it ships to the browser whole —
 * the chart reads every series on every frame, so there is nothing to gain from a row shape.
 * `baseline` is null for the first 251 trading days, before the 252-day rolling median has a window.
 */
export type BrentWtiSeries = {
  dates: string[];
  brent: number[];
  wti: number[];
  spread: number[];
  pct: number[];
  baseline: (number | null)[];
};

const PROJECTS_PATH = path.join(process.cwd(), "content", "projects.json");
const BRENT_WTI_PATH = path.join(
  process.cwd(),
  "content",
  "brent-wti-spread.json",
);
const CUP_NOTES_INDEX_PATH = path.join(
  process.cwd(),
  "content",
  "cup-notes",
  "index.json",
);

export function getAllProjects(): Project[] {
  if (!fs.existsSync(PROJECTS_PATH)) return [];
  const raw = fs.readFileSync(PROJECTS_PATH, "utf-8");
  return JSON.parse(raw) as Project[];
}

export function getProjectBySlug(slug: string): Project | null {
  return getAllProjects().find((p) => p.slug === slug) || null;
}

export function getBrentWtiSeries(): BrentWtiSeries {
  const raw = fs.readFileSync(BRENT_WTI_PATH, "utf-8");
  return JSON.parse(raw) as BrentWtiSeries;
}

/**
 * The cup-notes index: levers, people and the 24 scenario summaries. The per-scenario detail files are
 * too large to inline, so they sit in `public/cup-notes/scenarios/` and the demo fetches them on demand.
 */
export function getCupNotesIndex(): CupNotesIndex {
  const raw = fs.readFileSync(CUP_NOTES_INDEX_PATH, "utf-8");
  return JSON.parse(raw) as CupNotesIndex;
}
