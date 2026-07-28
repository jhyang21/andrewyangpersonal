import "@/lib/final-shift/env";

/*
 * HMAC-SHA256 and constant-time comparison, on `crypto.subtle`.
 *
 * No dependency: WebCrypto is present in Node 20+ and on Vercel's runtime, and this feature needs
 * exactly two primitives. Adding `jose` or `jsonwebtoken` for a signed cookie carrying one UUID
 * would be more surface, not less.
 */

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function keyFor(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;

  const key = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  keyCache.set(secret, key);
  return key;
}

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlEncodeText(text: string): string {
  return base64url(encoder.encode(text));
}

export function base64urlDecodeText(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    return new TextDecoder().decode(
      Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)),
    );
  } catch {
    return null;
  }
}

export async function hmac(secret: string, message: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await keyFor(secret),
    encoder.encode(message),
  );
  return base64url(new Uint8Array(signature));
}

/**
 * Compares two strings without leaking where they diverge.
 *
 * `a === b` on a signature short-circuits at the first differing byte, and the time difference is
 * measurable across enough requests — which is a signature-forgery oracle. Accumulating the XOR of
 * every byte and checking the total at the end takes the same time whatever the input.
 *
 * The length check up front is fine: the length of a signature is not a secret.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}
