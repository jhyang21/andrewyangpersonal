import fs from "fs";
import path from "path";

export type MemoRevision = {
  date: string;
  note: string;
};

export type MemoMeta = {
  slug: string;
  title: string;
  date: string;
  summary?: string;
  thesisSlug?: string;
  revisions: MemoRevision[];
};

type MemoData = MemoMeta & {
  content: string;
};

const MEMOS_DIR = path.join(process.cwd(), "content", "memos");

function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = value;
  }
  return { meta, content: match[2].trim() };
}

function parseRevisions(raw: string): MemoRevision[] {
  // Revisions stored in frontmatter as revision_N_date / revision_N_note
  const revisions: MemoRevision[] = [];
  const { meta } = parseFrontmatter(raw);
  let i = 1;
  while (meta[`revision_${i}_date`]) {
    revisions.push({
      date: meta[`revision_${i}_date`],
      note: meta[`revision_${i}_note`] || "",
    });
    i++;
  }
  if (revisions.length === 0 && meta.date) {
    revisions.push({ date: meta.date, note: "First version" });
  }
  return revisions;
}

function getMemoFiles(): string[] {
  if (!fs.existsSync(MEMOS_DIR)) return [];
  return fs.readdirSync(MEMOS_DIR).filter((f) => f.endsWith(".md"));
}

export function getAllMemos(): MemoMeta[] {
  return getMemoFiles()
    .map((file) => {
      const raw = fs.readFileSync(path.join(MEMOS_DIR, file), "utf-8");
      const { meta } = parseFrontmatter(raw);
      return {
        slug: file.replace(/\.md$/, ""),
        title: meta.title || file.replace(/\.md$/, ""),
        date: meta.date || "",
        summary: meta.summary || undefined,
        thesisSlug: meta.thesis || undefined,
        revisions: parseRevisions(raw),
      };
    })
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}

export function getRecentMemos(count: number): MemoMeta[] {
  return getAllMemos().slice(0, count);
}

export function getMemo(slug: string): MemoData | null {
  const filePath = path.join(MEMOS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { meta, content } = parseFrontmatter(raw);
  return {
    slug,
    title: meta.title || slug,
    date: meta.date || "",
    summary: meta.summary || undefined,
    thesisSlug: meta.thesis || undefined,
    revisions: parseRevisions(raw),
    content,
  };
}

export function getAllMemoSlugs(): string[] {
  return getMemoFiles().map((f) => f.replace(/\.md$/, ""));
}
