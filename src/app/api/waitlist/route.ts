import postgres, { type Sql } from "postgres";
import { NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INTENT_LENGTH = 300;
let sqlClient: Sql | null = null;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      intent?: string;
      company?: string;
    };

    const email = normalizeEmail(body.email ?? "");
    const intent = (body.intent ?? "").trim();
    const company = (body.company ?? "").trim();

    if (company.length > 0) {
      return NextResponse.json({ ok: true, message: "Saved." }, { status: 200 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { ok: false, message: "Please provide a valid email address." },
        { status: 400 },
      );
    }

    if (intent.length > MAX_INTENT_LENGTH) {
      return NextResponse.json(
        { ok: false, message: "Please keep your note under 300 characters." },
        { status: 400 },
      );
    }

    const sql = getSqlClient();

    await sql`
      CREATE TABLE IF NOT EXISTS waitlist_signups (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        intent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO waitlist_signups (email, intent)
      VALUES (${email}, ${intent || null})
      ON CONFLICT (email)
      DO UPDATE SET intent = EXCLUDED.intent
    `;

    return NextResponse.json({ ok: true, message: "Thanks for joining the waitlist." }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not save your signup right now." },
      { status: 500 },
    );
  }
}
