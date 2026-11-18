/**
 * How an error shows, decided in one place (brief section 7, "Whose words").
 *
 * The server already wrote every message for the buyer, so the message passes
 * through word for word. The view is sorted by where the error came from and
 * by its code, never by testing the words.
 */
import type { ApiError, ApiErrorCode } from "@/pica/lib/types";

/**
 * Where an error came from.
 * - `reply`: reported inside Pica's reply or a search result (a tool output's
 *   `problem`). It shows as Pica's own bubble in the chat or docked thread.
 * - `request`: a request failed (an `ApiResult` that is not ok, or the chat
 *   transport). It shows as a banner where the fault happened.
 */
export type ErrorOrigin = "reply" | "request";

export type ErrorTone = "critical" | "caution";

export interface ErrorView {
  code: ApiErrorCode;
  /** The server's words, as sent. */
  message: string;
  /** A bubble in Pica's voice, or a banner where the fault happened. */
  shape: "bubble" | "banner";
  tone: ErrorTone;
  /** True when sending the same request again may work. */
  retry: boolean;
}

/** A wait or a choice that is gone is a caution; anything else that stopped the buyer is critical. */
const CAUTION_CODES: ReadonlySet<ApiErrorCode> = new Set(["variant_unavailable", "rate_limited"]);

/** Faults that may clear on their own. A bad request, a missing product or a missing key will not. */
const RETRY_CODES: ReadonlySet<ApiErrorCode> = new Set([
  "rate_limited",
  "catalog_unavailable",
  "checkout_unavailable",
  "model_unavailable",
  "unknown",
]);

export function errorView(error: ApiError, origin: ErrorOrigin): ErrorView {
  return {
    code: error.code,
    message: error.message,
    shape: origin === "reply" ? "bubble" : "banner",
    tone: CAUTION_CODES.has(error.code) ? "caution" : "critical",
    // A bubble is part of the reply: the buyer answers it by writing again.
    retry: origin === "request" && RETRY_CODES.has(error.code),
  };
}

/** A catalog problem inside Pica's reply (`SearchCatalogOutput.problem`). */
export function catalogProblemView(problem: ApiError): ErrorView {
  return errorView(problem, "reply");
}
