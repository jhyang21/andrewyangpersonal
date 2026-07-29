import { hmac } from "@/lib/final-shift/crypto";
import { requireEnv } from "@/lib/final-shift/env";

export const CODE_PATTERN = /^\d{4}$/;

/**
 * Reduces whatever arrived to a four-digit code, or null.
 *
 * Guests paste, autofill, and type spaces; a code arriving as " 04 21 " is the right code. Anything
 * that still isn't four digits after stripping is rejected here, and — this is the part that
 * matters — the caller must answer it with the same message and the same delay as an unknown code.
 * "Malformed" and "not on the roster" have to be indistinguishable, or the format check itself
 * becomes the fast path in an enumeration attack.
 */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  return CODE_PATTERN.test(digits) ? digits : null;
}

/**
 * The stored form of a code.
 *
 * Hashing four digits is cryptographically pointless — ten thousand candidates is a rainbow table
 * you can build in a millisecond — and that is not why it's here. These are the guests' real Ape
 * Coffee clock-in credentials, used on a real timeclock at a real job. A database dump, a stray log
 * line, or Andrew screen-sharing Supabase Studio must not put a coworker's workplace code on
 * screen. The pepper lives only in the environment, so the table alone reveals nothing; Andrew
 * identifies rows by first name.
 */
export async function hashCode(code: string): Promise<string> {
  return hmac(requireEnv("FINAL_SHIFT_CODE_PEPPER"), `fs-code:${code}`);
}
