/**
 * Small fetch helpers for the catalog and checkout routes. Every failure comes
 * back as an `ApiError` with a message the page can show as it is.
 */
import { BASE } from "@/pica/lib/base";
import type { ApiError, ApiErrorCode } from "@/pica/lib/types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError; status: number };

/** The client's own words: the interface names Pica and never says "we". */
export const OFFLINE_MESSAGE = "Your browser couldn't reach Pica. Check your connection, then try again.";
/** The server's own line for `unknown` (src/pica/lib/shopify/errors.ts), for a failure with no body; kept word for word. */
const UNKNOWN_MESSAGE = "Sorry, something went wrong on our side. Try again in a minute.";

const CODES: readonly ApiErrorCode[] = [
  "bad_request",
  "not_found",
  "variant_unavailable",
  "rate_limited",
  "catalog_unavailable",
  "checkout_unavailable",
  "model_unavailable",
  "missing_key",
  "bad_key",
  "unknown",
];

/** Reads `{ error: ApiError }` from any value, or returns null. */
export function asApiError(value: unknown): ApiError | null {
  if (typeof value !== "object" || value === null) return null;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const { code, message, retryAfterSeconds } = error as Record<string, unknown>;
  if (typeof message !== "string" || message.length === 0) return null;
  return {
    code: CODES.includes(code as ApiErrorCode) ? (code as ApiErrorCode) : "unknown",
    message,
    ...(typeof retryAfterSeconds === "number" ? { retryAfterSeconds } : {}),
  };
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, status: 0, error: { code: "unknown", message: OFFLINE_MESSAGE } };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: asApiError(body) ?? { code: "unknown", message: UNKNOWN_MESSAGE },
    };
  }
  return { ok: true, data: body as T };
}

export function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

/** The product route's query string. `selected` is the shown variant's options. */
export function productUrl(id: string, selected?: { name: string; label: string }[]): string {
  const params = new URLSearchParams({ id });
  if (selected && selected.length > 0) params.set("selected", JSON.stringify(selected));
  return `${BASE}/api/catalog/product?${params.toString()}`;
}
