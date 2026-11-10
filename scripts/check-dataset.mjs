// Fails the build unless the cup-notes dataset is the real model run, complete and logged.
//
// The microsite shows fixture data with a red band, which is fine on a laptop and wrong on the live
// site, so `npm run build` runs this first. It checks that:
// - the index exists and came from the OpenAI batch run rather than the fixture backend;
// - every scenario it lists has a detail file in content/cup-notes/scenarios/;
// - no stray public/cup-notes/ folder is left (an old compile wrote there);
// - content/cup-notes/changelog.json has an entry for this dataset (same prompt version and batch ids;
//   not generated_at, which compile rewrites on every run);
// - a word that must never appear on the site is absent from the cup-notes content and source.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "content", "cup-notes");
const indexPath = path.join(dataDir, "index.json");
const changelogPath = path.join(dataDir, "changelog.json");
const scenarioDir = path.join(dataDir, "scenarios");
const strayDir = path.join(root, "public", "cup-notes");

const rel = (p) => path.relative(root, p);

function fail(message) {
  console.error(`check:dataset failed: ${message}`);
  process.exit(1);
}

function readJson(p) {
  if (!fs.existsSync(p)) fail(`missing ${rel(p)}`);
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (err) {
    fail(`could not parse ${rel(p)}: ${err.message}`);
  }
}

const index = readJson(indexPath);

const source = index?.meta?.source;
if (source !== "openai-batch") {
  fail(`meta.source is "${source}", expected "openai-batch" (fixture data cannot ship)`);
}

const scenarios = Array.isArray(index.scenarios) ? index.scenarios : [];
if (scenarios.length === 0) fail("index lists no scenarios");

const missing = scenarios
  .map((s) => s.key)
  .filter((key) => !fs.existsSync(path.join(scenarioDir, `${key}.json`)));
if (missing.length > 0) {
  fail(`no scenario file for ${missing.length} key(s): ${missing.join(", ")}`);
}

if (fs.existsSync(strayDir)) {
  fail(`${rel(strayDir)} exists; scenario files live in ${rel(scenarioDir)} now. Delete it.`);
}

const changelog = readJson(changelogPath);
if (!Array.isArray(changelog) || changelog.length === 0) {
  fail(`${rel(changelogPath)} is empty; add a changelog entry for this dataset`);
}
const sameIds = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  [...a].sort().join("\n") === [...b].sort().join("\n");
const logged = changelog.some(
  (e) => e?.prompt_version === index.meta.prompt_version && sameIds(e?.batch_ids, index.meta.batch_ids),
);
if (!logged) {
  fail(
    `no entry in ${rel(changelogPath)} matches prompt ${index.meta.prompt_version} and the index's batch ids; add a changelog entry for this dataset`,
  );
}

// Split so this file does not match itself.
const forbidden = new RegExp("\\b" + "Sim" + "ile" + "\\b", "i");
const guarded = [
  path.join(root, "content", "projects.json"),
  dataDir,
  path.join(root, "src", "cup-notes"),
  path.join(root, "src", "app", "projects", "cup-notes"),
];
function* files(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const name of fs.readdirSync(p)) yield* files(path.join(p, name));
  } else {
    yield p;
  }
}
for (const dir of guarded) {
  for (const file of files(dir)) {
    if (forbidden.test(fs.readFileSync(file, "utf-8"))) {
      fail(`${rel(file)} names a word that must not appear on the site; remove it`);
    }
  }
}

console.log(`check:dataset ok: ${scenarios.length} scenarios from ${source}, changelog entry found`);
