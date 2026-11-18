import { describe, expect, it } from "vitest";
import type { ApiError, ApiErrorCode } from "@/pica/lib/types";
import { catalogProblemView, errorView } from "./errors";

const ALL_CODES: ApiErrorCode[] = [
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

describe("errorView", () => {
  it("passes the server's message through word for word", () => {
    const message = "We couldn't reach the Shopify catalog. Try again in a minute.";
    expect(errorView({ code: "catalog_unavailable", message }, "request").message).toBe(message);
    expect(errorView({ code: "catalog_unavailable", message }, "reply").message).toBe(message);
  });

  it("sorts by code and origin, never by the words", () => {
    for (const code of ALL_CODES) {
      for (const origin of ["reply", "request"] as const) {
        const a = errorView({ code, message: "One wording." }, origin);
        const b = errorView({ code, message: "Sold out, too long, try again, rate limited." }, origin);
        expect({ ...a, message: "" }).toEqual({ ...b, message: "" });
      }
    }
  });

  it("shows a failed request as a banner where the fault happened", () => {
    expect(errorView({ code: "catalog_unavailable", message: "x" }, "request")).toMatchObject({
      shape: "banner",
      tone: "critical",
      retry: true,
    });
  });

  it("shows a problem inside Pica's reply as Pica's bubble, with no retry button", () => {
    const problem: ApiError = { code: "catalog_unavailable", message: "x" };
    expect(catalogProblemView(problem)).toMatchObject({ shape: "bubble", retry: false });
    expect(catalogProblemView({ code: "not_found", message: "y" }).shape).toBe("bubble");
  });

  it("uses caution for a wait or a choice that is gone, critical otherwise", () => {
    const tones = Object.fromEntries(ALL_CODES.map((code) => [code, errorView({ code, message: "x" }, "request").tone]));
    expect(tones).toEqual({
      bad_request: "critical",
      not_found: "critical",
      variant_unavailable: "caution",
      rate_limited: "caution",
      catalog_unavailable: "critical",
      checkout_unavailable: "critical",
      model_unavailable: "critical",
      missing_key: "critical",
      bad_key: "critical",
      unknown: "critical",
    });
  });

  it("offers a retry only for faults that may clear on their own", () => {
    const retry = ALL_CODES.filter((code) => errorView({ code, message: "x" }, "request").retry);
    expect(retry).toEqual(["rate_limited", "catalog_unavailable", "checkout_unavailable", "model_unavailable", "unknown"]);
  });
});
