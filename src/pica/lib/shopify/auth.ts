/**
 * Access token for the Catalog and Checkout MCP, from Dev Dashboard client
 * credentials. Returns null when the credentials are unset or the exchange
 * fails, so callers fall back to keyless calls. Never logs the token.
 */
import {
  TOKEN_ENDPOINT,
  TOKEN_REFRESH_MARGIN_MS,
  TOKEN_TIMEOUT_MS,
  catalogCredentials,
} from "./config";
import { isRecord } from "./transport";

const DEFAULT_TTL_SECONDS = 60 * 60;

/**
 * After a failed exchange or a rejected token, call keyless for this long
 * before trying again, so no request waits on an exchange that just failed.
 */
export const KEYLESS_AFTER_FAILURE_MS = 60_000;

let cached: { token: string; expiresAt: number } | null = null;
let pending: Promise<string | null> | null = null;
let keylessUntil = 0;

export async function getAccessToken(): Promise<string | null> {
  const creds = catalogCredentials();
  if (!creds) return null;
  if (keylessUntil > Date.now()) return null;
  if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) return cached.token;
  if (!pending) {
    pending = fetchToken(creds.clientId, creds.clientSecret).then(
      (token) => {
        if (!token) keylessUntil = Date.now() + KEYLESS_AFTER_FAILURE_MS;
        return token;
      },
    ).finally(() => {
      pending = null;
    });
  }
  return pending;
}

/**
 * Shopify answered 401 to this token. Drop it and call keyless for a while:
 * a new token from the same credentials would likely meet the same answer.
 */
export function rejectAccessToken(token: string): void {
  if (cached?.token === token) cached = null;
  keylessUntil = Date.now() + KEYLESS_AFTER_FAILURE_MS;
}

/** Forget the token and any keyless pause. Tests use it to start clean. */
export function clearAccessToken(): void {
  cached = null;
  keylessUntil = 0;
}

async function fetchToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[shopify] token exchange: HTTP ${res.status}; calling keyless`);
      return null;
    }
    const body: unknown = await res.json();
    if (!isRecord(body) || typeof body.access_token !== "string" || !body.access_token) {
      console.warn("[shopify] token exchange: no access_token in response; calling keyless");
      return null;
    }
    const ttl =
      typeof body.expires_in === "number" && body.expires_in > 0
        ? body.expires_in
        : DEFAULT_TTL_SECONDS;
    cached = { token: body.access_token, expiresAt: Date.now() + ttl * 1000 };
    return cached.token;
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    console.warn(`[shopify] token exchange failed (${reason}); calling keyless`);
    return null;
  }
}
