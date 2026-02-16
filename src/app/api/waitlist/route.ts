import postgres, { type Sql } from "postgres";
import { NextResponse } from "next/server";
import {
  COMMITMENT_OPTIONS,
  EMOTIONAL_HOOK_OPTIONS,
  FEATURE_SIGNAL_OPTIONS,
  IDENTITY_OPTIONS,
} from "@/lib/waitlistOptions";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_GOLD_INSIGHT_LENGTH = 500;
const MAX_IDENTITY_OTHER_LENGTH = 120;
const OTHER_IDENTITY_OPTION = "Other";
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 20;
const RATE_LIMIT_MAX_REQUESTS_PER_EMAIL = 5;
const RATE_LIMIT_PRUNE_AGE_SECONDS = RATE_LIMIT_WINDOW_SECONDS * 2;
let sqlClient: Sql | null = null;
let schemaReadyPromise: Promise<void> | null = null;

type RateLimitResult = {
  count: number;
  retry_after_seconds: number;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFeatureSignal(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim();
    if (FEATURE_SIGNAL_OPTIONS.has(normalized)) {
      unique.add(normalized);
    }
  }
  return [...unique];
}

function getSqlClient() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("Missing POSTGRES_URL environment variable.");
  }

  if (!sqlClient) {
    // Keep prepared statements off for compatibility with transaction poolers.
    sqlClient = postgres(process.env.POSTGRES_URL, { prepare: false });
  }

  return sqlClient;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

async function ensureWaitlistSchema(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS waitlist_signups (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE waitlist_signups
    ADD COLUMN IF NOT EXISTS identity TEXT
  `;

  await sql`
    ALTER TABLE waitlist_signups
    ADD COLUMN IF NOT EXISTS emotional_hook TEXT
  `;

  await sql`
    ALTER TABLE waitlist_signups
    ADD COLUMN IF NOT EXISTS gold_insight TEXT
  `;

  await sql`
    ALTER TABLE waitlist_signups
    ADD COLUMN IF NOT EXISTS feature_signal TEXT
  `;

  await sql`
    ALTER TABLE waitlist_signups
    ADD COLUMN IF NOT EXISTS commitment TEXT
  `;

  await sql`
    ALTER TABLE waitlist_signups
    ADD COLUMN IF NOT EXISTS identity_other TEXT
  `;

  await sql`
    ALTER TABLE waitlist_signups
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_key
    ON waitlist_signups (email)
  `;
}

async function ensureRateLimitSchema(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS api_rate_limits (
      key TEXT PRIMARY KEY,
      window_start TIMESTAMPTZ NOT NULL,
      count INTEGER NOT NULL
    )
  `;
}

async function ensureSchemas(sql: Sql) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await ensureWaitlistSchema(sql);
      await ensureRateLimitSchema(sql);
    })();
  }

  try {
    await schemaReadyPromise;
  } catch (error) {
    schemaReadyPromise = null;
    throw error;
  }
}

async function pruneRateLimitRows(sql: Sql) {
  await sql`
    DELETE FROM api_rate_limits
    WHERE window_start <= NOW() - (${RATE_LIMIT_PRUNE_AGE_SECONDS} * INTERVAL '1 second')
  `;
}

async function hitRateLimit(sql: Sql, key: string, maxRequests: number) {
  const [result] = await sql<RateLimitResult[]>`
    WITH upserted AS (
      INSERT INTO api_rate_limits AS rl (key, window_start, count)
      VALUES (${key}, NOW(), 1)
      ON CONFLICT (key)
      DO UPDATE SET
        window_start = CASE
          WHEN rl.window_start <= NOW() - (${RATE_LIMIT_WINDOW_SECONDS} * INTERVAL '1 second')
            THEN NOW()
          ELSE rl.window_start
        END,
        count = CASE
          WHEN rl.window_start <= NOW() - (${RATE_LIMIT_WINDOW_SECONDS} * INTERVAL '1 second')
            THEN 1
          ELSE rl.count + 1
        END
      RETURNING window_start, count
    )
    SELECT
      count,
      GREATEST(
        0,
        ${RATE_LIMIT_WINDOW_SECONDS}::int - FLOOR(EXTRACT(EPOCH FROM (NOW() - window_start)))::int
      )::int AS retry_after_seconds
    FROM upserted
  `;

  if (!result) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  return {
    limited: result.count > maxRequests,
    retryAfterSeconds: result.retry_after_seconds,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ipAddress = getClientIp(request);

    const email = normalizeEmail(normalizeText(body.email));
    const company = normalizeText(body.company);
    const identity = normalizeText(body.identity);
    const identityOther = normalizeText(body.identityOther);
    const emotionalHook = normalizeText(body.emotionalHook);
    const goldInsight = normalizeText(body.goldInsight);
    const commitment = normalizeText(body.commitment);
    const featureSignals = normalizeFeatureSignal(body.featureSignal);

    if (company.length > 0) {
      return NextResponse.json({ ok: true, message: "Saved." }, { status: 200 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { ok: false, message: "Please provide a valid email address." },
        { status: 400 },
      );
    }

    if (!IDENTITY_OPTIONS.has(identity)) {
      return NextResponse.json({ ok: false, message: "Please choose what best describes you." }, { status: 400 });
    }

    if (identity === OTHER_IDENTITY_OPTION && identityOther.length === 0) {
      return NextResponse.json({ ok: false, message: "Please share what best describes you." }, { status: 400 });
    }

    if (identityOther.length > MAX_IDENTITY_OTHER_LENGTH) {
      return NextResponse.json(
        { ok: false, message: "Please keep your custom identity under 120 characters." },
        { status: 400 },
      );
    }

    if (!EMOTIONAL_HOOK_OPTIONS.has(emotionalHook)) {
      return NextResponse.json(
        { ok: false, message: "Please choose how often this happens for you." },
        { status: 400 },
      );
    }

    if (goldInsight.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Please share one detail you wish you had remembered." },
        { status: 400 },
      );
    }

    if (goldInsight.length > MAX_GOLD_INSIGHT_LENGTH) {
      return NextResponse.json(
        { ok: false, message: "Please keep your response under 500 characters." },
        { status: 400 },
      );
    }

    if (featureSignals.length === 0 || featureSignals.length > 2) {
      return NextResponse.json(
        { ok: false, message: "Please select one or two features that matter most." },
        { status: 400 },
      );
    }

    if (!COMMITMENT_OPTIONS.has(commitment)) {
      return NextResponse.json(
        { ok: false, message: "Please choose one beta access option to continue." },
        { status: 400 },
      );
    }

    const identityOtherValue = identity === OTHER_IDENTITY_OPTION ? identityOther : null;

    const sql = getSqlClient();
    await ensureSchemas(sql);
    await pruneRateLimitRows(sql);

    if (ipAddress !== "unknown") {
      const ipLimitResult = await hitRateLimit(sql, `ip:${ipAddress}`, RATE_LIMIT_MAX_REQUESTS_PER_IP);
      if (ipLimitResult.limited) {
        return NextResponse.json(
          { ok: false, code: "rate_limited", message: "Too many requests. Please try again in a minute." },
          { status: 429, headers: { "Retry-After": String(ipLimitResult.retryAfterSeconds) } },
        );
      }
    }

    const emailLimitResult = await hitRateLimit(sql, `email:${email}`, RATE_LIMIT_MAX_REQUESTS_PER_EMAIL);
    if (emailLimitResult.limited) {
      return NextResponse.json(
        { ok: false, code: "rate_limited", message: "Too many requests. Please try again in a minute." },
        { status: 429, headers: { "Retry-After": String(emailLimitResult.retryAfterSeconds) } },
      );
    }

    const [insertedSignup] = await sql<{ id: number }[]>`
      INSERT INTO waitlist_signups (
        email,
        identity,
        identity_other,
        emotional_hook,
        gold_insight,
        feature_signal,
        commitment
      )
      VALUES (
        ${email},
        ${identity},
        ${identityOtherValue},
        ${emotionalHook},
        ${goldInsight},
        ${featureSignals.join(", ")},
        ${commitment}
      )
      ON CONFLICT (email)
      DO NOTHING
      RETURNING id
    `;

    if (insertedSignup) {
      return NextResponse.json(
        { ok: true, code: "created", message: "Thanks for joining the waitlist." },
        { status: 200 },
      );
    }

    await sql`
      UPDATE waitlist_signups
      SET
        identity = ${identity},
        identity_other = ${identityOtherValue},
        emotional_hook = ${emotionalHook},
        gold_insight = ${goldInsight},
        feature_signal = ${featureSignals.join(", ")},
        commitment = ${commitment}
      WHERE email = ${email}
    `;

    return NextResponse.json(
      { ok: true, code: "updated", message: "You are already on the waitlist. We updated your responses." },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not save your signup right now." },
      { status: 500 },
    );
  }
}
