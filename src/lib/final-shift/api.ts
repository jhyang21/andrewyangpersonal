import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ensureSubmission,
  getEventConfig,
  getGuestById,
  type GuestRow,
} from "@/lib/final-shift/repository";
import {
  ADMIN_COOKIE,
  GUEST_COOKIE,
  readAdminSession,
  readGuestSession,
} from "@/lib/final-shift/session";
import { createSignedUrl } from "@/lib/final-shift/storage";
import type {
  EventConfig,
  SessionPayload,
  Submission,
} from "@/lib/final-shift/types";

/*
 * Shared plumbing for the route handlers. Everything here is server-side.
 *
 * All routes run on the Node runtime — `postgres` needs a TCP socket, so `export const runtime =
 * "edge"` anywhere in this feature would break the database, not just slow it down.
 */

export const jsonHeaders = {
  // Belt and braces with next.config.ts, which sets the same on /api/final-shift/:path*. A response
  // carrying someone's RSVP must never land in a shared cache.
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

export function json(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { ...jsonHeaders, ...(init?.headers ?? {}) },
  });
}

export type Identified = { guest: GuestRow; event: EventConfig };

/**
 * Resolves the cookie to a live, active guest.
 *
 * `is_active` is re-checked on every request, not just at clock-in. Deactivating someone in Supabase
 * Studio has to take effect now — a 30-day cookie would otherwise keep them in for a month.
 */
export async function identify(): Promise<Identified | null> {
  const store = await cookies();
  const guestId = await readGuestSession(store.get(GUEST_COOKIE)?.value);
  if (!guestId) return null;

  const [guest, event] = await Promise.all([getGuestById(guestId), getEventConfig()]);
  if (!guest || !guest.isActive) return null;

  return { guest, event };
}

export function unauthorized(): NextResponse {
  return json({ ok: false, code: "no_session" }, { status: 401 });
}

export function editsLocked(): NextResponse {
  return json({ ok: false, code: "edits_locked" }, { status: 403 });
}

/** True when the admin cookie is present and live. Independent of any guest session. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return readAdminSession(store.get(ADMIN_COOKIE)?.value);
}

/**
 * The whole state a mounted flow needs: guest, their draft, and the event.
 *
 * Shared by the session route and by the page's server render, so a returning guest is recognised
 * before the first paint and the two paths cannot drift into showing different things.
 *
 * `code` is passed in rather than read, because there is nowhere to read it from — the codes are
 * stored only as HMACs. It carries the guest's number on the one response where they just typed it,
 * and an empty string everywhere else.
 */
export async function sessionPayload(
  guest: { id: string; firstName: string; crewRole: string },
  code: string,
): Promise<SessionPayload> {
  const [stored, event] = await Promise.all([
    ensureSubmission(guest.id),
    getEventConfig(),
  ]);

  // Signed here rather than stored: the URL expires in fifteen minutes, so it belongs to this
  // response and nothing may cache it.
  const photoUrl = stored.photo ? await createSignedUrl(stored.photo.path) : null;

  const submission: Submission = {
    ...stored,
    photo: stored.photo && photoUrl ? { ...stored.photo, url: photoUrl } : null,
  };

  /*
   * The private note is not in here, and must not be added. It belongs to the end of the ceremony;
   * shipping it at clock-in would put it in the network tab twenty minutes before the guest is meant
   * to read it, and would hand it to anyone who ever knew a code.
   */
  return {
    guest: { firstName: guest.firstName, code, crewRole: guest.crewRole },
    submission,
    event,
  };
}

/**
 * Holds a response until at least `floorMs` has passed since `startedAt`.
 *
 * This is the enumeration defence, and it is not decoration. Without it an unknown code returns
 * after one indexed miss while a known one pays for a submission fetch, a cookie signature, and a
 * second query — a difference of tens of milliseconds, stable enough across a few hundred samples
 * to sort ten thousand codes into "real" and "not". Identical response bodies are worthless if the
 * clock still answers the question.
 */
export async function holdUntil(startedAt: number, floorMs = 300): Promise<void> {
  const remaining = floorMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}
