import { hmac } from "@/lib/final-shift/crypto";
import { getSql } from "@/lib/final-shift/db";
import { requireEnv } from "@/lib/final-shift/env";

export type RateLimitState = { limited: boolean; retryAfterSeconds: number };

type Row = { count: number; retry_after_seconds: number };

const MINUTE = 60;

/**
 * Every window in the feature, in one place.
 *
 * The numbers are set against a guest list of fewer than ten people, where the legitimate rate is a
 * handful of requests *per day*. That's what makes limits this tight safe.
 *
 * `global` is the one that actually stops enumeration. A per-IP limit does nothing against two
 * hundred residential proxies, which is the shape any real attempt at a four-digit space would
 * take. Forty attempts per ten minutes across everyone caps a full 10,000-code sweep at well over a
 * week while staying an order of magnitude above anything the real crew will ever produce.
 */
export const RATE_LIMITS = {
  clockInPerIp: { key: "fs:ip", windowSeconds: 10 * MINUTE, max: 8 },
  clockInPerIpDay: { key: "fs:ipday", windowSeconds: 24 * 60 * MINUTE, max: 30 },
  clockInGlobal: { key: "fs:global", windowSeconds: 10 * MINUTE, max: 40 },
  uploadPerGuest: { key: "fs:upload", windowSeconds: 60 * MINUTE, max: 20 },
  adminPerIp: { key: "fs:admin", windowSeconds: 10 * MINUTE, max: 5 },
} as const;

export type RateLimitRule = (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS];

/**
 * IPs become keys only after hashing, so the table never holds an address in the clear.
 *
 * It reuses the session secret rather than adding a sixth environment variable: the property we
 * need is that the mapping is unguessable to anyone reading the table, not that it's separable from
 * the other secrets.
 */
export async function hashIp(ip: string): Promise<string> {
  return (await hmac(requireEnv("FINAL_SHIFT_SESSION_SECRET"), `fs-ip:${ip}`)).slice(0, 22);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * One atomic upsert per check — no Redis, no read-then-write race.
 *
 * The whole window lives in a single statement: the row is inserted or updated, the window resets
 * itself if it has aged out, and the count comes back in the same round trip. Two concurrent
 * requests can't both read "count = 7" and both write 8, which is exactly the hole a
 * SELECT-then-UPDATE version would have.
 *
 * Ported from relora-website's waitlist route, where it has been the standing pattern — but into our
 * own schema, not the `api_rate_limits` table that lives there. Sharing a Supabase project is not a
 * reason to share a table: this one has to be droppable with the rest of the party.
 */
export async function hitRateLimit(
  rule: RateLimitRule,
  scope: string,
): Promise<RateLimitState> {
  const sql = getSql();
  const key = `${rule.key}:${scope}`;
  const window = rule.windowSeconds;

  const [row] = await sql<Row[]>`
    WITH upserted AS (
      INSERT INTO final_shift.rate_limits AS rl (key, window_start, count)
      VALUES (${key}, NOW(), 1)
      ON CONFLICT (key)
      DO UPDATE SET
        window_start = CASE
          WHEN rl.window_start <= NOW() - (${window} * INTERVAL '1 second') THEN NOW()
          ELSE rl.window_start
        END,
        count = CASE
          WHEN rl.window_start <= NOW() - (${window} * INTERVAL '1 second') THEN 1
          ELSE rl.count + 1
        END
      RETURNING window_start, count
    )
    SELECT
      count,
      GREATEST(
        0,
        ${window}::int - FLOOR(EXTRACT(EPOCH FROM (NOW() - window_start)))::int
      )::int AS retry_after_seconds
    FROM upserted
  `;

  if (!row) return { limited: false, retryAfterSeconds: 0 };
  return { limited: row.count > rule.max, retryAfterSeconds: row.retry_after_seconds };
}

/** Drops rows whose window closed long ago. Cheap, and called opportunistically. */
export async function pruneRateLimits(): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM final_shift.rate_limits
    WHERE window_start <= NOW() - INTERVAL '48 hours'
  `;
}
