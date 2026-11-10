// Typed loaders for the cup-notes data. Server only: this module reads the file system at build
// time. Never import it from a "use client" file, or from a module a client file imports.
import fs from "node:fs";
import path from "node:path";
import type {
  ChangelogEntry,
  CupNotesIndex,
  LeverKey,
  LeverText,
  Prompt,
  ScenarioDetail,
} from "./types";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "content", "cup-notes");
/* The generator's config. The build reads it, so it must never be excluded from the deploy. */
const CONFIG_DIR = path.join(ROOT, "simulation", "config");

const cache = new Map<string, unknown>();

function readText(file: string): string {
  if (cache.has(file)) return cache.get(file) as string;
  if (!fs.existsSync(file)) throw new Error(`Missing data file: ${path.relative(ROOT, file)}`);
  const text = fs.readFileSync(file, "utf8");
  cache.set(file, text);
  return text;
}

function readJson<T>(file: string): T {
  return JSON.parse(readText(file)) as T;
}

export function getIndex(): CupNotesIndex {
  return readJson<CupNotesIndex>(path.join(DATA_DIR, "index.json"));
}

export function getRunKeys(): string[] {
  return getIndex().scenarios.map((s) => s.key);
}

/** One run's full record, or undefined when the key is not one of the runs in the index. */
export function getRun(key: string): ScenarioDetail | undefined {
  if (!getRunKeys().includes(key)) return undefined;
  return readJson<ScenarioDetail>(path.join(DATA_DIR, "scenarios", `${key}.json`));
}

type LeverConfig = Record<
  LeverKey,
  { key: string; policy_text?: string; description?: string }[]
>;

/** The memo text the managers saw for each option, verbatim from simulation/config/levers.json. */
export function getLeverText(): LeverText {
  const config = readJson<LeverConfig>(path.join(CONFIG_DIR, "levers.json"));
  const out = {} as LeverText;
  for (const lever of Object.keys(config) as LeverKey[]) {
    out[lever] = Object.fromEntries(
      config[lever].map((o) => [o.key, o.policy_text ?? o.description ?? ""]),
    );
  }
  return out;
}

const STAGES: Prompt["stage"][] = ["manager", "barista", "customer"];

/** The three prompt files for a version, split on their `## system` and `## user` headings. */
export function getPrompts(version = getIndex().meta.prompt_version): Prompt[] {
  return STAGES.map((stage) => {
    const raw = readText(path.join(CONFIG_DIR, "prompts", version, `${stage}.md`));
    const sections: Record<string, string[]> = {};
    let current: string | null = null;
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith("## ")) {
        current = line.slice(3).trim();
        sections[current] = [];
      } else if (current) {
        sections[current].push(line);
      }
    }
    const part = (name: string) => (sections[name] ?? []).join("\n").trim();
    return { stage, system: part("system"), user: part("user") };
  });
}

export function getChangelog(): ChangelogEntry[] {
  const value = readJson<ChangelogEntry[]>(path.join(DATA_DIR, "changelog.json"));
  if (!Array.isArray(value)) throw new Error("content/cup-notes/changelog.json must be a JSON array");
  return value;
}
