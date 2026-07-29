import {
  base64urlDecodeText,
  base64urlEncodeText,
  hmac,
  timingSafeEqual,
} from "@/lib/final-shift/crypto";
import { requireEnv } from "@/lib/final-shift/env";

export const GUEST_COOKIE = "fs_session";
export const ADMIN_COOKIE = "fs_admin";

/**
 * Thirty days.
 *
 * Longer than a form needs, and deliberately so: the point of the farewell wall is that guests come
 * back to it over the weeks between the RSVP and the party. A one-day session would put the keypad
 * in front of someone who just wants to reread what the crew wrote.
 */
const GUEST_MAX_AGE = 30 * 24 * 60 * 60;
const ADMIN_MAX_AGE = 7 * 24 * 60 * 60;

const VERSION = "v1";

type GuestClaims = { g: string; iat: number; exp: number };
type AdminClaims = { a: true; iat: number; exp: number };

function now(): number {
  return Math.floor(Date.now() / 1000);
}

async function sign(secret: string, payload: string): Promise<string> {
  return `${VERSION}.${payload}.${await hmac(secret, `${VERSION}.${payload}`)}`;
}

async function verify(secret: string, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [version, payload, signature] = parts;
  if (version !== VERSION) return null;

  const expected = await hmac(secret, `${version}.${payload}`);
  // Constant-time: a `===` here leaks how many leading bytes of a forged signature were right.
  if (!timingSafeEqual(expected, signature)) return null;

  return base64urlDecodeText(payload);
}

function secret(): string {
  return requireEnv("FINAL_SHIFT_SESSION_SECRET");
}

export async function signGuestSession(guestId: string): Promise<string> {
  const issued = now();
  const claims: GuestClaims = { g: guestId, iat: issued, exp: issued + GUEST_MAX_AGE };
  return sign(secret(), base64urlEncodeText(JSON.stringify(claims)));
}

/** Returns the guest id, or null for anything that isn't a live, untampered session. */
export async function readGuestSession(token: string | undefined): Promise<string | null> {
  const json = await verify(secret(), token);
  if (!json) return null;

  try {
    const claims = JSON.parse(json) as Partial<GuestClaims>;
    if (typeof claims.g !== "string" || typeof claims.exp !== "number") return null;
    if (claims.exp <= now()) return null;
    return claims.g;
  } catch {
    return null;
  }
}

export async function signAdminSession(): Promise<string> {
  const issued = now();
  const claims: AdminClaims = { a: true, iat: issued, exp: issued + ADMIN_MAX_AGE };
  return sign(secret(), base64urlEncodeText(JSON.stringify(claims)));
}

export async function readAdminSession(token: string | undefined): Promise<boolean> {
  const json = await verify(secret(), token);
  if (!json) return false;

  try {
    const claims = JSON.parse(json) as Partial<AdminClaims>;
    return claims.a === true && typeof claims.exp === "number" && claims.exp > now();
  } catch {
    return false;
  }
}

/*
 * The two cookies are independent on purpose. A guest session never confers admin and an admin
 * session never confers a guest identity, so there is no path where clocking in gets you the roster
 * and no path where knowing the passphrase silently answers on someone's behalf.
 *
 * Nothing is bound to the IP address. Phones move between WiFi and LTE constantly, and pinning the
 * session to an address would log guests out mid-flow for no security gain worth having — the
 * cookie is HttpOnly, so an attacker who can read it can already read everything else.
 *
 * `secure` is off outside production only because localhost is plain HTTP; every deployed
 * environment, including Vercel previews, is HTTPS and gets the flag.
 */
function baseCookie(name: string, value: string, maxAge: number) {
  return {
    name,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function guestCookie(value: string) {
  return baseCookie(GUEST_COOKIE, value, GUEST_MAX_AGE);
}

export function adminCookie(value: string) {
  return baseCookie(ADMIN_COOKIE, value, ADMIN_MAX_AGE);
}

export function expiredCookie(name: string) {
  return baseCookie(name, "", 0);
}
