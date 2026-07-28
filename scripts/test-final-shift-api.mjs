#!/usr/bin/env node
/*
 * Checks the Final Shift API against a running server.
 *
 *   npm run dev                                    (in another terminal)
 *   npm run seed:final-shift -- --sample           (the four invented guests)
 *   npm run test:api:final-shift                   run everything
 *   npm run test:api:final-shift -- --privacy      run one suite
 *
 * Suites: --auth --rate-limit --timing --privacy --draft
 *
 * Plain node and fetch, no test framework. The repo has none and its CLAUDE.md is against adding
 * one; these are eight assertions about a party page, not a reason to take a dependency.
 *
 * IT MUTATES THE DATABASE. It clocks in as sample guest 0001 and writes to that draft. Run it
 * against the sample roster, never against the real one after Andrew's crew has started replying.
 *
 * --rate-limit deliberately trips the clock-in limiter, which then blocks real clock-ins from this
 * IP for ten minutes. It is excluded from the default run for that reason; ask for it by name.
 */

const BASE = process.env.FS_TEST_BASE ?? "http://localhost:3000";
const API = `${BASE}/api/final-shift`;

/** From roster.sample.json. Invented, and the only code this script may ever contain. */
const SAMPLE_CODE = "0001";
const UNKNOWN_CODE = "9137";

const argv = process.argv.slice(2);
const requested = argv.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2));

let passed = 0;
let failed = 0;

function ok(name, detail = "") {
  passed += 1;
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function bad(name, detail) {
  failed += 1;
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition, name, detail = "") {
  if (condition) ok(name, detail);
  else bad(name, detail);
}

async function call(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, headers: response.headers, body, text };
}

/** Clock in and keep the cookie, so the authenticated suites have a session. */
async function clockIn(code = SAMPLE_CODE) {
  const response = await fetch(`${API}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, company: "" }),
  });
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  return { status: response.status, body: await response.json(), cookie };
}

// --- suites -----------------------------------------------------------------

/**
 * The enumeration defence, part one: every rejection is the same rejection.
 *
 * A different message, a different status, or a different key ordering for "no such code" versus
 * "code exists but is deactivated" would sort ten thousand candidates for anyone patient enough to
 * ask. The comparison is on the raw response text, not the parsed object.
 */
async function suiteAuth() {
  console.log("\n--auth");

  const good = await call("/session", {
    method: "POST",
    body: JSON.stringify({ code: SAMPLE_CODE, company: "" }),
  });
  assert(good.status === 200, "valid code returns 200", `got ${good.status}`);
  assert(good.body?.guest?.firstName, "valid code returns a guest");
  assert(
    good.body?.guest?.code === SAMPLE_CODE,
    "clock-in echoes the code the guest just typed",
  );

  const unknown = await call("/session", {
    method: "POST",
    body: JSON.stringify({ code: UNKNOWN_CODE, company: "" }),
  });
  const malformed = await call("/session", {
    method: "POST",
    body: JSON.stringify({ code: "12", company: "" }),
  });
  const nonNumeric = await call("/session", {
    method: "POST",
    body: JSON.stringify({ code: "abcd", company: "" }),
  });
  const honeypot = await call("/session", {
    method: "POST",
    body: JSON.stringify({ code: SAMPLE_CODE, company: "Acme Ltd" }),
  });

  const rejections = { unknown, malformed, nonNumeric, honeypot };
  for (const [name, response] of Object.entries(rejections)) {
    assert(response.status === 401, `${name} returns 401`, `got ${response.status}`);
  }

  const bodies = Object.values(rejections).map((response) => response.text);
  assert(
    new Set(bodies).size === 1,
    "every rejection body is byte-identical",
    `saw ${new Set(bodies).size} distinct bodies`,
  );

  const noSession = await call("/session");
  assert(noSession.status === 401, "GET without a cookie is 401", `got ${noSession.status}`);

  const { cookie } = await clockIn();
  const resumed = await call("/session", { headers: { cookie } });
  assert(resumed.status === 200, "GET with a cookie resumes", `got ${resumed.status}`);
  assert(
    resumed.body?.guest?.code === "",
    "resume does NOT return the code",
    `got ${JSON.stringify(resumed.body?.guest?.code)}`,
  );
}

/** Twelve bad codes in a row must hit the wall, and the wall must not change the story. */
async function suiteRateLimit() {
  console.log("\n--rate-limit");

  let limited = null;
  let lastUnauthorised = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await call("/session", {
      method: "POST",
      body: JSON.stringify({ code: UNKNOWN_CODE, company: "" }),
    });
    if (response.status === 401) lastUnauthorised = response;
    if (response.status === 429) {
      limited = response;
      break;
    }
  }

  assert(limited !== null, "twelve bad codes trip the limiter");
  if (limited) {
    const retryAfter = limited.headers.get("retry-after");
    assert(Boolean(retryAfter), "429 carries Retry-After", `got ${retryAfter}`);
    assert(
      Number.parseInt(retryAfter ?? "0", 10) > 0,
      "Retry-After is a positive number of seconds",
    );
  }
  assert(
    lastUnauthorised !== null && !/rate|limit|slow/i.test(lastUnauthorised.text),
    "the 401 message never mentions rate limiting",
  );
}

/**
 * The enumeration defence, part two: identical bodies are worthless if the clock still answers.
 *
 * A known code costs a submission fetch, a cookie signature, and a second query that an unknown one
 * skips — tens of milliseconds, stable enough over a few hundred samples to sort the space. The
 * server pads every response to a fixed floor; this measures whether it worked.
 */
async function suiteTiming() {
  console.log("\n--timing");

  const samples = { valid: [], invalid: [] };

  for (let round = 0; round < 20; round += 1) {
    for (const kind of ["valid", "invalid"]) {
      const started = performance.now();
      const response = await call("/session", {
        method: "POST",
        body: JSON.stringify({
          code: kind === "valid" ? SAMPLE_CODE : UNKNOWN_CODE,
          company: "",
        }),
      });
      // A tripped limiter would poison the sample with a different code path.
      if (response.status === 429) {
        console.log("  SKIP  rate limited mid-run; wait ten minutes and retry");
        return;
      }
      samples[kind].push(performance.now() - started);
    }
  }

  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  const validMedian = median(samples.valid);
  const invalidMedian = median(samples.invalid);
  const delta = Math.abs(validMedian - invalidMedian);

  console.log(
    `        valid ${validMedian.toFixed(1)}ms · invalid ${invalidMedian.toFixed(1)}ms`,
  );
  assert(delta < 50, "median timing delta is under 50ms", `${delta.toFixed(1)}ms`);
}

/**
 * Acceptance criterion 11, as an executable test.
 *
 * The wall payload is scanned for the things that must never be in it — not by checking a list of
 * expected keys, which would pass happily the day someone adds a new one, but by walking every value
 * in the tree and failing on anything that looks like a four-digit code or a forbidden field name.
 */
async function suitePrivacy() {
  console.log("\n--privacy");

  const anonymous = await call("/wall");
  assert(anonymous.status === 401, "wall refuses without a cookie", `got ${anonymous.status}`);

  const { cookie } = await clockIn();
  const wall = await call("/wall", { headers: { cookie } });
  assert(wall.status === 200, "wall returns 200 with a cookie", `got ${wall.status}`);

  const forbiddenKeys = [
    "code",
    "codeHash",
    "code_hash",
    "attending",
    "dietaryTags",
    "dietary_tags",
    "dietaryNote",
    "dietary_note",
    "privateNote",
    "private_note",
    "availableDates",
    "available_dates",
    "guestId",
    "guest_id",
  ];
  const countKeys = ["count", "total", "cardCount", "responses", "submitted"];

  const seenKeys = new Set();
  const seenValues = [];

  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        seenKeys.add(key);
        walk(value);
      }
      return;
    }
    if (typeof node === "string") seenValues.push(node);
  };
  walk(wall.body);

  const leakedKeys = forbiddenKeys.filter((key) => seenKeys.has(key));
  assert(leakedKeys.length === 0, "no forbidden key in the wall payload", leakedKeys.join(", "));

  const leakedCounts = countKeys.filter((key) => seenKeys.has(key));
  assert(
    leakedCounts.length === 0,
    "no count field anywhere — a total identifies the holdouts",
    leakedCounts.join(", "),
  );

  const codeLike = seenValues.filter((value) => /^\d{4}$/.test(value));
  assert(codeLike.length === 0, "no four-digit string value in the payload", codeLike.join(", "));

  // The note is gated on clocking out, not merely on holding a session.
  const note = await call("/note", { headers: { cookie } });
  assert(
    note.status === 200 || note.status === 403,
    "note answers 200 (submitted) or 403 (not yet)",
    `got ${note.status}`,
  );
  if (note.status === 403) {
    assert(note.body?.code === "not_submitted", "an unsubmitted guest is told why");
  }

  const adminAnonymous = await call("/admin");
  assert(adminAnonymous.status === 401, "admin data refuses a guest cookie", `got ${adminAnonymous.status}`);

  const adminGuest = await call("/admin", { headers: { cookie } });
  assert(
    adminGuest.status === 401,
    "a guest session does not confer admin",
    `got ${adminGuest.status}`,
  );
}

/** PATCH round-trips, ignores nonsense, and stays partial. */
async function suiteDraft() {
  console.log("\n--draft");

  const anonymous = await call("/draft", {
    method: "PATCH",
    body: JSON.stringify({ memory: "nope" }),
  });
  assert(anonymous.status === 401, "draft refuses without a cookie", `got ${anonymous.status}`);

  const { cookie, body: session } = await clockIn();
  const dateId = session?.event?.dateOptions?.[0]?.id;
  assert(Boolean(dateId), "the sample event has at least one date option");

  const first = await call("/draft", {
    method: "PATCH",
    headers: { cookie },
    body: JSON.stringify({
      attending: true,
      availableDates: [dateId, "d-does-not-exist"],
      memory: "  Test memory from the API script.  ",
    }),
  });
  assert(first.status === 200, "PATCH accepts a partial payload", `got ${first.status}`);

  // A second PATCH carrying only the caption must not disturb what the first one wrote.
  await call("/draft", {
    method: "PATCH",
    headers: { cookie },
    body: JSON.stringify({ caption: "Test caption." }),
  });

  const resumed = await call("/session", { headers: { cookie } });
  const submission = resumed.body?.submission;

  assert(submission?.attending === true, "attending round-trips");
  assert(
    Array.isArray(submission?.availableDates) &&
      submission.availableDates.length === 1 &&
      submission.availableDates[0] === dateId,
    "an unknown date id is dropped, the real one is kept",
    JSON.stringify(submission?.availableDates),
  );
  assert(
    submission?.memory === "Test memory from the API script.",
    "text is trimmed on the way in",
  );
  assert(
    submission?.caption === "Test caption." && submission?.attending === true,
    "a caption-only PATCH leaves the earlier answers alone",
  );

  const overlong = "x".repeat(400);
  await call("/draft", {
    method: "PATCH",
    headers: { cookie },
    body: JSON.stringify({ memory: overlong }),
  });
  const capped = await call("/session", { headers: { cookie } });
  assert(
    (capped.body?.submission?.memory ?? "").length === 180,
    "a 400-character memory is capped at 180 server-side",
    `${(capped.body?.submission?.memory ?? "").length} chars`,
  );

  // Leave the sample draft roughly as we found it.
  await call("/draft", {
    method: "PATCH",
    headers: { cookie },
    body: JSON.stringify({ memory: "", caption: "", attending: null, availableDates: [] }),
  });
}

// --- runner -----------------------------------------------------------------

const SUITES = {
  auth: suiteAuth,
  privacy: suitePrivacy,
  draft: suiteDraft,
  timing: suiteTiming,
  // Not in the default run: it deliberately trips the clock-in limiter for this IP.
  "rate-limit": suiteRateLimit,
};

const DEFAULT = ["auth", "privacy", "draft", "timing"];

async function main() {
  try {
    const probe = await fetch(BASE, { method: "HEAD" });
    if (!probe.ok && probe.status >= 500) throw new Error(String(probe.status));
  } catch {
    console.error(`No server at ${BASE}. Start one with \`npm run dev\`.`);
    process.exit(1);
  }

  const names = requested.length > 0 ? requested : DEFAULT;
  const unknown = names.filter((name) => !(name in SUITES));
  if (unknown.length > 0) {
    console.error(`Unknown suite: ${unknown.join(", ")}`);
    console.error(`Available: ${Object.keys(SUITES).map((n) => `--${n}`).join(" ")}`);
    process.exit(1);
  }

  for (const name of names) {
    try {
      await SUITES[name]();
    } catch (error) {
      bad(`--${name} threw`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

await main();
