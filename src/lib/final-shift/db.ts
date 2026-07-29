import postgres, { type Sql } from "postgres";
import { requireEnv } from "@/lib/final-shift/env";

let client: Sql | null = null;

/**
 * The one postgres client, memoized across requests.
 *
 * `prepare: false` is mandatory and must not be "cleaned up" later: POSTGRES_URL points at
 * Supabase's transaction pooler, which hands each statement a different backend connection, so a
 * prepared statement created on one is missing on the next. The failure is intermittent and reads
 * like a database problem rather than a configuration one.
 *
 * `max: 3` because serverless invocations are many and short-lived; a large per-instance pool is
 * how a free-tier Postgres runs out of connections while doing almost no work.
 *
 * No schema creation here. Unlike relora-website, which runs CREATE TABLE IF NOT EXISTS on every
 * request so its environments self-heal, this feature's DDL lives in the seed script — we always
 * seed before deploying, so routes skip five round trips on every cold start.
 */
export function getSql(): Sql {
  if (!client) {
    client = postgres(requireEnv("POSTGRES_URL"), { prepare: false, max: 3 });
  }
  return client;
}
