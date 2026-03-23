import fs from "fs";
import path from "path";

export type ThesisRevision = {
  date: string;
  note: string;
};

export type Thesis = {
  title: string;
  category: string;
  slug: string;
  body: string;
  revisions: ThesisRevision[];
};

const THESES_PATH = path.join(process.cwd(), "content", "theses.json");

export function getAllTheses(): Thesis[] {
  if (!fs.existsSync(THESES_PATH)) return [];
  const raw = fs.readFileSync(THESES_PATH, "utf-8");
  return JSON.parse(raw) as Thesis[];
}

export function getThesisBySlug(slug: string): Thesis | null {
  const all = getAllTheses();
  return all.find((t) => t.slug === slug) || null;
}
