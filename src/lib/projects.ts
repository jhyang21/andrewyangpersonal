import fs from "fs";
import path from "path";

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
