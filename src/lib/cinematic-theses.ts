import fs from "fs";
import path from "path";
import type { CinematicThesis } from "@/types/cinematic";

const CINEMATIC_PATH = path.join(process.cwd(), "content", "cinematic-theses.json");

export function getAllCinematicTheses(): CinematicThesis[] {
  if (!fs.existsSync(CINEMATIC_PATH)) return [];
  const raw = fs.readFileSync(CINEMATIC_PATH, "utf-8");
  return JSON.parse(raw) as CinematicThesis[];
}

export function getCinematicThesisBySlug(slug: string): CinematicThesis | null {
  const all = getAllCinematicTheses();
  return all.find((t) => t.slug === slug) || null;
}
