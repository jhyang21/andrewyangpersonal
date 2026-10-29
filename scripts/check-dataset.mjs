// Fails the build unless the cup-notes dataset is the real model run and complete.
//
// The page shows fixture data with a red band, which is fine on a laptop and wrong on the live site,
// so `npm run build` runs this first. It checks three things: the index exists, it came from the
// OpenAI batch run rather than the fixture backend, and every scenario it lists has a detail file.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "content", "cup-notes", "index.json");
const scenarioDir = path.join(root, "public", "cup-notes", "scenarios");

function fail(message) {
  console.error(`check:dataset failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(indexPath)) fail(`missing ${path.relative(root, indexPath)}`);

let index;
try {
  index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
} catch (err) {
  fail(`could not parse ${path.relative(root, indexPath)}: ${err.message}`);
}

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

console.log(`check:dataset ok: ${scenarios.length} scenarios from ${source}`);
