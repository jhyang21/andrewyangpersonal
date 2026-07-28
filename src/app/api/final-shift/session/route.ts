import { cookies } from "next/headers";
import {
  holdUntil,
  identify,
  json,
  sessionPayload,
  unauthorized,
} from "@/lib/final-shift/api";
import { hashCode, normalizeCode } from "@/lib/final-shift/code";
import { COPY } from "@/lib/final-shift/copy";
import {
  getClientIp,
  hashIp,
  hitRateLimit,
  pruneRateLimits,
  RATE_LIMITS,
} from "@/lib/final-shift/ratelimit";
import { findGuestByCodeHash } from "@/lib/final-shift/repository";
import {
  expiredCookie,
  GUEST_COOKIE,
  guestCookie,
  signGuestSession,
} from "@/lib/final-shift/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One message for every kind of failure, byte for byte.
 *
 * Bad format, unknown code, deactivated guest, tripped honeypot — all of them return this and
 * nothing else. The moment one of them says something different, the response itself sorts the
 * ten thousand candidates for an attacker. Do not add a helpful "that's not four digits" here; the
 * client already says that locally, before any request goes out.
 */
function refuse() {
  return json({ ok: false, message: COPY.clockIn.errors.unknown }, { status: 401 });
}

/** Clock in. */
export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await holdUntil(startedAt);
    return refuse();
  }

  const input = (body ?? {}) as Record<string, unknown>;

  /*
   * Honeypot. Same field name as relora-website so the muscle memory transfers. A real guest never
   * sees it; a form-filling bot fills everything. Nothing is written and nothing distinguishes the
   * response from an unknown code.
   */
  if (typeof input.company === "string" && input.company.trim() !== "") {
    await holdUntil(startedAt);
    return refuse();
  }

  const ip = getClientIp(request);
  const ipKey = await hashIp(ip);

  const [perIp, perDay, global] = await Promise.all([
    hitRateLimit(RATE_LIMITS.clockInPerIp, ipKey),
    hitRateLimit(RATE_LIMITS.clockInPerIpDay, ipKey),
    // One shared key across every caller. This is the window that actually stops a distributed
    // sweep — a per-IP limit does nothing against a few hundred residential proxies.
    hitRateLimit(RATE_LIMITS.clockInGlobal, "all"),
  ]);

  const limited = [perIp, perDay, global].find((state) => state.limited);
  if (limited) {
    await holdUntil(startedAt);
    return json(
      { ok: false, message: COPY.clockIn.errors.rateLimited },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const code = normalizeCode(input.code);
  if (!code) {
    await holdUntil(startedAt);
    return refuse();
  }

  const guest = await findGuestByCodeHash(await hashCode(code));
  if (!guest || !guest.isActive) {
    await holdUntil(startedAt);
    return refuse();
  }

  const payload = await sessionPayload(guest, code);
  const store = await cookies();
  store.set(guestCookie(await signGuestSession(guest.id)));

  // Opportunistic and unawaited: tidying the rate-limit table must not sit between a guest and
  // their own name.
  void pruneRateLimits().catch(() => {});

  await holdUntil(startedAt);
  return json({ ok: true, ...payload });
}

/** Resume — used by the page on load and by the wall. */
export async function GET(): Promise<Response> {
  const identified = await identify();
  if (!identified) return unauthorized();

  /*
   * The code is not returned on resume. It arrived once, in the guest's own hands, and there is no
   * reason for a cookie to be able to read it back out — the badge on the welcome screen is the
   * only place it appears, and a resuming guest is past that screen.
   */
  const payload = await sessionPayload(identified.guest, "");
  return json({ ok: true, ...payload });
}

/**
 * "Not you?" — drops the session.
 *
 * The draft row is deliberately left alone. Someone who mistyped a coworker's number and backed out
 * must not take that coworker's photo and words with them.
 */
export async function DELETE(): Promise<Response> {
  const store = await cookies();
  store.set(expiredCookie(GUEST_COOKIE));
  return json({ ok: true });
}
