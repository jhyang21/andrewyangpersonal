import { cookies } from "next/headers";
import { holdUntil, isAdmin, json } from "@/lib/final-shift/api";
import { hmac, timingSafeEqual } from "@/lib/final-shift/crypto";
import { requireEnv } from "@/lib/final-shift/env";
import {
  getClientIp,
  hashIp,
  hitRateLimit,
  RATE_LIMITS,
} from "@/lib/final-shift/ratelimit";
import { getAdminRows, getEventConfig } from "@/lib/final-shift/repository";
import { adminCookie, signAdminSession } from "@/lib/final-shift/session";
import { createSignedUrls } from "@/lib/final-shift/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Passphrase login.
 *
 * The comparison runs over HMACs of the two strings rather than the strings themselves. That gives
 * constant-time equality *and* fixed-length operands, so neither the content nor the length of the
 * real passphrase shows up in the response time — a plain length check before a byte comparison
 * would leak the length on the first request.
 */
export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  const ipKey = await hashIp(getClientIp(request));
  const limit = await hitRateLimit(RATE_LIMITS.adminPerIp, ipKey);
  if (limit.limited) {
    await holdUntil(startedAt);
    return json(
      { ok: false, code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const supplied = (body as { passphrase?: unknown } | null)?.passphrase;
  const secret = requireEnv("FINAL_SHIFT_SESSION_SECRET");
  const [expected, actual] = await Promise.all([
    hmac(secret, `fs-admin:${requireEnv("FINAL_SHIFT_ADMIN_PASSPHRASE")}`),
    hmac(secret, `fs-admin:${typeof supplied === "string" ? supplied : ""}`),
  ]);

  if (!timingSafeEqual(expected, actual)) {
    await holdUntil(startedAt);
    return json({ ok: false, code: "bad_passphrase" }, { status: 401 });
  }

  const store = await cookies();
  store.set(adminCookie(await signAdminSession()));

  await holdUntil(startedAt);
  return json({ ok: true });
}

/**
 * Everything Andrew needs, read-only.
 *
 * Editing happens in Supabase Studio. Building an editor here would mean write routes for roster
 * fields, which is a second, more powerful attack surface behind a single passphrase — for a job
 * that is already one click away in a tool with its own login.
 *
 * The private notes are not in this payload. Their presence is (`hasPrivateNote`, for the coverage
 * check), because that is what Andrew needs to know before the party; the text itself he wrote and
 * can read in Studio, and it has no reason to travel over the wire to a browser.
 */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) {
    return json({ ok: false, code: "no_admin" }, { status: 401 });
  }

  const [rows, event] = await Promise.all([getAdminRows(), getEventConfig()]);

  const paths = rows
    .map((row) => row.photoPath)
    .filter((path): path is string => Boolean(path));
  const signed = await createSignedUrls(paths);

  const guests = rows.map((row) => ({
    guestId: row.guestId,
    firstName: row.firstName,
    crewRole: row.crewRole,
    hasPrivateNote: row.hasPrivateNote,
    status: row.status,
    attending: row.attending,
    availableDates: row.availableDates ?? [],
    dietaryTags: row.dietaryTags ?? [],
    dietaryNote: row.dietaryNote ?? "",
    caption: row.caption ?? "",
    memory: row.memory ?? "",
    wallConsent: row.wallConsent ?? false,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    photoUrl: row.photoPath ? (signed.get(row.photoPath) ?? null) : null,
  }));

  return json({ ok: true, event, guests });
}
