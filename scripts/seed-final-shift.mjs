#!/usr/bin/env node
/*
 * Creates the `final_shift` schema and loads the roster.
 *
 *   npm run seed:final-shift                 roster.local.json if it exists, else the sample
 *   npm run seed:final-shift -- --sample     force the sample roster
 *   npm run seed:final-shift -- --check      print what's in the database, change nothing
 *
 * To remove the whole thing afterwards: `DROP SCHEMA final_shift CASCADE;` in the SQL editor, then
 * delete the storage bucket. Nothing this feature made lives anywhere else.
 *
 * This script owns the DDL. relora-website creates its tables inline on every request so its
 * environments self-heal; here we always seed before deploying, so the routes skip five round trips
 * on every cold start and the schema has exactly one definition to read.
 *
 * It is idempotent — CREATE ... IF NOT EXISTS and upserts throughout — so running it again after
 * adding a late guest is the normal way to add a late guest.
 *
 * Codes are hashed on the way in and never stored in the clear. The plaintext never leaves
 * roster.local.json, which git ignores.
 */

import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const args = process.argv.slice(2);
const forceSample = args.includes("--sample");
const checkOnly = args.includes("--check");

function loadEnvFile(name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, "").trim();
  }
}

// Next loads .env.local itself; a plain node script has to do it by hand.
loadEnvFile(".env.local");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Put it in .env.local (and in Vercel for Production + Preview).`);
    process.exit(1);
  }
  return value;
}

function hashCode(code) {
  return createHmac("sha256", requireEnv("FINAL_SHIFT_CODE_PEPPER"))
    .update(`fs-code:${code}`)
    .digest("base64url");
}

function loadRoster() {
  const local = resolve(root, "content/final-shift/roster.local.json");
  const sample = resolve(root, "content/final-shift/roster.sample.json");

  if (!forceSample && existsSync(local)) {
    return { path: local, data: JSON.parse(readFileSync(local, "utf8")), real: true };
  }
  return { path: sample, data: JSON.parse(readFileSync(sample, "utf8")), real: false };
}

function validateRoster(data) {
  const problems = [];
  if (!data.event) problems.push("no `event` object");
  if (!Array.isArray(data.guests) || data.guests.length === 0) problems.push("no `guests`");

  const seen = new Set();
  for (const guest of data.guests ?? []) {
    if (!/^\d{4}$/.test(guest.code ?? "")) {
      problems.push(`guest "${guest.firstName ?? "?"}" has a code that isn't four digits`);
    }
    if (seen.has(guest.code)) problems.push(`duplicate code for "${guest.firstName}"`);
    seen.add(guest.code);
    if (!guest.firstName) problems.push("a guest has no firstName");
    if (!guest.crewRole) problems.push(`guest "${guest.firstName}" has no crewRole`);
  }

  const ids = new Set();
  for (const option of data.event?.dateOptions ?? []) {
    if (!option.id || !option.startsAt || !option.label) {
      problems.push("a date option is missing id, startsAt, or label");
    }
    if (ids.has(option.id)) problems.push(`duplicate date option id "${option.id}"`);
    ids.add(option.id);
  }

  return problems;
}

async function createSchema(sql) {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  /*
   * Everything lives in its own schema, and that is the point.
   *
   * This feature shares a Supabase project with the rest of the site, so it has to be removable
   * without a checklist. One schema means teardown is one statement that cannot miss a table:
   *
   *   DROP SCHEMA final_shift CASCADE;
   *
   * It also settles the name collision: `api_rate_limits` is a table relora-website already owns,
   * and the party sharing a project with it must not share that table. Two other things fall out of
   * this for free — PostgREST only exposes `public` unless a schema is added to its list, so none of
   * these tables are reachable through the auto-generated REST API at all; and nothing here can
   * shadow or be shadowed by a table the site adds later.
   */
  await sql`CREATE SCHEMA IF NOT EXISTS final_shift`;

  await sql`
    CREATE TABLE IF NOT EXISTS final_shift.guests (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code_hash    text NOT NULL UNIQUE,
      first_name   text NOT NULL,
      crew_role    text NOT NULL,
      private_note text,
      is_active    boolean NOT NULL DEFAULT true,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS final_shift.submissions (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      guest_id         uuid NOT NULL UNIQUE REFERENCES final_shift.guests(id) ON DELETE CASCADE,
      status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
      attending        boolean,
      available_dates  text[] NOT NULL DEFAULT '{}',
      dietary_tags     text[] NOT NULL DEFAULT '{}',
      dietary_note     text CHECK (char_length(dietary_note) <= 160),
      photo_path       text,
      photo_width      integer,
      photo_height     integer,
      photo_bytes      integer,
      caption          text CHECK (char_length(caption) <= 60),
      memory           text CHECK (char_length(memory) <= 180),
      wall_consent     boolean NOT NULL DEFAULT false,
      submitted_at     timestamptz,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now()
    )
  `;

  // Partial index: the wall query is the only hot read, and it only ever wants these rows.
  await sql`
    CREATE INDEX IF NOT EXISTS submissions_wall_idx
    ON final_shift.submissions (submitted_at DESC)
    WHERE status = 'submitted' AND wall_consent = true
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS final_shift.event_config (
      id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      event_name    text NOT NULL,
      subtitle      text NOT NULL,
      contact_line  text NOT NULL,
      date_options  jsonb NOT NULL DEFAULT '[]',
      dietary_chips jsonb NOT NULL DEFAULT '[]',
      wall_enabled  boolean NOT NULL DEFAULT true,
      edits_locked  boolean NOT NULL DEFAULT false,
      updated_at    timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS final_shift.rate_limits (
      key          text PRIMARY KEY,
      window_start timestamptz NOT NULL,
      count        integer NOT NULL
    )
  `;
}

async function seedEvent(sql, event) {
  await sql`
    INSERT INTO final_shift.event_config
      (id, event_name, subtitle, contact_line, date_options, dietary_chips, wall_enabled, edits_locked, updated_at)
    VALUES
      (1, ${event.eventName}, ${event.subtitle}, ${event.contactLine},
       ${sql.json(event.dateOptions ?? [])}, ${sql.json(event.dietaryChips ?? [])},
       ${event.wallEnabled ?? true}, ${event.editsLocked ?? false}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      event_name    = EXCLUDED.event_name,
      subtitle      = EXCLUDED.subtitle,
      contact_line  = EXCLUDED.contact_line,
      date_options  = EXCLUDED.date_options,
      dietary_chips = EXCLUDED.dietary_chips,
      wall_enabled  = EXCLUDED.wall_enabled,
      edits_locked  = EXCLUDED.edits_locked,
      updated_at    = NOW()
  `;
}

async function seedGuests(sql, guests) {
  for (const guest of guests) {
    await sql`
      INSERT INTO final_shift.guests (code_hash, first_name, crew_role, private_note, is_active, updated_at)
      VALUES (${hashCode(guest.code)}, ${guest.firstName}, ${guest.crewRole},
              ${guest.privateNote ?? null}, ${guest.isActive ?? true}, NOW())
      ON CONFLICT (code_hash) DO UPDATE SET
        first_name   = EXCLUDED.first_name,
        crew_role    = EXCLUDED.crew_role,
        private_note = EXCLUDED.private_note,
        is_active    = EXCLUDED.is_active,
        updated_at   = NOW()
    `;
  }

  /*
   * Guests are never deleted here, even when they vanish from the roster file. A row carries the
   * guest's submission by foreign key, and ON DELETE CASCADE means removing them would take their
   * photo and their words with it. Set "isActive": false instead — the clock-in route refuses them
   * with the same message as an unknown code, and nothing is destroyed.
   */
}

async function report(sql) {
  const [config] = await sql`SELECT event_name, edits_locked, wall_enabled FROM final_shift.event_config WHERE id = 1`;
  const rows = await sql`
    SELECT g.first_name, g.crew_role, g.is_active,
           (g.private_note IS NOT NULL AND g.private_note <> '') AS has_note,
           s.status, s.attending, s.photo_path IS NOT NULL AS has_photo
    FROM final_shift.guests g
    LEFT JOIN final_shift.submissions s ON s.guest_id = g.id
    ORDER BY g.first_name
  `;

  console.log(`\nEvent:  ${config?.event_name ?? "(none)"}`);
  console.log(`Wall:   ${config?.wall_enabled ? "on" : "off"}   Edits: ${config?.edits_locked ? "LOCKED" : "open"}`);
  console.log(`Guests: ${rows.length}\n`);

  for (const row of rows) {
    const flags = [
      row.is_active ? null : "inactive",
      row.has_note ? null : "NO PRIVATE NOTE",
      row.status ?? "not clocked in",
      row.has_photo ? "photo" : null,
    ].filter(Boolean);
    console.log(`  ${row.first_name.padEnd(14)} ${flags.join(", ")}`);
  }
  console.log("");
}

async function main() {
  const sql = postgres(requireEnv("POSTGRES_URL"), { prepare: false, max: 1 });

  try {
    if (checkOnly) {
      await report(sql);
      return;
    }

    const roster = loadRoster();
    const problems = validateRoster(roster.data);
    if (problems.length) {
      console.error(`\nRoster at ${roster.path} has problems:`);
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }

    console.log(`Seeding from ${roster.real ? "the REAL roster" : "the sample roster"}: ${roster.path}`);

    await createSchema(sql);
    await seedEvent(sql, roster.data.event);
    await seedGuests(sql, roster.data.guests);

    if (!roster.real) {
      console.log("\nThese are invented guests. Create content/final-shift/roster.local.json for the real ones.");
    }

    await report(sql);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
