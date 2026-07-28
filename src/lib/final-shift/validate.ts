import { LIMITS, type DraftValues, type EventConfig } from "@/lib/final-shift/types";

/*
 * Hand-rolled validation, deliberately.
 *
 * Zod would be a dependency to describe payloads that are seven flat fields, and it would not do
 * the part that actually matters here: the real check is membership against sets the server owns —
 * date-option ids and dietary chips read out of `event_config` — not shape. A schema library would
 * validate that `availableDates` is an array of strings and happily accept `["d99"]`.
 *
 * Every rule below is also enforced in the UI. That is not redundancy: the client rules exist to be
 * kind, and these exist because the client is a thing an attacker controls.
 */

export function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Keeps the ids the event knows about, in the order the *event* lists them.
 *
 * Walking `allowed` rather than the incoming array is what makes the stored order canonical. Take
 * the input order instead and a guest who ticks August 22, then September 5, then goes back for
 * August 29 has their answer saved as `[d1, d3, d2]` — and every screen that reads it, the review
 * step and Andrew's dashboard both, lists the last Saturday in the middle. Sorting at each render
 * would fix the display and leave the data crooked; sorting here fixes both, once.
 *
 * Unknown ids are dropped rather than rejected: Andrew removing a date must not turn every stored
 * answer into an error the guest cannot fix.
 */
function normalizeIds(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const asked = new Set<string>();
  for (const item of value) {
    if (typeof item === "string") asked.add(item.trim());
  }
  return allowed.filter((id) => asked.has(id));
}

/**
 * Turns an arbitrary JSON body into the subset of draft fields it legitimately carried.
 *
 * Absent keys stay absent — that is what makes PATCH partial. A key that is present but nonsense
 * (a number where a string belongs) is treated as absent rather than as an error, because the
 * autosave path must never interrupt someone mid-sentence to complain about a payload.
 */
export function parseDraftPatch(
  body: unknown,
  event: EventConfig,
): Partial<DraftValues> {
  if (!body || typeof body !== "object") return {};
  const input = body as Record<string, unknown>;
  const patch: Partial<DraftValues> = {};

  if ("attending" in input) {
    if (typeof input.attending === "boolean") patch.attending = input.attending;
    else if (input.attending === null) patch.attending = null;
  }

  if ("availableDates" in input) {
    patch.availableDates = normalizeIds(
      input.availableDates,
      event.dateOptions.map((option) => option.id),
    );
  }

  if ("dietaryTags" in input) {
    patch.dietaryTags = normalizeIds(input.dietaryTags, event.dietaryChips);
  }

  if ("dietaryNote" in input) {
    patch.dietaryNote = normalizeText(input.dietaryNote).slice(0, LIMITS.dietaryNote);
  }

  if ("caption" in input) {
    patch.caption = normalizeText(input.caption).slice(0, LIMITS.caption);
  }

  if ("memory" in input) {
    patch.memory = normalizeText(input.memory).slice(0, LIMITS.memory);
  }

  if ("wallConsent" in input && typeof input.wallConsent === "boolean") {
    patch.wallConsent = input.wallConsent;
  }

  return patch;
}

/** The stage a missing answer belongs to, so the client can jump the guest straight back to it. */
export type MissingField = {
  field: "attending" | "availableDates" | "photo" | "caption";
  stage: "receipt" | "photo";
};

/**
 * The full check that stands between a draft and a submitted RSVP.
 *
 * Returns everything that's wrong, not the first thing — the client uses the list to decide which
 * stage to drop the guest on, and a one-at-a-time API would walk them through the flow once per
 * missing field.
 */
export function findMissing(values: {
  attending: boolean | null;
  availableDates: string[];
  caption: string;
  hasPhoto: boolean;
}): MissingField[] {
  const missing: MissingField[] = [];

  if (values.attending === null) {
    missing.push({ field: "attending", stage: "receipt" });
  }
  // Only meaningful for a guest who said yes. Someone who can't make it has no dates to give, and
  // demanding one would be the flow arguing with an answer it just accepted.
  if (values.attending === true && values.availableDates.length === 0) {
    missing.push({ field: "availableDates", stage: "receipt" });
  }
  if (!values.hasPhoto) {
    missing.push({ field: "photo", stage: "photo" });
  }
  if (!values.caption.trim()) {
    missing.push({ field: "caption", stage: "photo" });
  }

  return missing;
}
